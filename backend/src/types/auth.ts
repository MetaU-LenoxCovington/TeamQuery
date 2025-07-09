export interface AccessTokenPayload {
  userId: string;
  organizationId: string;
  role: 'ADMIN' | 'MEMBER' | 'MANAGER' | 'VIEWER';
  permissionsGroupId?: string;
  isAdmin: boolean;
  email: string;
  name: string;
  sessionId: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  userId: string;
  organizationId: string;
  tokenId: string;
  sessionId: string;
  iat: number;
  exp: number;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  organizationName?: string; // if creating a new organization
}

export interface RegisterResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    organizations: Array<{
      id: string;
      name: string;
      role: 'ADMIN' | 'MEMBER' | 'MANAGER' | 'VIEWER';
      isAdmin: boolean;
    }>;
  };
  defaultOrganizationId: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    organizations: Array<{
      id: string;
      name: string;
      role: 'ADMIN' | 'MEMBER' | 'MANAGER' | 'VIEWER';
      isAdmin: boolean;
    }>;
  };
  defaultOrganizationId: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedUser {
  userId: string;
  organizationId: string;
  role: 'ADMIN' | 'MEMBER' | 'MANAGER' | 'VIEWER';
  permissionsGroupId?: string;
  isAdmin: boolean;
  email: string;
  name: string;
  sessionId: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
  }
}
