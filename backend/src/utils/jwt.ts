import jwt from 'jsonwebtoken';
import { AccessTokenPayload, RefreshTokenPayload } from '../types/auth';
import { AuthError } from './errors';

export class JWTUtils {
  private static ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
  private static REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
  private static ACCESS_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '30m';
  private static REFRESH_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

  static {
    if (!this.ACCESS_SECRET || !this.REFRESH_SECRET) {
      throw new Error('JWT secrets not defined');
    }
  }

  static generateAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.ACCESS_SECRET!, {
      expiresIn: this.ACCESS_EXPIRES_IN,
    } as any);
  }

  static generateRefreshToken(payload: Omit<RefreshTokenPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.REFRESH_SECRET!, {
      expiresIn: this.REFRESH_EXPIRES_IN,
    } as any);
  }

  static verifyAccessToken(token: string): AccessTokenPayload {
    try {
      return jwt.verify(token, this.ACCESS_SECRET!) as AccessTokenPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw AuthError.tokenExpired();
      }
      throw AuthError.tokenInvalid();
    }
  }

  static verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      return jwt.verify(token, this.REFRESH_SECRET!) as RefreshTokenPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw AuthError.refreshTokenExpired();
      }
      throw AuthError.refreshTokenInvalid();
    }
  }
}
