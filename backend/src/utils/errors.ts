export const ERROR_CODES = {
    INVALID_CREDENTIALS: 1001,
		TOKEN_EXPIRED: 1002,
		TOKEN_INVALID: 1003,
		TOKEN_MISSING: 1004,
		REFRESH_TOKEN_INVALID: 1005,
		REFRESH_TOKEN_EXPIRED: 1006,

		INSUFFICIENT_PERMISSIONS: 1101,
		ORGANIZATION_ACCESS_DENIED: 1102,
		DOCUMENT_ACCESS_DENIED: 1103,
		ADMIN_REQUIRED: 1104,
		MEMBERSHIP_REQUIRED: 1105,
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

	static refreshTokenExpired(message: string = 'Refresh token has expired') {
    return new AuthError(message, ERROR_CODES.REFRESH_TOKEN_EXPIRED);
  }

}

export class PermissionError extends BaseError {
  constructor(message: string, code: number = ERROR_CODES.INSUFFICIENT_PERMISSIONS) {
    super(message, code, 403);
  }

  static insufficientPermissions(message: string = 'Insufficient permissions to perform this action') {
    return new PermissionError(message, ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  }

	static organizationAccessDenied(message: string = 'Access denied to this organization') {
    return new PermissionError(message, ERROR_CODES.ORGANIZATION_ACCESS_DENIED);
  }

  static documentAccessDenied(message: string = 'Access denied to this document') {
    return new PermissionError(message, ERROR_CODES.DOCUMENT_ACCESS_DENIED);
  }

	static adminRequired(message: string = 'Administrator privileges required') {
    return new PermissionError(message, ERROR_CODES.ADMIN_REQUIRED);
  }

	static membershipRequired(message: string = 'Organization membership required') {
    return new PermissionError(message, ERROR_CODES.MEMBERSHIP_REQUIRED);
  }

}
