export const QUIZ_SLUG_EMPTY_MESSAGE = 'Quiz slug cannot be empty';

export const QUIZ_SLUG_INVALID_MESSAGE =
  'Quiz slug must be lowercase and can only contain letters, numbers, and hyphens';

export const QUIZ_SLUG_CONFLICT_MESSAGE = 'Quiz slug already exists';

export const QUIZ_LINK_IDS_INVALID_MESSAGE = 'One or more category IDs or tag IDs do not exist';

export const QUIZ_VERSION_CONFLICT_MESSAGE = 'Quiz version already exists';

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
