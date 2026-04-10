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
  UseGuards,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateTagDto } from './dto/request/create-tag.dto';
import { ListTagsQueryDto } from './dto/request/list-tags-query.dto';
import { UpdateTagDto } from './dto/request/update-tag.dto';
import { DeleteTagResponseDto } from './dto/response/delete-tag-response.dto';
import { TagListResponseDto } from './dto/response/tag-list-response.dto';
import { TagResponseDto } from './dto/response/tag-response.dto';
import { TagService } from './tag.service';

@Controller('tags')
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Get()
  @Public()
  listTags(@Query() query: ListTagsQueryDto): Promise<TagListResponseDto> {
    return this.tagService.listActiveTags(query);
  }

  @Get(':slug')
  @Public()
  getTagBySlug(@Param('slug') slug: string): Promise<TagResponseDto> {
    return this.tagService.getActiveTagBySlug(slug);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  createTag(@Body() payload: CreateTagDto): Promise<TagResponseDto> {
    return this.tagService.createTag(payload);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  updateTag(
    @Param('id', new ParseUUIDPipe()) tagId: string,
    @Body() payload: UpdateTagDto,
  ): Promise<TagResponseDto> {
    return this.tagService.updateTagById(tagId, payload);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  deleteTag(@Param('id', new ParseUUIDPipe()) tagId: string): Promise<DeleteTagResponseDto> {
    return this.tagService.softDeleteTagById(tagId);
  }
}
