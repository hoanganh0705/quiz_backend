/**
 * GraphQL object types for the quiz directory.
 *
 * These describe the transport shape only. Field values are supplied by the
 * bundle service, so no business rule is expressed here.
 */
import { Field, Float, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('QuizPageInfo', { description: 'Cursor position within a result set' })
export class QuizPageInfoGql {
  @Field(() => Int, { description: 'Maximum number of items requested per page' })
  limit!: number;

  @Field(() => String, {
    nullable: true,
    description: 'Cursor for the next page. Null when this is the final page.',
  })
  nextCursor!: string | null;

  @Field(() => Boolean, { description: 'Whether more items exist after this page' })
  hasNextPage!: boolean;
}

@ObjectType('QuizAuthor')
export class QuizAuthorGql {
  @Field(() => String)
  userId!: string;

  @Field(() => String)
  username!: string;

  @Field(() => String, { nullable: true })
  displayName!: string | null;

  @Field(() => String, { nullable: true })
  avatarUrl!: string | null;
}

@ObjectType('QuizTag')
export class QuizTagGql {
  @Field(() => String)
  tagId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  slug!: string;
}

@ObjectType('QuizCategory')
export class QuizCategoryGql {
  @Field(() => String)
  categoryId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  slug!: string;
}

@ObjectType('Quiz')
export class QuizGql {
  @Field(() => String)
  quizId!: string;

  @Field(() => String, { nullable: true })
  creatorId!: string | null;

  @Field(() => QuizAuthorGql, { nullable: true })
  creator!: QuizAuthorGql | null;

  @Field(() => String)
  title!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => String)
  slug!: string;

  @Field(() => String, { nullable: true })
  imageUrl!: string | null;

  @Field(() => QuizDifficultyGql, { nullable: true })
  difficulty!: QuizDifficultyGql | null;

  @Field(() => QuizCategoryGql, {
    nullable: true,
    description: 'Category the quiz belongs to. Null when the quiz is uncategorised.',
  })
  category!: QuizCategoryGql | null;

  @Field(() => [QuizTagGql])
  tags!: QuizTagGql[];

  @Field(() => Boolean)
  isFeatured!: boolean;

  @Field(() => Int, { description: 'Question count of the published version' })
  questionCount!: number;

  @Field(() => Float, { description: 'Average review rating, or 0 when unreviewed' })
  averageRating!: number;

  @Field(() => Int)
  reviewCount!: number;

  @Field(() => Int, { description: 'Attempts across every version of this quiz' })
  attemptCount!: number;
}

@ObjectType('QuizDifficulty', { description: 'Difficulty of the published quiz version' })
export class QuizDifficultyGql {
  @Field(() => String, { description: 'Difficulty label, for example easy, medium, or hard' })
  label!: string;
}

@ObjectType('RankedCategory')
export class RankedCategoryGql {
  @Field(() => Int)
  rank!: number;

  @Field(() => String)
  categoryId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  slug!: string;
}

@ObjectType('RankedTag')
export class RankedTagGql {
  @Field(() => Int)
  rank!: number;

  @Field(() => String)
  tagId!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  slug!: string;
}

@ObjectType('PopularQuiz')
export class PopularQuizGql {
  @Field(() => Int)
  rank!: number;

  @Field(() => String)
  quizId!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String)
  slug!: string;

  @Field(() => String, { nullable: true })
  imageUrl!: string | null;

  @Field(() => Float)
  popularityScore!: number;

  @Field(() => Int)
  totalAttempts!: number;
}

@ObjectType('TrendingQuiz')
export class TrendingQuizGql {
  @Field(() => Int)
  rank!: number;

  @Field(() => String)
  quizId!: string;

  @Field(() => String)
  title!: string;

  @Field(() => String)
  slug!: string;

  @Field(() => String, { nullable: true })
  imageUrl!: string | null;

  @Field(() => Float)
  trendingScore!: number;

  @Field(() => Int)
  totalAttempts!: number;
}

@ObjectType('QuizzesBundle', {
  description: 'A filtered page of quizzes plus the rails that frame the directory.',
})
export class QuizzesBundleGql {
  @Field(() => [QuizGql])
  items!: QuizGql[];

  @Field(() => QuizPageInfoGql)
  pageInfo!: QuizPageInfoGql;

  @Field(() => [PopularQuizGql])
  popular!: PopularQuizGql[];

  @Field(() => [TrendingQuizGql])
  trending!: TrendingQuizGql[];

  @Field(() => [RankedCategoryGql])
  categories!: RankedCategoryGql[];

  @Field(() => [RankedTagGql])
  tags!: RankedTagGql[];
}
