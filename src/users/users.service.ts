import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { usersCreatedCounter } from '../otel/metrics';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly logger: Logger,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const user = this.userRepository.create(dto);
    const saved = await this.userRepository.save(user);
    usersCreatedCounter.add(1);
    this.logger.log(`Novo user ${JSON.stringify(saved)}`);
    return saved;
  }

  findAll(): Promise<User[]> {
    return this.userRepository.find({ order: { email: 'ASC' } });
  }

  async findOne(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { userId } });
    if (!user) {
      this.logger.error(`User ${userId} não encontrado`);
      throw new NotFoundException(`User ${userId} not found`);
    }
    this.logger.log(`User encontrado ${JSON.stringify(user)}`);
    return user;
  }
}
