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

export class SearchDiscussionResultDto {
  @ApiProperty({
    description: 'Discussion thread identifier',
    example: '770e8400-e29b-71d4-a716-446655440000',
  })
  threadId!: string;

  @ApiProperty({ description: 'Thread title', example: 'How to structure providers in NestJS?' })
  title!: string;
}

export class SearchResponseDto {
  @ApiProperty({ description: 'The query string echoed back as performed', example: 'nestjs' })
  query!: string;

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

  @ApiProperty({
    description: 'Matching discussion threads, ordered by relevance',
    type: () => [SearchDiscussionResultDto],
  })
  discussions!: SearchDiscussionResultDto[];
}
