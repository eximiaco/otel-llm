import { ApiProperty } from '@nestjs/swagger';

export class TransactionResponseDto {
  @ApiProperty({ format: 'uuid' })
  transactionId: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ example: '100.50' })
  value: string;
}
