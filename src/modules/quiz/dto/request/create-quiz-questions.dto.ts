import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CreateQuizQuestionDto } from './create-quiz-question.dto';

export class CreateQuizQuestionsDto {
  @ApiProperty({
    description: 'Questions to create (minimum 1, maximum 50 per request)',
    minItems: 1,
    maxItems: 50,
    type: () => CreateQuizQuestionDto,
    example: [
      {
        position: 1,
        questionText: 'What does `console.log` do in JavaScript?',
        imageUrl: null,
        answerOptions: [
          { position: 1, value: 'Outputs text to the console', isCorrect: true },
          { position: 2, value: 'Creates a new variable', isCorrect: false },
          { position: 3, value: 'Defines a function', isCorrect: false },
          { position: 4, value: 'Adds an element to the DOM', isCorrect: false },
        ],
      },
      {
        position: 2,
        questionText: 'Which keyword declares a block-scoped variable?',
        answerOptions: [
          { position: 1, value: 'var', isCorrect: false },
          { position: 2, value: 'let', isCorrect: true },
          { position: 3, value: 'function', isCorrect: false },
          { position: 4, value: 'class', isCorrect: false },
        ],
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateQuizQuestionDto)
  questions!: CreateQuizQuestionDto[];
}
