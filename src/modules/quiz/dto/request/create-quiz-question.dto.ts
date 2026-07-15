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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { trimString, trimStringToNullIfBlank } from '@/common/utils/text.util';

class CreateQuizAnswerOptionDto {
  @ApiProperty({ description: 'Display order of the option (1-based)', minimum: 1, example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  position!: number;

  @ApiProperty({
    description: 'Answer option text',
    minLength: 1,
    maxLength: 1000,
    example: 'console.log',
  })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  value!: string;

  @ApiProperty({ description: 'Whether this is the correct answer', example: true })
  @IsBoolean()
  isCorrect!: boolean;
}

export class CreateQuizQuestionDto {
  @ApiProperty({
    description: 'Display order of the question (1-based)',
    minimum: 1,
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  position!: number;

  @ApiProperty({
    description: 'The question text',
    minLength: 1,
    maxLength: 2000,
    example: 'What does `console.log` do in JavaScript?',
  })
  @Transform(({ value }: { value: unknown }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  questionText!: string;

  @ApiPropertyOptional({
    description: 'Optional image URL associated with the question',
    type: String,
    maxLength: 2048,
    format: 'uri',
    example: 'https://example.com/questions/console-log.png',
    nullable: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => trimStringToNullIfBlank(value))
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  imageUrl?: string | null;

  @ApiProperty({
    description: 'Answer options (minimum 2, maximum 10)',
    minItems: 2,
    maxItems: 10,
    type: () => CreateQuizAnswerOptionDto,
    example: [
      { position: 1, value: 'Outputs text to the console', isCorrect: true },
      { position: 2, value: 'Creates a new variable', isCorrect: false },
      { position: 3, value: 'Defines a function', isCorrect: false },
      { position: 4, value: 'Adds an element to the DOM', isCorrect: false },
    ],
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CreateQuizAnswerOptionDto)
  answerOptions!: CreateQuizAnswerOptionDto[];
}

export { CreateQuizQuestionsDto } from './create-quiz-questions.dto';
