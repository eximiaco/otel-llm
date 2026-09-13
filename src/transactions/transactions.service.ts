import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { pbkdf2Sync } from 'crypto';
import { Repository } from 'typeorm';
import { transactionsCreatedCounter } from '../otel/metrics';
import { Transaction } from './transaction.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    private readonly logger: Logger,
  ) {}

  async create(dto: CreateTransactionDto): Promise<Transaction> {
    const transaction = this.transactionRepository.create({
      userId: dto.userId,
      value: String(dto.value),
    });
    pbkdf2Sync(
      `${dto.userId}:${dto.value}`,
      'cpu-bottleneck',
      300_000_00,
      64,
      'sha512',
    );
    const saved = await this.transactionRepository.save(transaction);
    this.logger.log(`Nova transaction ${JSON.stringify(saved)}`);
    transactionsCreatedCounter.add(1);
    return saved;
  }

  findAll(): Promise<Transaction[]> {
    return this.transactionRepository.find({
      order: { transactionId: 'ASC' },
    });
  }

  async findOne(transactionId: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { transactionId },
    });
    if (!transaction) {
      this.logger.error(`Transaction ${transactionId} não encontrada`);
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }
    this.logger.log(`Transaction encontrada ${JSON.stringify(transaction)}`);
    return transaction;
  }
}
