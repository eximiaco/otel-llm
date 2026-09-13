import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { TransactionsModule } from './transactions/transactions.module';
import { User } from './users/user.entity';
import { Transaction } from './transactions/transaction.entity';
import { TraceLoggerModule } from './otel/trace-logger.module';
import { LogsSearchModule } from './logs-search/logs-search.module';
import { LogsQaModule } from './logs-qa/logs-qa.module';
import { HttpLogInterceptor } from './otel/http-log.interceptor';

@Module({
  providers: [
    AppService,
    { provide: APP_INTERCEPTOR, useClass: HttpLogInterceptor },
  ],
  imports: [
    TraceLoggerModule,
    LogsSearchModule,
    LogsQaModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USER ?? 'admin',
      password: process.env.DB_PASSWORD ?? '123456',
      database: process.env.DB_NAME ?? 'eximia_otel',
      entities: [User, Transaction],
      synchronize: false,
    }),
    UsersModule,
    TransactionsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
