/**
 * Query arguments for the quiz directory bundle.
 */
import { ArgsType, Field, Int, registerEnumType } from '@nestjs/graphql';
import { Max, Min } from 'class-validator';

import { QUIZ_BUNDLE_LIMITS } from '@/modules/quiz/application/quizzes-bundle.constants';
import type { ListQuizzesQueryDto } from '@/modules/quiz/dto/request/list-quizzes-query.dto';

export const QUIZ_LISTING_LIMITS = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 50,
} as const;

export const QUIZ_SORT_ORDERS = ['newest', 'popular', 'top_rated', 'trending'] as const;
export type QuizSortOrder = (typeof QUIZ_SORT_ORDERS)[number];

export enum QuizDifficultyFilter {
  Easy = 'easy',
  Medium = 'medium',
  Hard = 'hard',
}

export enum QuizSortOrderFilter {
  Newest = 'newest',
  Popular = 'popular',
  TopRated = 'top_rated',
  Trending = 'trending',
}

registerEnumType(QuizDifficultyFilter, {
  name: 'QuizDifficultyFilter',
  description: 'Difficulty levels a listing can be filtered by.',
});

registerEnumType(QuizSortOrderFilter, {
  name: 'QuizSortOrder',
  description: 'Ordering applied to a quiz listing.',
});

@ArgsType()
export class QuizzesBundleArgsGql {
  @Field(() => String, { nullable: true, description: 'Full-text search term' })
  q?: string;

  @Field(() => QuizSortOrderFilter, { nullable: true })
  sort?: QuizSortOrderFilter;

  @Field(() => QuizDifficultyFilter, { nullable: true })
  difficulty?: QuizDifficultyFilter;

  @Field(() => String, { nullable: true, description: 'Category identifier' })
  categoryId?: string;

  @Field(() => [String], {
    nullable: true,
    description: 'Tag slugs. Resolved to identifiers server-side.',
  })
  tagSlugs?: string[];

  @Field(() => String, { nullable: true, description: 'Cursor for the next page' })
  cursor?: string;

  @Field(() => Int, {
    nullable: true,
    defaultValue: QUIZ_LISTING_LIMITS.DEFAULT_LIMIT,
    description: 'Items per page. Clamped to the maximum page size.',
  })
  @Min(1)
  @Max(QUIZ_LISTING_LIMITS.MAX_LIMIT)
  limit?: number;

  @Field(() => Int, {
    nullable: true,
    defaultValue: QUIZ_BUNDLE_LIMITS.DEFAULT_RAIL_LIMIT,
    description: 'Number of items in each taxonomy rail.',
  })
  @Min(1)
  @Max(QUIZ_BUNDLE_LIMITS.MAX_RAIL_LIMIT)
  railLimit?: number;
}

/**
 * Projects the GraphQL arguments onto the transport-agnostic listing query.
 *
 * This is a free function rather than a method on `QuizzesBundleArgsGql`
 * because `@nestjs/graphql` hands the resolver the arguments as a plain
 * object, not an instance of the `@ArgsType` class, so a prototype method
 * would be undefined at call time.
 *
 * An out-of-range page size is clamped rather than rejected, because a client
 * that asks for too much should still receive a usable first page.
 */
export const toQuizzesBundleFilters = (args: QuizzesBundleArgsGql): ListQuizzesQueryDto => {
  const requested = args.limit ?? QUIZ_LISTING_LIMITS.DEFAULT_LIMIT;

  return {
    q: args.q,
    sort: args.sort,
    difficulty: args.difficulty,
    categoryId: args.categoryId,
    tagSlugs: args.tagSlugs,
    cursor: args.cursor,
    limit: Math.min(requested, QUIZ_LISTING_LIMITS.MAX_LIMIT),
  };
};
