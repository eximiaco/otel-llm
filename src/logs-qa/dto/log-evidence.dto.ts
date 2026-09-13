import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LogEvidenceDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  lokiTs: string;

  @ApiProperty()
  level: string;

  @ApiProperty()
  service: string;

  @ApiPropertyOptional()
  route?: string;

  @ApiPropertyOptional()
  httpMethod?: string;

  @ApiPropertyOptional()
  statusCode?: number;

  @ApiPropertyOptional()
  traceId?: string;

  @ApiPropertyOptional()
  score?: number;
}
