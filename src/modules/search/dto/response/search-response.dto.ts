import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchUserResultDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  userId!: string;

  @ApiProperty({ example: 'nestjs_dev' })
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
  @ApiProperty({ example: '660e8400-e29b-41d4-a716-446655440000' })
  quizId!: string;

  @ApiProperty({ example: 'Advanced NestJS Patterns' })
  title!: string;

  @ApiProperty({ example: 'advanced-nestjs-patterns' })
  slug!: string;
}

export class SearchDiscussionResultDto {
  @ApiProperty({ example: '770e8400-e29b-41d4-a716-446655440000' })
  threadId!: string;

  @ApiProperty({ example: 'How to structure providers in NestJS?' })
  title!: string;
}

export class SearchResponseDto {
  @ApiProperty({ example: 'nestjs' })
  query!: string;

  @ApiProperty({ type: () => [SearchUserResultDto] })
  users!: SearchUserResultDto[];

  @ApiProperty({ type: () => [SearchQuizResultDto] })
  quizzes!: SearchQuizResultDto[];

  @ApiProperty({ type: () => [SearchDiscussionResultDto] })
  discussions!: SearchDiscussionResultDto[];
}
