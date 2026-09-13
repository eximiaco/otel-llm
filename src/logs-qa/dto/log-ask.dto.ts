import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class LogAskDto {
  @ApiProperty({
    example: 'quantas falhas houveram no último minuto?',
  })
  @IsString()
  @MinLength(1)
  question: string;
}
