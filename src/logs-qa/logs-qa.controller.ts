import { Body, Controller, Post } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LogAskDto } from './dto/log-ask.dto';
import { LogAskResponseDto } from './dto/log-ask-response.dto';
import { LogsQaService } from './logs-qa.service';

@ApiTags('logs')
@Controller('logs')
export class LogsQaController {
  constructor(private readonly logsQaService: LogsQaService) {}

  @Post('ask')
  @ApiOperation({
    summary: 'Pergunta analítica em linguagem natural sobre logs embedados',
  })
  @ApiOkResponse({ type: LogAskResponseDto })
  @ApiServiceUnavailableResponse({ description: 'OPENAI_API_KEY não configurada' })
  ask(@Body() body: LogAskDto): Promise<LogAskResponseDto> {
    return this.logsQaService.ask(body.question);
  }
}
