import { ApiProperty } from '@nestjs/swagger';
import { LeaderboardEntryDto } from '@/modules/ranking/dto/response/leaderboard-entry.dto';
import { QuizListItemDto } from '@/modules/quiz/dto/response/quiz-list-item.dto';
import {
  TrendingQuizItemDto,
  PopularQuizItemDto,
} from '@/modules/quiz/dto/response/quiz-analytics.dto';
import { CategoryResponseDto } from '@/modules/category/dto/response/category-response.dto';
import { RecentWinnersResponseDto } from '@/modules/ranking/dto/response/recent-winners-response.dto';

export class HomeBundleResponseDto {
  @ApiProperty({
    description: 'Editorially curated featured quizzes (max 12)',
    type: () => [QuizListItemDto],
  })
  featured!: QuizListItemDto[];

  @ApiProperty({
    description: 'Trending quizzes (max 10)',
    type: () => [TrendingQuizItemDto],
  })
  trending!: TrendingQuizItemDto[];

  @ApiProperty({
    description: 'Popular quizzes (max 10)',
    type: () => [PopularQuizItemDto],
  })
  popular!: PopularQuizItemDto[];

  @ApiProperty({
    description: 'Top-level categories (max 20)',
    type: () => [CategoryResponseDto],
  })
  categories!: CategoryResponseDto[];

  @ApiProperty({
    description: 'Recent tournament winners (last 10)',
    type: () => RecentWinnersResponseDto,
  })
  recentWinners!: RecentWinnersResponseDto;

  @ApiProperty({
    description: 'Top 5 weekly players',
    type: () => [LeaderboardEntryDto],
  })
  topPlayers!: LeaderboardEntryDto[];
}
