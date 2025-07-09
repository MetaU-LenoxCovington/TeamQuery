import { useState, useCallback } from 'react';
import { authService, LoginRequest, SignupRequest, AuthResponse, Organization } from '../services/authService';

interface UseAuthReturn {
  loading: boolean;
  error: string | null;

  login: (credentials: LoginRequest) => Promise<AuthResponse>;
  signup: (userData: SignupRequest) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  clearError: () => void;
}

interface UseOrganizationsReturn {
  organizations: Organization[];
  loading: boolean;
  error: string | null;

  fetchOrganizations: (email: string) => Promise<void>;
  clearOrganizations: () => void;
}

export const useAuth = (): UseAuthReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (credentials: LoginRequest): Promise<AuthResponse> => {
    setLoading(true);
    setError(null);

    try {
      const response = await authService.login(credentials);
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signup = useCallback(async (userData: SignupRequest): Promise<AuthResponse> => {
    setLoading(true);
    setError(null);

    try {
      const response = await authService.signup(userData);
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await authService.logout();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Logout failed';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    error,
    login,
    signup,
    logout,
    clearError,
  };
};

export const useOrganizations = (): UseOrganizationsReturn => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrganizations = useCallback(async (email: string): Promise<void> => {
    if (!email.includes('@')) {
      return; // Don't fetch if email is not valid
    }

    setLoading(true);
    setError(null);

    try {
      const orgs = await authService.getUserOrganizations(email);
      setOrganizations(orgs);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch organizations';
      setError(errorMessage);
      console.warn('Failed to fetch organizations:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearOrganizations = useCallback(() => {
    setOrganizations([]);
    setError(null);
  }, []);

  return {
    organizations,
    loading,
    error,
    fetchOrganizations,
    clearOrganizations,
  };
};

export const useAuthStatus = () => {
  const isAuthenticated = authService.isAuthenticated();
  const accessToken = authService.getAccessToken();

  return {
    isAuthenticated,
    accessToken,
  };
};
