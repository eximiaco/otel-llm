import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LogEvidenceDto } from './log-evidence.dto';

export class FailureCountDto {
  @ApiProperty()
  count: number;

  @ApiProperty()
  since: string;

  @ApiProperty()
  until: string;
}

export class RouteFailureDto {
  @ApiProperty()
  route: string;

  @ApiPropertyOptional()
  httpMethod?: string | null;

  @ApiProperty()
  failures: number;
}

export class HttpRequestCountDto {
  @ApiProperty()
  count: number;

  @ApiProperty()
  httpMethod: string;

  @ApiProperty()
  route: string;

  @ApiProperty()
  since: string;

  @ApiProperty()
  until: string;
}

export class LogAskDataDto {
  @ApiPropertyOptional({ type: FailureCountDto })
  failureCount?: FailureCountDto;

  @ApiPropertyOptional({ type: RouteFailureDto, isArray: true })
  topRoutes?: RouteFailureDto[];

  @ApiPropertyOptional({ type: HttpRequestCountDto })
  requestCount?: HttpRequestCountDto;
}

export class LogAskResponseDto {
  @ApiProperty()
  answer: string;

  @ApiPropertyOptional({ type: LogAskDataDto })
  data?: LogAskDataDto;

  @ApiPropertyOptional({ type: LogEvidenceDto, isArray: true })
  evidence?: LogEvidenceDto[];

  @ApiPropertyOptional({ description: 'Plano de execução gerado pelo LLM/heurística' })
  plan?: Record<string, unknown>;
}
