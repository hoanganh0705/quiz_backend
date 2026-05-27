import { Injectable } from '@nestjs/common';
import { TagDomainService } from '../domain/tag.service';
import { TagResponseMapper } from '../mappers/tag-response.mapper';
import { CreateTagDto } from '../dto/request/create-tag.dto';
import { UpdateTagDto } from '../dto/request/update-tag.dto';
import { ListTagsQueryDto } from '../dto/request/list-tags-query.dto';
import type { TagListResponseDto } from '../dto/response/tag-list-response.dto';
import type { TagResponseDto } from '../dto/response/tag-response.dto';
import type { DeleteTagResponseDto } from '../dto/response/delete-tag-response.dto';

@Injectable()
export class TagApplicationService {
  constructor(private readonly tagDomainService: TagDomainService) {}

  async listTags(query: ListTagsQueryDto): Promise<TagListResponseDto> {
    const { items, limit, hasNextPage, nextCursor } = await this.tagDomainService.listTags(query);

    return {
      items: items.map((item) => TagResponseMapper.toResponse(item)),
      pagination: { limit, hasNextPage, nextCursor },
    };
  }

  async getTagBySlug(slug: string): Promise<TagResponseDto> {
    const row = await this.tagDomainService.getTagBySlug(slug);
    return TagResponseMapper.toResponse(row);
  }

  async createTag(payload: CreateTagDto): Promise<TagResponseDto> {
    const row = await this.tagDomainService.createTag(payload);
    return TagResponseMapper.toResponse(row);
  }

  async updateTag(tagId: string, payload: UpdateTagDto): Promise<TagResponseDto> {
    const row = await this.tagDomainService.updateTag(tagId, payload);
    return TagResponseMapper.toResponse(row);
  }

  async deleteTag(tagId: string): Promise<DeleteTagResponseDto> {
    await this.tagDomainService.deleteTag(tagId);
    return { message: 'Tag deleted successfully' };
  }
}
