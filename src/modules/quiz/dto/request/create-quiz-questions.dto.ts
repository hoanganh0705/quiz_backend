import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateQuizQuestionDto } from './create-quiz-question.dto';

export class CreateQuizQuestionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateQuizQuestionDto)
  questions!: CreateQuizQuestionDto[];
}
