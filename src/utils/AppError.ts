export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly field: string | null;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    field: string | null = null,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.field = field;
    this.isOperational = true;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(message: string, code: string = 'BAD_REQUEST', field: string | null = null) {
    return new AppError(message, 400, code, field);
  }

  static unauthorized(message: string, code: string = 'UNAUTHORIZED') {
    return new AppError(message, 401, code);
  }

  static forbidden(message: string, code: string = 'FORBIDDEN') {
    return new AppError(message, 403, code);
  }

  static notFound(message: string = 'Resource not found', code: string = 'NOT_FOUND') {
    return new AppError(message, 404, code);
  }

  static conflict(message: string, code: string = 'CONFLICT') {
    return new AppError(message, 409, code);
  }

  static validation(message: string, field: string | null = null) {
    return new AppError(message, 422, 'VALIDATION_ERROR', field);
  }

  static tooManyRequests(message: string = 'Too many requests') {
    return new AppError(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}
