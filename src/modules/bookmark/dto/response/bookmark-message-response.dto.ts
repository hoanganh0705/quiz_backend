import { ApiProperty } from '@nestjs/swagger';

export class RemoveBookmarkResponseDto {
  @ApiProperty({ description: 'Removal confirmation', example: 'Bookmark removed successfully' })
  message!: string;
}

export class MoveBookmarkResponseDto {
  @ApiProperty({ description: 'Move confirmation', example: 'Bookmark moved successfully' })
  message!: string;
}
