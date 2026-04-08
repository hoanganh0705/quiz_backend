import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const QUIZ_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const QUIZ_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

class CreateInitialQuizVersionDto {
  @IsIn(QUIZ_DIFFICULTIES)
  difficulty!: (typeof QUIZ_DIFFICULTIES)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMs!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  passingScorePercent!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  rewardXp!: number;
}

export class CreateQuizDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(QUIZ_SLUG_PATTERN, {
    message: 'Slug must be lowercase and can only contain letters, numbers, and hyphens',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  requirements?: string | null;

  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  imageUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  tagIds?: string[];

  @ValidateNested()
  @Type(() => CreateInitialQuizVersionDto)
  initialVersion!: CreateInitialQuizVersionDto;
}
