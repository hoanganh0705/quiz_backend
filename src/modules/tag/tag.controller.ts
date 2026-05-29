import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/authorization/decorators/roles.decorator';
import { ApiAuth, ApiValidationRequest } from '@/common/swagger/swagger-decorators';
import { CreateTagDto } from './dto/request/create-tag.dto';
import { ListTagsQueryDto } from './dto/request/list-tags-query.dto';
import { UpdateTagDto } from './dto/request/update-tag.dto';
import { DeleteTagResponseDto } from './dto/response/delete-tag-response.dto';
import { TagListResponseDto } from './dto/response/tag-list-response.dto';
import { TagResponseDto } from './dto/response/tag-response.dto';
import { TagApplicationService } from './application/tag.application.service';
import { TagDomainExceptionFilter } from './transport/filters/tag-domain-exception.filter';
import { TagCursorMapper } from './mappers/tag-cursor.mapper';
import type { CreateTagCommand, ListTagsQuery, UpdateTagCommand } from './domain/types/tag-commands';

@ApiTags('tags')
@Controller('tags')
@UseFilters(TagDomainExceptionFilter)
export class TagController {
  constructor(private readonly tagApplicationService: TagApplicationService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'List tags',
    description: 'Returns a paginated, cursor-based list of active tags.',
  })
  @ApiOkResponse({ description: 'Tags returned', type: TagListResponseDto })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  listTags(@Query() query: ListTagsQueryDto): Promise<TagListResponseDto> {
    const command: ListTagsQuery = {
      limit: query.limit,
      cursor: query.cursor ? TagCursorMapper.parse(query.cursor) : null,
    };

    return this.tagApplicationService.listTags(command);
  }

  @Get(':slug')
  @Public()
  @ApiOperation({
    summary: 'Get tag by slug',
    description: 'Returns a single active tag by its URL slug.',
  })
  @ApiOkResponse({ description: 'Tag found', type: TagResponseDto })
  @ApiNotFoundResponse({ description: 'Tag not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  getTagBySlug(@Param('slug') slug: string): Promise<TagResponseDto> {
    return this.tagApplicationService.getTagBySlug(slug);
  }

  @Post()
  @Roles('admin')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'Create tag',
    description: 'Creates a new quiz tag. Requires admin role.',
  })
  @ApiCreatedResponse({ description: 'Tag created', type: TagResponseDto })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiNotFoundResponse({ description: 'Tag not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  createTag(@Body() payload: CreateTagDto): Promise<TagResponseDto> {
    const command: CreateTagCommand = {
      name: payload.name,
      slug: payload.slug,
    };

    return this.tagApplicationService.createTag(command);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({
    summary: 'Update tag',
    description: 'Updates an existing tag by ID. Requires admin role.',
  })
  @ApiOkResponse({ description: 'Tag updated', type: TagResponseDto })
  @ApiNotFoundResponse({ description: 'Tag not found' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  @ApiValidationRequest()
  updateTag(
    @Param('id', new ParseUUIDPipe()) tagId: string,
    @Body() payload: UpdateTagDto,
  ): Promise<TagResponseDto> {
    const command: UpdateTagCommand = {
      name: payload.name,
      slug: payload.slug,
    };

    return this.tagApplicationService.updateTag(tagId, command);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiAuth()
  @ApiOperation({ summary: 'Delete tag', description: 'Soft-deletes a tag. Requires admin role.' })
  @ApiOkResponse({ description: 'Tag deleted', type: DeleteTagResponseDto })
  @ApiNotFoundResponse({ description: 'Tag not found' })
  @ApiInternalServerErrorResponse({ description: 'Unexpected server error' })
  deleteTag(@Param('id', new ParseUUIDPipe()) tagId: string): Promise<DeleteTagResponseDto> {
    return this.tagApplicationService.deleteTag(tagId);
  }
}
