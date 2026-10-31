import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as any;

    const errorBody = {
      statusCode: status,
      message:
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : exceptionResponse.message || 'An error occurred',
      error:
        typeof exceptionResponse === 'string'
          ? exception.name
          : exceptionResponse.error || HttpStatus[status],
      details:
        typeof exceptionResponse === 'object' && exceptionResponse.details
          ? exceptionResponse.details
          : undefined,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url} - ${status}`, exception.stack);
    }

    response.status(status).json(errorBody);
  }
}
