import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { trimStringToNullIfBlank } from '@/common/utils/text.util';

export class UpdateMeDto {
  @ApiPropertyOptional({
    description: 'Display name shown in the app (null or blank removes it)',
    type: String,
    maxLength: 100,
    example: 'Alice',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToNullIfBlank(value))
  @IsString()
  @MaxLength(100)
  displayName?: string | null;

  @ApiPropertyOptional({
    description: 'Short bio (null or blank removes it)',
    type: String,
    maxLength: 500,
    example: 'Quiz enthusiast and trivia lover',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToNullIfBlank(value))
  @IsString()
  @MaxLength(500)
  bio?: string | null;

  @ApiPropertyOptional({
    description: 'Avatar image URL (null or blank removes it)',
    type: String,
    maxLength: 2048,
    example: 'https://example.com/avatars/alice.jpg',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToNullIfBlank(value))
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  avatarUrl?: string | null;
}
