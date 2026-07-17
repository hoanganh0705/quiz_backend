/**
 * Quiz module constants.
 *
 * ## Slug Validation Rules
 * Quiz slugs must:
 * - Be lowercase (automatically enforced by transformation)
 * - Contain only letters (a-z), numbers (0-9), and hyphens (-)
 * - Start with a letter or number
 * - End with a letter or number
 * - Have a maximum length of 120 characters
 * - Be unique across all quizzes
 *
 * Examples of valid slugs:
 * - "javascript-fundamentals"
 * - "python-101"
 * - "web-development-basics"
 *
 * Examples of invalid slugs:
 * - "JavaScript_Fundamentals" (uppercase, contains underscore)
 * - "-leading-hyphen" (starts with hyphen)
 * - "trailing-hyphen-" (ends with hyphen)
 */

export const QUIZ_SLUG_EMPTY_MESSAGE = 'Quiz slug cannot be empty';

export const QUIZ_SLUG_INVALID_MESSAGE =
  'Quiz slug must be lowercase and can only contain letters, numbers, and hyphens';

export const QUIZ_SLUG_CONFLICT_MESSAGE = 'Quiz slug already exists';

export const QUIZ_LINK_IDS_INVALID_MESSAGE = 'One or more category IDs or tag IDs do not exist';

export const QUIZ_VERSION_CONFLICT_MESSAGE = 'Quiz version already exists';

export const QUIZ_VERSION_NOT_FOUND_MESSAGE = 'Quiz version not found';

export const QUIZ_QUESTION_POSITION_CONFLICT_MESSAGE = 'Question position already exists';

export const QUIZ_QUESTION_OPTION_POSITION_CONFLICT_MESSAGE =
  'Answer option position already exists';

export const QUIZ_QUESTION_CORRECT_OPTION_MESSAGE =
  'Each question must have exactly one correct answer';

/**
 * Business invariant: a quiz version must contain at least this many questions
 * before it can transition from draft → published.
 * This guarantees that every published version is always attemptable.
 */
export const MIN_QUESTIONS_TO_PUBLISH = 5;

export const QUIZ_INSUFFICIENT_QUESTIONS_MESSAGE = `Quiz version must contain at least ${MIN_QUESTIONS_TO_PUBLISH} questions before publishing`;
