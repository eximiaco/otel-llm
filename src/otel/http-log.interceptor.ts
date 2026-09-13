import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';

@Injectable()
export class HttpLogInterceptor implements NestInterceptor {
  constructor(private readonly logger: Logger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const started = Date.now();

    const route =
      (req.route as { path?: string } | undefined)?.path ??
      req.url.split('?')[0];

    return next.handle().pipe(
      tap({
        next: () => this.logRequest(req.method, route, res.statusCode, started),
        error: () => this.logRequest(req.method, route, res.statusCode || 500, started),
      }),
    );
  }

  private logRequest(
    method: string,
    route: string,
    status: number,
    started: number,
  ): void {
    const durationMs = Date.now() - started;
    const level = status >= 500 ? 'error' : 'log';
    const line = `http_request method=${method} route=${route} status=${status} duration_ms=${durationMs}`;
    if (level === 'error') {
      this.logger.error(line, undefined, 'HttpRequest');
    } else {
      this.logger.log(line, 'HttpRequest');
    }
  }
}
