import { Injectable } from '@nestjs/common';
import { TagDomainService } from '../domain/tag.service';
import { TagResponseMapper } from '../mappers/tag-response.mapper';
import { TagCursorMapper } from '../mappers/tag-cursor.mapper';
import type { TagListResponseDto } from '../dto/response/tag-list-response.dto';
import type { TagResponseDto } from '../dto/response/tag-response.dto';
import type { DeleteTagResponseDto } from '../dto/response/delete-tag-response.dto';
import type { CreateTagCommand, ListTagsQuery, UpdateTagCommand } from '../domain/types/tag-commands';

@Injectable()
export class TagApplicationService {
  constructor(private readonly tagDomainService: TagDomainService) {}

  async listTags(query: ListTagsQuery): Promise<TagListResponseDto> {
    const { items, limit, hasNextPage, nextCursor } = await this.tagDomainService.listTags(query);

    return {
      items: items.map((item) => TagResponseMapper.toResponse(item)),
      pagination: {
        limit,
        hasNextPage,
        nextCursor: nextCursor ? TagCursorMapper.serialize(nextCursor) : null,
      },
    };
  }

  async getTagBySlug(slug: string): Promise<TagResponseDto> {
    const row = await this.tagDomainService.getTagBySlug(slug);
    return TagResponseMapper.toResponse(row);
  }

  async createTag(payload: CreateTagCommand): Promise<TagResponseDto> {
    const row = await this.tagDomainService.createTag(payload);
    return TagResponseMapper.toResponse(row);
  }

  async updateTag(tagId: string, payload: UpdateTagCommand): Promise<TagResponseDto> {
    const row = await this.tagDomainService.updateTag(tagId, payload);
    return TagResponseMapper.toResponse(row);
  }

  async deleteTag(tagId: string): Promise<DeleteTagResponseDto> {
    await this.tagDomainService.deleteTag(tagId);
    return { message: 'Tag deleted successfully' };
  }
}
