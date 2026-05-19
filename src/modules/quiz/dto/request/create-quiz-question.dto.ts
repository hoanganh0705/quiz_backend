import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { trimString, trimStringToNullIfBlank } from '@/common/utils/text.util';

class CreateQuizAnswerOptionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  position!: number;

  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  value!: string;

  @IsBoolean()
  isCorrect!: boolean;
}

export class CreateQuizQuestionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  position!: number;

  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  questionText!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToNullIfBlank(value))
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  imageUrl?: string | null;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CreateQuizAnswerOptionDto)
  answerOptions!: CreateQuizAnswerOptionDto[];
}
