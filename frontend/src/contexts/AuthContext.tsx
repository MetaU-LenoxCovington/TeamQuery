'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, AuthResponse, SignupRequest } from '../services/authService';
import { organizationService } from '../services/organizationService';
import { User, Organization } from '../types';

interface AuthContextType {
  user: User | null;
  currentOrganization: Organization | null;
  organizations: Organization[];
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  signup: (userData: SignupRequest) => Promise<void>;
  logout: () => Promise<void>;
  setCurrentOrganization: (organizationId: string) => void;
  clearError: () => void;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setIsLoading(true);

      if (!authService.isAuthenticated()) {
        setIsLoading(false);
        return;
      }

      const userData = await authService.getCurrentUser();

      const transformedUser: User = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        organizations: userData.organizations.map(org => ({
          id: org.id,
          name: org.name,
          role: org.role as Organization['role'],
          isAdmin: org.isAdmin
        }))
      };

      setUser(transformedUser);
      setOrganizations(transformedUser.organizations);


      if (transformedUser.organizations.length > 0) {
        setCurrentOrganization(transformedUser.organizations[0]);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
      // Clear invalid tokens
      await authService.logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const response: AuthResponse = await authService.login({ email, password });

      const transformedUser: User = {
        id: response.user.id,
        name: response.user.name,
        email: response.user.email,
        organizations: response.user.organizations.map(org => ({
          id: org.id,
          name: org.name,
          role: org.role as Organization['role'],
          isAdmin: org.isAdmin
        }))
      };

      setUser(transformedUser);
      setOrganizations(transformedUser.organizations);

      // Use first organization as default
      if (transformedUser.organizations.length > 0) {
        setCurrentOrganization(transformedUser.organizations[0]);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);
      await authService.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Clear state even if API fails
      setUser(null);
      setCurrentOrganization(null);
      setOrganizations([]);
      setError(null);
      setIsLoading(false);
    }
  };

  const handleSetCurrentOrganization = async (organizationId: string) => {
    const org = organizations.find(o => o.id === organizationId);
    if (org) {
      try {
        const orgDetails = await organizationService.getOrganizationDetails(organizationId);

        const updatedOrg: Organization = {
          ...org,
        };

        setCurrentOrganization(updatedOrg);

      } catch (error) {
        console.error('Failed to get organization details:', error);
        setCurrentOrganization(org);
      }
    }
  };

  const clearError = () => {
    setError(null);
  };

  const refreshUserData = async () => {
    if (!authService.isAuthenticated()) return;

    try {
      const userData = await authService.getCurrentUser();
      const transformedUser: User = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        organizations: userData.organizations.map(org => ({
          id: org.id,
          name: org.name,
          role: org.role as Organization['role'],
          isAdmin: org.isAdmin
        }))
      };

      setUser(transformedUser);
      setOrganizations(transformedUser.organizations);
    } catch (err) {
      console.error('Failed to refresh user data:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh user data');
    }
  };

  const signup = async (userData: SignupRequest) => {
    try {
      setIsLoading(true);
      setError(null);

      const response: AuthResponse = await authService.signup(userData);

      const transformedUser: User = {
        id: response.user.id,
        name: response.user.name,
        email: response.user.email,
        organizations: response.user.organizations.map(org => ({
          id: org.id,
          name: org.name,
          role: org.role as Organization['role'],
          isAdmin: org.isAdmin
        }))
      };

      setUser(transformedUser);
      setOrganizations(transformedUser.organizations);

      // Use first organization as default
      if (transformedUser.organizations.length > 0) {
        setCurrentOrganization(transformedUser.organizations[0]);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    currentOrganization,
    organizations,
    isAuthenticated: !!user,
    isLoading,
    error,
    login,
    signup,
    logout,
    setCurrentOrganization: handleSetCurrentOrganization,
    clearError,
    refreshUserData,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
