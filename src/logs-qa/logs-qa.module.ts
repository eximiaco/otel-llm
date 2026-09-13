import { Module } from '@nestjs/common';
import { LogsSearchModule } from '../logs-search/logs-search.module';
import { LogAnalyticsRepository } from './log-analytics.repository';
import { LogRagService } from './log-rag.service';
import { LogsAnswerService } from './logs-answer.service';
import { LogsQaController } from './logs-qa.controller';
import { LogsQaService } from './logs-qa.service';
import { OpenAiCompatibleController } from './openai-compatible.controller';
import { QueryPlannerService } from './query-planner.service';

@Module({
  imports: [LogsSearchModule],
  controllers: [LogsQaController, OpenAiCompatibleController],
  providers: [
    LogsQaService,
    QueryPlannerService,
    LogAnalyticsRepository,
    LogRagService,
    LogsAnswerService,
  ],
})
export class LogsQaModule {}
