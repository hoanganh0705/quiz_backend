import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { QuizQuestionService } from '../domain/question/quiz-question.service';
import { QuizQuestionAuthorResponseMapper } from '../mappers/quiz-question-author-response.mapper';
import { CreateQuizQuestionDto } from '../dto/request/create-quiz-question.dto';
import { CreateQuizQuestionsDto } from '../dto/request/create-quiz-questions.dto';
import type { QuizQuestionAuthorDto } from '../dto/response/quiz-question-author.dto';
import type { BulkQuizQuestionsResponseDto } from '../dto/response/bulk-quiz-questions-response.dto';
import type { CreateQuizQuestionCommand, CreateQuizQuestionsCommand } from '../domain/types';
import {
  QuizValidationError,
  type QuizValidationErrorCode,
} from '../domain/errors/quiz-domain.errors';
import { QuizValidationFieldError } from '../domain/errors/quiz-validation-field.error';

/**
 * Map from a domain validation code to the request DTO field the client
 * should highlight in an inline error.
 *
 * Decoupling this from the thrown `message` means the wire shape is
 * stable across message-string refactors; clients switch on
 * `extensions.code`, never on the message text.
 */
const CODE_TO_FIELD: Record<QuizValidationErrorCode, string> = {
  QUIZ_VALIDATION_FAILED: 'questionText',
  QUIZ_QUESTION_DUPLICATE_POSITION: 'position',
  QUIZ_QUESTION_OPTION_DUPLICATE_POSITION: 'answerOptions',
  QUIZ_QUESTION_OPTION_INCORRECT_COUNT: 'answerOptions',
  QUIZ_INVALID_QUIZ_VERSION: 'versionId',
};

@Injectable()
export class QuizQuestionApplicationService {
  constructor(private readonly quizQuestionService: QuizQuestionService) {}

  async createQuizQuestion(
    quizId: string,
    quizVersionId: string,
    user: JwtPayload,
    dto: CreateQuizQuestionDto,
  ): Promise<QuizQuestionAuthorDto> {
    this.assertValidPayload(dto);

    const command: CreateQuizQuestionCommand = {
      quizVersionId,
      position: dto.position,
      questionText: dto.questionText,
      imageUrl: dto.imageUrl ?? null,
      answerOptions: dto.answerOptions.map((option) => ({
        position: option.position,
        value: option.value,
        isCorrect: option.isCorrect,
      })),
    };
    try {
      const rows = await this.quizQuestionService.createQuizQuestion(
        quizId,
        quizVersionId,
        user,
        command,
      );
      const responses = QuizQuestionAuthorResponseMapper.toAuthorQuestionResponses(rows);
      return responses[0];
    } catch (err) {
      if (err instanceof QuizValidationError) {
        throw this.translateValidationError(err);
      }
      throw err;
    }
  }

  async createQuizQuestions(
    quizId: string,
    quizVersionId: string,
    user: JwtPayload,
    dto: CreateQuizQuestionsDto,
  ): Promise<BulkQuizQuestionsResponseDto> {
    const command: CreateQuizQuestionsCommand = {
      quizVersionId,
      questions: dto.questions.map((question) => ({
        position: question.position,
        questionText: question.questionText,
        imageUrl: question.imageUrl ?? null,
        answerOptions: question.answerOptions.map((option) => ({
          position: option.position,
          value: option.value,
          isCorrect: option.isCorrect,
        })),
      })),
    };
    const result = await this.quizQuestionService.createQuizQuestions(
      quizId,
      quizVersionId,
      user,
      command,
    );
    return {
      questions: QuizQuestionAuthorResponseMapper.toAuthorQuestionResponses(result.questions),
      results: result.rowResults,
    };
  }

  private assertValidPayload(dto: CreateQuizQuestionDto): void {
    const fieldErrors: Array<{ field: string; message: string }> = [];

    const text = dto.questionText?.trim() ?? '';
    if (text.length === 0) {
      fieldErrors.push({ field: 'questionText', message: 'Question text is required' });
    } else if (text.length > 1000) {
      fieldErrors.push({
        field: 'questionText',
        message: 'Question text cannot exceed 1000 characters',
      });
    }

    if (typeof dto.position !== 'number' || dto.position < 1) {
      fieldErrors.push({ field: 'position', message: 'Position must be a positive integer' });
    }

    if (dto.answerOptions.length < 2) {
      fieldErrors.push({
        field: 'answerOptions',
        message: 'At least 2 answer options are required',
      });
    }

    const emptyOptions = dto.answerOptions.filter((o) => !(o.value ?? '').trim());
    if (emptyOptions.length > 0) {
      fieldErrors.push({
        field: 'answerOptions',
        message: 'All answer options must have text',
      });
    }

    const correctCount = dto.answerOptions.filter((o) => o.isCorrect).length;
    if (correctCount !== 1) {
      fieldErrors.push({
        field: 'answerOptions',
        message: 'Exactly one answer option must be marked correct',
      });
    }

    if (fieldErrors.length > 0) {
      throw new QuizValidationFieldError(
        'Per-field validation failed; see extensions.validationErrors',
        fieldErrors,
      );
    }
  }

  private translateValidationError(err: QuizValidationError): QuizValidationFieldError {
    // Look up the field by the typed `code` discriminator rather than
    // substring-matching the human-readable `message`. New validation
    // codes MUST be added to `CODE_TO_FIELD` above; the catch-all
    // default covers the `QUIZ_VALIDATION_FAILED` fallback code.
    const field = CODE_TO_FIELD[err.code] ?? 'questionText';
    return new QuizValidationFieldError(err.message, [{ field, message: err.message }]);
  }
}
