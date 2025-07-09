import { Request, Response, NextFunction } from 'express';
import { BaseError, AuthError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // handle custom errors
  if (error instanceof BaseError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        timestamp: error.timestamp.toISOString(),
        ...(error instanceof ValidationError && {
          field: error.field,
          value: error.value,
        }),
      },
    });
    return;
  }

  if (error.name === 'PrismaClientKnownRequestError') {
    const prismaError = error as any;

    if (prismaError.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: {
          name: 'ConflictError',
          message: 'A record with this information already exists',
          code: 2002,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    if (prismaError.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: {
          name: 'NotFoundError',
          message: 'The requested resource was not found',
          code: 2025,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }
  }

  if (error.name === 'JsonWebTokenError') {
    const authError = AuthError.tokenInvalid('Invalid token format');
    res.status(authError.statusCode).json({
      success: false,
      error: authError.toJSON(),
    });
    return;
  }

  if (error.name === 'TokenExpiredError') {
    const authError = AuthError.tokenExpired();
    res.status(authError.statusCode).json({
      success: false,
      error: authError.toJSON(),
    });
    return;
  }

  if (error.name === 'ValidationError' && !(error instanceof ValidationError)) {
    res.status(400).json({
      success: false,
      error: {
        name: 'ValidationError',
        message: error.message,
        code: 1204,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  logger.error('Unexpected error:', error);

  res.status(500).json({
    success: false,
    error: {
      name: 'InternalServerError',
      message: 'An unexpected error occurred',
      code: 5000,
      timestamp: new Date().toISOString(),
    },
  });
};
