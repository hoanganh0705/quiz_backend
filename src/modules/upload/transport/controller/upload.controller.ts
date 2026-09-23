import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FileTypeValidator, MaxFileSizeValidator } from '@nestjs/common/pipes';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiPayloadTooLargeResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { type JwtPayload } from '@/common/guards/jwt.guard';

import { UploadFileRequestDto } from '../../dto/request/upload-file.request.dto';
import { SignUploadRequestDto } from '../../dto/request/sign-upload.request.dto';
import { BindUploadRequestDto } from '../../dto/request/bind-upload.request.dto';
import { UploadFileResponseDto } from '../../dto/response/upload-file.response.dto';
import { SignUploadResponseDto } from '../../dto/response/sign-upload.response.dto';
import { BindUploadResponseDto } from '../../dto/response/bind-upload.response.dto';
import { UploadApplicationService } from '../../application/upload.application.service';

const MAX_BYTES = 8 * 1024 * 1024;

const fileInterceptorOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
} as const;

const invalidPurposeExample = {
  code: 'UPLOAD_INVALID_PURPOSE',
  message: 'purpose must be one of: avatar, quiz',
};

const unsupportedMediaTypeExample = {
  code: 'UPLOAD_UNSUPPORTED_MEDIA_TYPE',
  message: 'Declared MIME "application/pdf" is not allowed for purpose "avatar".',
  allowed: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
};

const payloadTooLargeExample = {
  code: 'UPLOAD_FILE_TOO_LARGE',
  message: 'File exceeds 5242880 bytes for purpose "avatar".',
  maxBytes: 5_242_880,
  actualBytes: 9_000_000,
};

const noFileExample = {
  code: 'UPLOAD_NO_FILE',
  message: 'Multipart field "file" is required.',
};

const providerUnavailableExample = {
  code: 'UPLOAD_PROVIDER_UNAVAILABLE',
  message: 'Storage provider rejected the upload. Please retry shortly.',
};

const ownershipBindFailedExample = {
  code: 'UPLOAD_OWNERSHIP_BIND_FAILED',
  message: 'Failed to bind uploaded asset to owner.',
};

const tooManyRequestsExample = {
  statusCode: 429,
  message: 'ThrottlerException: Too Many Requests',
};

const unauthorizedExample = {
  statusCode: 401,
  message: 'Unauthorized',
};

