import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsPositive, IsUUID } from 'class-validator';

export class CreateTransactionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  userId: string;

  @ApiProperty({ example: 100.5 })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  value: number;
}
