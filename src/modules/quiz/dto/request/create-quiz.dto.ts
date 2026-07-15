import { Transform, Type } from 'class-transformer';
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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DEFAULT_SLUG_PATTERN } from '@/common/utils/slug.util';
import {
  trimString,
  trimStringToLowerCase,
  trimStringToNullIfBlank,
} from '@/common/utils/text.util';
import { QUIZ_SLUG_INVALID_MESSAGE } from '../../quiz.constants';
import { QUIZ_DIFFICULTIES, type QuizDifficulty } from '../../types/quiz.types';

class CreateInitialQuizVersionDto {
  @ApiProperty({ description: 'Quiz difficulty level', enum: QUIZ_DIFFICULTIES, example: 'medium' })
  @IsIn(QUIZ_DIFFICULTIES)
  difficulty!: QuizDifficulty;

  @ApiProperty({ description: 'Time limit in milliseconds', minimum: 1, example: 600000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationMs!: number;

  @ApiProperty({
    description: 'Minimum score percent required to pass',
    minimum: 0,
    maximum: 100,
    example: 70,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  passingScorePercent!: number;

  @ApiProperty({ description: 'XP reward for passing the quiz', minimum: 0, example: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  rewardXp!: number;
}

export class CreateQuizDto {
  @ApiProperty({
    description: 'Quiz title',
    minLength: 1,
    maxLength: 255,
    example: 'JavaScript Fundamentals',
  })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({
    description: 'Quiz description',
    type: String,
    maxLength: 2000,
    example:
      'Test your knowledge of JavaScript fundamentals including variables, functions, and DOM manipulation.',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToNullIfBlank(value))
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({
    description: 'URL-friendly slug (auto-generated from title if omitted)',
    maxLength: 120,
    pattern: DEFAULT_SLUG_PATTERN.source,
    example: 'javascript-fundamentals',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToLowerCase(value))
  @IsString()
  @MaxLength(120)
  @Matches(DEFAULT_SLUG_PATTERN, {
    message: QUIZ_SLUG_INVALID_MESSAGE,
  })
  slug?: string;

  @ApiPropertyOptional({
    description: 'Prerequisites or requirements to attempt this quiz',
    type: String,
    maxLength: 5000,
    example: 'Basic understanding of HTML and CSS',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToNullIfBlank(value))
  @IsString()
  @MaxLength(5000)
  requirements?: string | null;

  @ApiPropertyOptional({
    description: 'Quiz cover image URL',
    type: String,
    maxLength: 2048,
    format: 'uri',
    example: 'https://example.com/covers/javascript-fundamentals.png',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToNullIfBlank(value))
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  imageUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Whether the quiz is featured on the home page',
    default: false,
    example: false,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the quiz is hidden from public listings',
    default: false,
    example: false,
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  isHidden?: boolean;

  @ApiPropertyOptional({
    description: 'UUID of the associated category',
    type: String,
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4')
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'UUIDs of associated tags (max 50)',
    type: Array,
    maxItems: 50,
    format: 'uuid',
    example: ['770e8400-e29b-41d4-a716-446655440000'],
    nullable: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  tagIds?: string[];

  @ApiProperty({
    description: 'Initial version metadata for the quiz',
    type: () => CreateInitialQuizVersionDto,
    example: {
      difficulty: 'medium',
      durationMs: 600000,
      passingScorePercent: 70,
      rewardXp: 100,
    },
  })
  @ValidateNested()
  @Type(() => CreateInitialQuizVersionDto)
  initialVersion!: CreateInitialQuizVersionDto;
}
