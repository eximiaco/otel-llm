import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseUUIDPipe,
  Logger,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { TransactionResponseDto } from './dto/transaction-response.dto';

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly logger: Logger,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar transações' })
  @ApiOkResponse({ type: TransactionResponseDto, isArray: true })
  findAll() {
    this.logger.log(`GET: /transactions`);
    return this.transactionsService.findAll();
  }

  @Get(':transactionId')
  @ApiOperation({ summary: 'Buscar transação por ID' })
  @ApiParam({ name: 'transactionId', format: 'uuid' })
  @ApiOkResponse({ type: TransactionResponseDto })
  @ApiNotFoundResponse({ description: 'Transação não encontrada' })
  findOne(@Param('transactionId', ParseUUIDPipe) transactionId: string) {
    this.logger.log(`GET: /transactions/${transactionId}`);
    return this.transactionsService.findOne(transactionId);
  }

  @Post()
  @ApiOperation({ summary: 'Criar transação' })
  @ApiCreatedResponse({ type: TransactionResponseDto })
  create(@Body() dto: CreateTransactionDto) {
    this.logger.log(`POST: /transactions`);
    return this.transactionsService.create(dto);
  }
}
