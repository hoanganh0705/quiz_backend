import { Injectable } from '@nestjs/common';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { QuizQuestionService } from '../domain/question/quiz-question.service';
import { QuizQuestionAuthorResponseMapper } from '../mappers/quiz-question-author-response.mapper';
import { CreateQuizQuestionDto } from '../dto/request/create-quiz-question.dto';
import { CreateQuizQuestionsDto } from '../dto/request/create-quiz-questions.dto';
import type { QuizQuestionAuthorDto } from '../dto/response/quiz-question-author.dto';
import type { BulkQuizQuestionsResponseDto } from '../dto/response/bulk-quiz-questions-response.dto';
import type { CreateQuizQuestionCommand, CreateQuizQuestionsCommand } from '../domain/types';
import { QuizValidationError } from '../domain/errors/quiz-domain.errors';
import { QuizValidationFieldError } from '../domain/errors/quiz-validation-field.error';

@Injectable()
export class QuizQuestionApplicationService {
  constructor(private readonly quizQuestionService: QuizQuestionService) {}

  async createQuizQuestion(
    quizId: string,
    quizVersionId: string,
    user: JwtPayload,
    dto: CreateQuizQuestionDto,
  ): Promise<QuizQuestionAuthorDto> {
    // Phase 5 (S-27): surface per-field validation errors via
    // `extensions.validationErrors` on 422 so the editor can wire
    // `setError(field.path, { message })` directly. We translate
    // domain validation here so the wire shape stays consistent.
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

  // ─── Per-field validation helpers ────────────────────────────────────────

  /**
   * Lightweight pre-flight validation that mirrors the rules in
   * `QuizQuestionService.assertValidAnswerOptions` but produces per-field
   * error rows so the editor can highlight individual inputs.
   */
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

  /**
   * Map a thrown `QuizValidationError` to a `QuizValidationFieldError`
   * carrying a synthesised field-error row. We do not currently parse
   * the message text to extract a specific field — callers should rely
   * on the pre-flight check above for structured errors; this fallback
   * preserves a 422 + validationErrors extension shape for any deeper
   * domain validation that surfaces later.
   */
  private translateValidationError(err: QuizValidationError): QuizValidationFieldError {
    const message = err.message;
    let field = 'questionText';
    const lower = message.toLowerCase();
    if (lower.includes('position')) field = 'position';
    else if (lower.includes('answer option')) field = 'answerOptions';
    else if (lower.includes('correct')) field = 'answerOptions';
    return new QuizValidationFieldError(message, [{ field, message }]);
  }
}