@ApiTags('uploads')
@Controller({ path: 'uploads', version: '1' })
export class UploadController {
  constructor(private readonly uploadApplicationService: UploadApplicationService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', fileInterceptorOptions))
  @ApiOperation({
    summary: 'Upload an image (avatar or quiz cover)',
    description:
      'Returns the Cloudinary public_id the client should echo back when patching the entity.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'purpose'],
      properties: {
        file: { type: 'string', format: 'binary' },
        purpose: { type: 'string', enum: ['avatar', 'quiz'] },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Asset uploaded and bound to the caller.',
    type: UploadFileResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Missing file or invalid `purpose` value.',
    examples: {
      invalidPurpose: { summary: 'invalid purpose', value: invalidPurposeExample },
      noFile: { summary: 'missing file field', value: noFileExample },
    },
  })
  @ApiUnauthorizedResponse({ example: unauthorizedExample })
  @ApiPayloadTooLargeResponse({
    description: 'File exceeds the per-purpose size cap.',
    example: payloadTooLargeExample,
  })
  @ApiUnsupportedMediaTypeResponse({
    description: 'Declared MIME not in the allowlist.',
    example: unsupportedMediaTypeExample,
  })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit exceeded (20 req / 60 s / user).',
    example: tooManyRequestsExample,
  })
  @ApiServiceUnavailableResponse({
    description: 'Cloudinary rejected the upload after retries.',
    example: providerUnavailableExample,
  })
  @ApiInternalServerErrorResponse({
    description: 'Upload succeeded but ownership bind failed.',
    example: ownershipBindFailedExample,
  })
  async upload(
    @CurrentUser() user: JwtPayload,
    @Body() body: UploadFileRequestDto,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|webp|gif)$/ }),
          new MaxFileSizeValidator({ maxSize: MAX_BYTES }),
        ],
      }),
    )
    file: Express.Multer.File,
  ): Promise<UploadFileResponseDto> {
    const result = await this.uploadApplicationService.uploadAvatarOrQuizCover({
      ownerId: user.sub,
      purpose: body.purpose,
      file,
    });

    return {
      publicId: result.publicId,
      url: result.url,
      bytes: result.bytes,
      format: result.format,
      width: result.width,
      height: result.height,
      purpose: body.purpose,
    };
  }

  @Post('sign')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Issue a signed upload URL',
    description:
      'Returns a Cloudinary-signed upload URL the client uses to POST the file directly ' +
      'to Cloudinary. The bytes never traverse this application server, which removes ' +
      'the upload as a scaling bottleneck and shrinks the request payload hitting the API. ' +
      'After the client uploads the file, it MUST call the bind endpoint to attach the ' +
      'returned `publicId` to its account — see `POST /uploads/:publicId/bind`.',
  })
  @ApiCreatedResponse({
    description: 'Signed upload envelope issued.',
    type: SignUploadResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid `purpose` value.',
    examples: {
      invalidPurpose: { summary: 'invalid purpose', value: invalidPurposeExample },
    },
  })
  @ApiUnauthorizedResponse({ example: unauthorizedExample })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit exceeded (20 req / 60 s / user).',
    example: tooManyRequestsExample,
  })
  @ApiInternalServerErrorResponse({
    description: 'Cloudinary rejected the signature request.',
    example: {
      code: 'UPLOAD_SIGN_FAILED',
      message: 'Failed to issue a signed upload URL. Please retry.',
    },
  })
  async signUpload(
    @CurrentUser() user: JwtPayload,
    @Body() body: SignUploadRequestDto,
  ): Promise<SignUploadResponseDto> {
    const signed = await this.uploadApplicationService.signUpload({
      ownerId: user.sub,
      purpose: body.purpose,
      ...(body.expiresInSeconds !== undefined ? { expiresInSeconds: body.expiresInSeconds } : {}),
    });
    return {
      uploadUrl: signed.uploadUrl,
      publicId: signed.publicId,
      expiresAt: signed.expiresAt,
      apiKey: signed.apiKey,
      signature: signed.signature,
      timestamp: signed.timestamp,
      folder: signed.folder,
    };
  }

  @Post(':publicId/bind')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Bind a previously uploaded asset to the authenticated user',
    description:
      'Called by the client after it has uploaded a file directly to Cloudinary via ' +
      'a signed envelope (returned by `POST /uploads/sign`). Persists the ownership ' +
      'row so subsequent entity writes that reference this `publicId` pass the §11 ' +
      'ownership gate. The `publicId` in the URL must already exist in the storage ' +
      'backend — a missing row returns 404 rather than binding a phantom id.',
  })
  @ApiParam({
    name: 'publicId',
    description:
      'The Cloudinary public_id returned by `POST /uploads/sign` and echoed back from ' +
      'the client-side upload.',
    example:
      'quiz-app/avatars/0d8e3a45-7d7a-71f0-9e2a-9b0d9e2c7f3b/0190f6a5-d2c4-7b3e-a8e9-2b9f7e2b8b1a',
  })
  @ApiOkResponse({
    description: 'Asset bound to the caller.',
    type: BindUploadResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid `purpose` value.',
    examples: {
      invalidPurpose: { summary: 'invalid purpose', value: invalidPurposeExample },
    },
  })
  @ApiUnauthorizedResponse({ example: unauthorizedExample })
  @ApiNotFoundResponse({
    description: 'No asset row matches the supplied `publicId`.',
    example: {
      code: 'UPLOAD_ASSET_NOT_FOUND',
      message:
        'No uploaded asset matches publicId "quiz-app/avatars/u/forged". Complete the upload first or supply a publicId returned by the storage provider.',
    },
  })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit exceeded (30 req / 60 s / user).',
    example: tooManyRequestsExample,
  })
  @ApiInternalServerErrorResponse({
    description: 'The asset is already bound to a different owner.',
    example: ownershipBindFailedExample,
  })
  async bindUpload(
    @Param('publicId') publicId: string,
    @Body() body: BindUploadRequestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<BindUploadResponseDto> {
    await this.uploadApplicationService.bindAsset({
      ownerId: user.sub,
      publicId,
      purpose: body.purpose,
    });
    return {
      publicId,
      bound: true,
      purpose: body.purpose,
      ownerId: user.sub,
    };
  }
}
