import { Controller, Get } from '@nestjs/common';
import { ApiExtraModels, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { ApiOkResource } from '@/common/swagger/api-ok';

import { HomeApplicationService } from '../../application/home.application.service';
import { HomePresenter } from '../presenter/home.presenter';
import { HomeBundleResponseDto } from '../../dto/response/home-bundle-response.dto';
import { HomeSwaggerDecorators } from '../swagger/home-swagger-decorators';

@ApiTags('Home')
@ApiExtraModels(HomeBundleResponseDto)
@Controller('home')
export class HomeController {
  constructor(
    private readonly homeApplicationService: HomeApplicationService,
    private readonly presenter: HomePresenter,
  ) {}

  @Get()
  @Public()
  @HomeSwaggerDecorators.GetBundle()
  @ApiOkResource(HomeBundleResponseDto, { description: 'Home bundle returned' })
  async getBundle() {
    const result = await this.homeApplicationService.getBundle();
    return this.presenter.getBundle(result);
  }
}
