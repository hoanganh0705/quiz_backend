import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchUserResultDto {
  @ApiProperty({ description: 'User identifier', example: '550e8400-e29b-71d4-a716-446655440000' })
  userId!: string;

  @ApiProperty({ description: 'Username (handle)', example: 'nestjs_dev' })
  username!: string;

  @ApiPropertyOptional({
    description: "The user's display name",
    type: String,
    example: 'NestJS Dev',
    nullable: true,
  })
  displayName!: string | null;
}

export class SearchQuizResultDto {
  @ApiProperty({ description: 'Quiz identifier', example: '660e8400-e29b-71d4-a716-446655440000' })
  quizId!: string;

  @ApiProperty({ description: 'Quiz title', example: 'Advanced NestJS Patterns' })
  title!: string;

  @ApiProperty({ description: 'Kebab-case quiz slug', example: 'advanced-nestjs-patterns' })
  slug!: string;
}

export class SearchCommentResultDto {
  @ApiProperty({
    description: 'Comment identifier',
    example: '770e8400-e29b-71d4-a716-446655440000',
  })
  commentId!: string;

  @ApiProperty({
    description: 'Quiz identifier the comment belongs to',
    example: '880e8400-e29b-71d4-a716-446655440000',
  })
  quizId!: string;
}

export class SearchCategoryResultDto {
  @ApiProperty({
    description: 'Category identifier',
    example: '880e8400-e29b-71d4-a716-446655440000',
  })
  categoryId!: string;

  @ApiProperty({ description: 'Category name', example: 'Web Development' })
  name!: string;

  @ApiPropertyOptional({
    description: 'Category slug',
    example: 'web-development',
    nullable: true,
  })
  slug!: string | null;
}

export class SearchTagResultDto {
  @ApiProperty({
    description: 'Tag identifier',
    example: '990e8400-e29b-71d4-a716-446655440000',
  })
  tagId!: string;

  @ApiProperty({ description: 'Tag name', example: 'typescript' })
  name!: string;
}

export class SearchResponseDto {
  @ApiProperty({ description: 'The query string echoed back as performed', example: 'nestjs' })
  query!: string;

  /**
   * Phase 1 (S-4): per-section `limit` echo. Mirrors the input
   * `limit` query param (default `10`, max `20`) so the client can
   * confirm how many rows it received in each section without
   * looking at the request side. Currently the limit is shared
   * across all five sections (`users`, `quizzes`, `comments`,
   * `categories`, `tags`).
   */
  @ApiProperty({
    description:
      'Per-section result cap applied to this response. ' +
      'Same value used for every section; configurable via the `limit` query param.',
    example: 10,
    minimum: 1,
    maximum: 20,
  })
  limit!: number;

  /**
   * Phase 1 (S-4): pagination cursor for follow-up queries. The
   * search endpoint is currently cursor-less (one-shot fan-out),
   * so this is always `null` today. The field is reserved for
   * future expansion — when the audit moves search to a paginated
   * surface, clients already read this shape today (see the
   * frontend `SearchResponseDto.cursor` typed surface).
   */
  @ApiProperty({
    description:
      'Opaque pagination cursor. `null` means the response is the ' +
      'final page (search is currently cursor-less).',
    type: String,
    nullable: true,
    example: null,
  })
  nextCursor!: string | null;

  /**
   * Phase 1 (S-4): indicates whether the backend had more results
   * than `limit` could surface. Mirrors the `hasNextPage` boolean
   * on every other cursor-paginated endpoint so the field can be
   * used uniformly. Always `false` until the search endpoint
   * gains cursor support.
   */
  @ApiProperty({
    description: '`true` when there are more results beyond this page.',
    example: false,
  })
  hasNextPage!: boolean;

  @ApiProperty({
    description: 'Matching users, ordered by relevance',
    type: () => [SearchUserResultDto],
  })
  users!: SearchUserResultDto[];

  @ApiProperty({
    description: 'Matching quizzes, ordered by relevance',
    type: () => [SearchQuizResultDto],
  })
  quizzes!: SearchQuizResultDto[];

  /**
   * Phase 1 (S-4): rename `commentss` → `comments`. The previous
   * spelling was a copy-paste typo in `SearchResponseDto`. The
   * downstream search-application service and types have already
   * been updated to match; the rename here is the breaking change
   * that lands the corrected spelling on the wire.
   */
  @ApiProperty({
    description: 'Matching comments, ordered by relevance',
    type: () => [SearchCommentResultDto],
  })
  comments!: SearchCommentResultDto[];

  @ApiProperty({
    description: 'Matching categories, ordered by relevance',
    type: () => [SearchCategoryResultDto],
    default: [],
  })
  categories!: SearchCategoryResultDto[];

  @ApiProperty({
    description: 'Matching tags, ordered by relevance',
    type: () => [SearchTagResultDto],
    default: [],
  })
  tags!: SearchTagResultDto[];
}
