import { Global, Module } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { TraceLogger } from './trace.logger';

@Global()
@Module({
  providers: [{ provide: Logger, useClass: TraceLogger }],
  exports: [Logger],
})
export class TraceLoggerModule {}
