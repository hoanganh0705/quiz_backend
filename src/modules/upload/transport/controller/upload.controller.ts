/**
 * `POST /api/v1/uploads` — single endpoint for avatar + quiz cover.
 *
 * Wiring:
 *   - `@UseInterceptors(FileInterceptor('file', { ...memoryStorage() }))`
 *     so the bytes never touch disk.
 *   - `@Throttle({ default: { limit: 20, ttl: 60_000 } })` for the
 *     20 req/min/user budget (see migration plan §11).
 *   - `ParseFilePipe` runs `FileTypeValidator` (against the *declared*
 *     MIME) and `MaxFileSizeValidator` (8 MB ceiling — covers the
 *     larger quiz purpose). The application service does the per-
 *     purpose size check.
 *   - The multipart body is otherwise empty — the only field is
 *     `purpose`, which is JSON-encoded by Multer's default parser.
 */

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
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
  ApiOperation,
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
import { UploadFileResponseDto } from '../../dto/response/upload-file.response.dto';
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
}
