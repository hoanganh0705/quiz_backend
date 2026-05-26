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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { Roles } from '@/common/authorization/decorators/roles.decorator';
import { CreateTagDto } from './dto/request/create-tag.dto';
import { ListTagsQueryDto } from './dto/request/list-tags-query.dto';
import { UpdateTagDto } from './dto/request/update-tag.dto';
import { DeleteTagResponseDto } from './dto/response/delete-tag-response.dto';
import { TagListResponseDto } from './dto/response/tag-list-response.dto';
import { TagResponseDto } from './dto/response/tag-response.dto';
import { TagService } from './tag.service';

@ApiTags('tags')
@Controller('tags')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'List tags',
    description: 'Returns a paginated, cursor-based list of active tags.',
  })
  @ApiOkResponse({ description: 'Tags returned', type: TagListResponseDto })
  listTags(@Query() query: ListTagsQueryDto): Promise<TagListResponseDto> {
    return this.tagService.listActiveTags(query);
  }

  @Get(':slug')
  @Public()
  @ApiOperation({
    summary: 'Get tag by slug',
    description: 'Returns a single active tag by its URL slug.',
  })
  @ApiOkResponse({ description: 'Tag found', type: TagResponseDto })
  @ApiNotFoundResponse({ description: 'Tag not found' })
  getTagBySlug(@Param('slug') slug: string): Promise<TagResponseDto> {
    return this.tagService.getActiveTagBySlug(slug);
  }

  @Post()
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create tag',
    description: 'Creates a new quiz tag. Requires admin role.',
  })
  @ApiCreatedResponse({ description: 'Tag created', type: TagResponseDto })
  createTag(@Body() payload: CreateTagDto): Promise<TagResponseDto> {
    return this.tagService.createTag(payload);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update tag',
    description: 'Updates an existing tag by ID. Requires admin role.',
  })
  @ApiOkResponse({ description: 'Tag updated', type: TagResponseDto })
  @ApiNotFoundResponse({ description: 'Tag not found' })
  updateTag(
    @Param('id', new ParseUUIDPipe()) tagId: string,
    @Body() payload: UpdateTagDto,
  ): Promise<TagResponseDto> {
    return this.tagService.updateTagById(tagId, payload);
  }

  @Delete(':id')
  @Roles('admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete tag', description: 'Soft-deletes a tag. Requires admin role.' })
  @ApiOkResponse({ description: 'Tag deleted', type: DeleteTagResponseDto })
  @ApiNotFoundResponse({ description: 'Tag not found' })
  deleteTag(@Param('id', new ParseUUIDPipe()) tagId: string): Promise<DeleteTagResponseDto> {
    return this.tagService.softDeleteTagById(tagId);
  }
}
