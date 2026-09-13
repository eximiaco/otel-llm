import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LogSearchHitDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  lokiTs: string;

  @ApiPropertyOptional()
  traceId?: string;

  @ApiProperty()
  service: string;

  @ApiProperty()
  level: string;

  @ApiProperty({ description: 'Similaridade cosseno (0 a 1, maior = mais relevante)' })
  score: number;
}
