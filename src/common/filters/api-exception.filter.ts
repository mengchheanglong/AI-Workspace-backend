import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload: unknown =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const record =
      typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};
    const requestId = String(response.getHeader('x-request-id') ?? 'unavailable');
    const codes: Record<number, string> = {
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHENTICATED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      413: 'PAYLOAD_TOO_LARGE',
      415: 'UNSUPPORTED_MEDIA_TYPE',
      429: 'RATE_LIMITED',
      503: 'SERVICE_UNAVAILABLE',
    };
    if (status >= 500) {
      this.logger.error({ requestId, status, method: request.method, message: 'Request failed' });
    }
    response.status(status).json({
      error: {
        code: (typeof record.code === 'string' ? record.code : codes[status]) ?? 'INTERNAL_ERROR',
        message:
          status >= 500
            ? 'Service temporarily unavailable.'
            : typeof record.message === 'string'
              ? record.message
              : 'Request could not be processed.',
        ...(Array.isArray(record.details) ? { details: record.details } : {}),
        requestId,
      },
    });
  }
}
