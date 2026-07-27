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
    description: 'Matching comments, ordered by relevance',
    type: () => [SearchCommentResultDto],
  })
  commentss!: SearchCommentResultDto[];

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
