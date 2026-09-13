import { Controller, Get, Logger } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('app')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly logger: Logger,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiOkResponse({ description: 'Mensagem de boas-vindas', type: String })
  getHello(): string {
    this.logger.log('GET /');
    return this.appService.getHello();
  }
}
