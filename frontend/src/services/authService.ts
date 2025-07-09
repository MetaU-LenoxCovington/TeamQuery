import { apiClient, ApiError } from './api';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
  organizationName?: string;
}

export interface AuthResponse {
  user: {
    id: string;
    name: string;
    email: string;
    organizations: Array<{
      id: string;
      name: string;
      role: string;
      isAdmin: boolean;
    }>;
  };
  accessToken: string;
  refreshToken: string;
  defaultOrganizationId: string;
}

export interface Organization {
  id: string;
  name: string;
}

export interface OrganizationsResponse {
  organizations: Organization[];
}

class AuthService {
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/api/auth/login', credentials);

      this.storeTokens(response.accessToken, response.refreshToken);

      return response;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  async signup(userData: SignupRequest): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/api/auth/register', userData);

      this.storeTokens(response.accessToken, response.refreshToken);

      return response;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  async getUserOrganizations(email: string): Promise<Organization[]> {
    try {
      const response = await apiClient.get<OrganizationsResponse>(
        `/api/auth/organizations?email=${encodeURIComponent(email)}`
      );
      return response.organizations;
    } catch (error) {
      console.warn('Failed to fetch organizations:', error);
      return [];
    }
  }

  async refreshToken(): Promise<string> {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await apiClient.post<{ accessToken: string }>('/api/auth/refresh', {
        refreshToken,
      });

      this.storeAccessToken(response.accessToken);

      return response.accessToken;
    } catch (error) {
      this.clearTokens();
      throw this.handleAuthError(error);
    }
  }

  async logout(): Promise<void> {
    try {
      const refreshToken = this.getRefreshToken();
      if (refreshToken) {
        await apiClient.post('/api/auth/logout', { refreshToken });
      }
    } catch (error) {
      // Even if logout API fails, still want to clear local tokens
      console.warn('Logout API call failed:', error);
    } finally {
      this.clearTokens();
    }
  }

  async getCurrentUser(): Promise<AuthResponse['user']> {
    try {
      const response = await apiClient.get<{ user: AuthResponse['user'] }>('/api/auth/me');
      return response.user;
    } catch (error) {
      throw this.handleAuthError(error);
    }
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('authToken');
  }

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refreshToken');
  }

  private storeTokens(accessToken: string, refreshToken: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('authToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  }

  private storeAccessToken(accessToken: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem('authToken', accessToken);
  }

  private clearTokens(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('authToken');
    localStorage.removeItem('refreshToken');
  }

  private handleAuthError(error: unknown): Error {
    if (error instanceof ApiError) {
      // check for error codes from backend
      if (error.code) {
        switch (error.code) {
          case '1001': // INVALID_CREDENTIALS
            // Check if this is a registration context (email already exists)
            if (error.message.toLowerCase().includes('already exists')) {
              return new Error('An account with this email already exists. Please try logging in instead.');
            }
            return new Error('Invalid email or password');
          case '1002': // TOKEN_EXPIRED
            return new Error('Your session has expired. Please log in again.');
          case '1003': // TOKEN_INVALID
            return new Error('Invalid authentication token. Please log in again.');
          case '1004': // TOKEN_MISSING
            return new Error('Authentication required. Please log in.');
          case '1005': // REFRESH_TOKEN_INVALID
            return new Error('Session expired. Please log in again.');
          case '1006': // REFRESH_TOKEN_EXPIRED
            return new Error('Session expired. Please log in again.');
          case '1101': // INSUFFICIENT_PERMISSIONS
            return new Error('You do not have permission to perform this action.');
          case '1102': // ORGANIZATION_ACCESS_DENIED
            return new Error('Access denied to this organization.');
          case '1103': // DOCUMENT_ACCESS_DENIED
            return new Error('Access denied to this document.');
          case '1104': // ADMIN_REQUIRED
            return new Error('Administrator privileges required.');
          case '1105': // MEMBERSHIP_REQUIRED
            return new Error('Organization membership required.');
          case '1201': // INVALID_EMAIL
            return new Error('Please enter a valid email address.');
          case '1203': // MISSING_REQUIRED_FIELD
            return new Error('Please fill in all required fields.');
          case '1204': // INVALID_INPUT_FORMAT
            return new Error('Please check your input format and try again.');
          default:
            return new Error(error.message || 'An error occurred');
        }
      }

      // Fallback to HTTP status codes if no custom error code
      switch (error.status) {
        case 401:
          return new Error('Invalid email or password');
        case 403:
          return new Error('Access denied. Please check your permissions.');
        case 409:
          return new Error('An account with this email already exists');
        case 422:
          return new Error('Please check your input and try again');
        case 429:
          return new Error('Too many attempts. Please try again later.');
        default:
          return new Error(error.message || 'Authentication failed');
      }
    }

    if (error instanceof Error) {
      return error;
    }

    return new Error('An unexpected error occurred');
  }
}

export const authService = new AuthService();
