import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ListRecentBookmarksQueryDto } from './list-recent-bookmarks-query.dto';
import { SearchBookmarksQueryDto } from './search-bookmarks-query.dto';

export class CreateCollectionDto {
  @ApiProperty({
    description: 'Collection name',
    minLength: 1,
    maxLength: 100,
    example: 'My Favorite Quizzes',
  })
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({
    description: 'Collection description',
    maxLength: 500,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}

export class UpdateCollectionDto {
  @ApiPropertyOptional({
    description: 'Updated collection name',
    minLength: 1,
    maxLength: 100,
    example: 'My Favorite Quizzes',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated collection description',
    maxLength: 500,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}

export class AddBookmarkDto {
  @ApiProperty({
    description: 'UUID of the quiz to bookmark',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  quizId!: string;

  @ApiPropertyOptional({
    description: 'Personal notes about the quiz',
    maxLength: 500,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class BulkAddBookmarksDto {
  @ApiProperty({
    description: 'List of quiz UUIDs to add to the collection. Maximum 100 items.',
    type: [String],
    maxItems: 100,
    example: [
      '660e8400-e29b-41d4-a716-446655440000',
      '660e8400-e29b-41d4-a716-446655440001',
    ],
  })
  @Type(() => String)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  quizIds!: string[];
}

export class BulkRemoveBookmarksDto {
  @ApiProperty({
    description: 'List of quiz UUIDs to remove from the collection. Maximum 100 items.',
    type: [String],
    maxItems: 100,
    example: [
      '660e8400-e29b-41d4-a716-446655440000',
      '660e8400-e29b-41d4-a716-446655440001',
    ],
  })
  @Type(() => String)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  quizIds!: string[];
}

export class MoveBookmarkDto {
  @ApiProperty({
    description: 'UUID of the quiz to move',
    format: 'uuid',
    example: '660e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4')
  quizId!: string;

  @ApiProperty({
    description: 'UUID of the destination collection',
    format: 'uuid',
    example: '770e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID('4')
  targetCollectionId!: string;
}

export class UpdateBookmarkDto {
  @ApiPropertyOptional({
    description: 'Updated personal notes about the quiz',
    maxLength: 500,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export { ListRecentBookmarksQueryDto, SearchBookmarksQueryDto };
