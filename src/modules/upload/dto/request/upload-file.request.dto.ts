import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export const UPLOAD_PURPOSES = ['avatar', 'quiz'] as const;
export type UploadPurposeLiteral = (typeof UPLOAD_PURPOSES)[number];

export class UploadFileRequestDto {
  @ApiProperty({
    description: 'Logical purpose for this upload',
    enum: UPLOAD_PURPOSES,
    example: 'avatar',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  @IsIn(UPLOAD_PURPOSES, { message: 'purpose must be one of: avatar, quiz' })
  purpose!: UploadPurposeLiteral;
}
