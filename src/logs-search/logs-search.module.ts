import { Module } from '@nestjs/common';
import { LogsSearchController } from './logs-search.controller';
import {
  createEmbeddingService,
  EMBEDDING_SERVICE,
  LogsSearchService,
} from './logs-search.service';

@Module({
  controllers: [LogsSearchController],
  providers: [
    LogsSearchService,
    {
      provide: EMBEDDING_SERVICE,
      useFactory: () => createEmbeddingService(),
    },
  ],
  exports: [LogsSearchService, EMBEDDING_SERVICE],
})
export class LogsSearchModule {}
