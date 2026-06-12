// Re-export everything from domain/types so DTOs and other consumers
// get both the TypeScript type (for type narrowing) and the const object
// (for runtime validation and Swagger). One source of truth.
export {
  DISCUSSION_THREAD_STATUS as ThreadStatus,
  DISCUSSION_CONTENT_STATUS as DiscussionContentStatus,
  DISCUSSION_VOTE_VALUE as VoteValue,
  DISCUSSION_REPORT_STATUS as ReportStatus,
  DISCUSSION_REPORT_TARGET_TYPE as VoteTargetType,
  THREAD_SORT_FIELD as ThreadSortField,
  SORT_ORDER as SortOrder,
  REVIEW_REPORT_STATUS as ReviewReportStatus,
} from '../../domain/types';
