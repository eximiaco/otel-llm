import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LogSearchHitDto } from './dto/log-search-hit.dto';
import { LogSearchQueryDto } from './dto/log-search-query.dto';
import { LogsSearchService } from './logs-search.service';

@ApiTags('logs')
@Controller('logs')
export class LogsSearchController {
  constructor(private readonly logsSearchService: LogsSearchService) {}

  @Get('search')
  @ApiOperation({ summary: 'Busca semântica em logs embedados' })
  @ApiOkResponse({ type: LogSearchHitDto, isArray: true })
  @ApiServiceUnavailableResponse({ description: 'OPENAI_API_KEY não configurada' })
  search(@Query() query: LogSearchQueryDto): Promise<LogSearchHitDto[]> {
    return this.logsSearchService.search(query.q, query.limit ?? 10);
  }
}
