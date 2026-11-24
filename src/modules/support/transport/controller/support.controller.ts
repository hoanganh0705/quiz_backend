import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiExtraModels, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { SupportService } from '../../application/support.service';
import {
  ContactFormDto,
  ContactFormResponseDto,
  FaqCategoryDto,
  SupportArticleDto,
} from '../../dto/support.dto';

@ApiTags('Support')
@ApiExtraModels(FaqCategoryDto, SupportArticleDto, ContactFormResponseDto)
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get('faqs')
  @Public()
  @ApiOperation({ summary: 'Get list of frequently asked questions grouped by category' })
  @ApiOkResponse({
    description: 'Frequently asked questions categories returned successfully',
    type: [FaqCategoryDto],
  })
  getFaqs(): FaqCategoryDto[] {
    return this.supportService.getFaqs();
  }

  @Get('articles')
  @Public()
  @ApiOperation({ summary: 'Get list of support knowledge base articles' })
  @ApiOkResponse({
    description: 'Support articles returned successfully',
    type: [SupportArticleDto],
  })
  getArticles(): SupportArticleDto[] {
    return this.supportService.getArticles();
  }

  @Get('articles/:slug')
  @Public()
  @ApiOperation({ summary: 'Get details of a single support article by slug' })
  @ApiOkResponse({
    description: 'Support article returned successfully',
    type: SupportArticleDto,
  })
  @ApiNotFoundResponse({ description: 'Article not found' })
  getArticleBySlug(@Param('slug') slug: string): SupportArticleDto {
    return this.supportService.getArticleBySlug(slug);
  }

  @Post('contact')
  @Public()
  @ApiOperation({ summary: 'Submit a support contact form inquiry' })
  @ApiOkResponse({
    description: 'Support ticket successfully submitted',
    type: ContactFormResponseDto,
  })
  submitContact(@Body() dto: ContactFormDto): ContactFormResponseDto {
    return this.supportService.submitContact(dto);
  }
}
