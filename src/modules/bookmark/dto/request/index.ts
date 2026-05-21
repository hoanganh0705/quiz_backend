import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  IsUUID,
  Matches,
} from 'class-validator';

const DEFAULT_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateCollectionDto {
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}

export class AddBookmarkDto {
  @IsUUID('4')
  quizId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdateBookmarkDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class ListCollectionBookmarksQueryDto {
  @IsOptional()
  @IsString()
  @Matches(DEFAULT_SLUG_PATTERN)
  difficulty?: string;
}
