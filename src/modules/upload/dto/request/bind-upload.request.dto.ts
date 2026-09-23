import { IsIn, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

import { UPLOAD_PURPOSES, type UploadPurposeLiteral } from './upload-file.request.dto';

export class BindUploadRequestDto {
  @ApiProperty({
    description: 'Logical purpose this asset will be bound under.',
    enum: UPLOAD_PURPOSES,
    example: 'avatar',
  })
  @IsString()
  @IsIn(UPLOAD_PURPOSES, { message: 'purpose must be one of: avatar, quiz' })
  purpose!: UploadPurposeLiteral;
}
