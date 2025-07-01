export const ERROR_CODES = {
    INVALID_CREDENTIALS: 1001,
		TOKEN_EXPIRED: 1002,
		TOKEN_INVALID: 1003,
		TOKEN_MISSING: 1004,
		REFRESH_TOKEN_INVALID: 1005,
  };

export abstract class BaseError extends Error {
  public readonly code: number;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: number,
    statusCode: number,
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
    };
  }
}

export class AuthError extends BaseError {
  constructor(message: string, code: number = ERROR_CODES.INVALID_CREDENTIALS) {
    super(message, code, 401);
  }

  static invalidCredentials(message: string = 'Invalid email or password') {
    return new AuthError(message, ERROR_CODES.INVALID_CREDENTIALS);
  }

  static tokenExpired(message: string = 'Access token has expired') {
    return new AuthError(message, ERROR_CODES.TOKEN_EXPIRED);
  }

  static tokenInvalid(message: string = 'Invalid access token') {
    return new AuthError(message, ERROR_CODES.TOKEN_INVALID);
  }

	static tokenMissing(message: string = 'Access token is required') {
    return new AuthError(message, ERROR_CODES.TOKEN_MISSING);
  }

	static refreshTokenInvalid(message: string = 'Invalid refresh token') {
    return new AuthError(message, ERROR_CODES.REFRESH_TOKEN_INVALID);
  }

}
