/**
 * Quiz directory resolver.
 *
 * Thin transport adapter over the bundle service: it validates nothing the
 * service already guarantees and owns no listing rules, so REST and GraphQL
 * stay behaviourally identical.
 */
import { Args, Query, Resolver } from '@nestjs/graphql';

import { QuizzesBundleService } from '@/modules/quiz/application/quizzes-bundle.service';
import { Public } from '@/common/decorators/public.decorator';
import { toQuizzesBundleFilters, QuizzesBundleArgsGql } from './quiz.graphql.args';
import { presentQuizzesBundle, type PresentedQuizzesBundle } from './quiz.graphql.presenter';
import { QuizzesBundleGql } from './quiz.graphql.types';

@Resolver()
export class QuizGraphqlResolver {
  constructor(private readonly quizzesBundleService: QuizzesBundleService) {}

  @Query(() => QuizzesBundleGql, {
    name: 'quizzesBundle',
    description: 'Filtered quiz page together with the taxonomy rails that frame it.',
  })
  @Public()
  async quizzesBundle(@Args() args: QuizzesBundleArgsGql): Promise<PresentedQuizzesBundle> {
    const bundle = await this.quizzesBundleService.getBundle({
      filters: toQuizzesBundleFilters(args),
      railLimit: args.railLimit,
    });
    return presentQuizzesBundle(bundle);
  }
}
