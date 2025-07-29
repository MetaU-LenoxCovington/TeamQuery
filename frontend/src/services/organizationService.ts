import { apiClient } from './api';
import { Organization } from '../types';

export interface OrganizationDetails {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  memberCount: number;
  documentCount: number;
  groupCount: number;
}

export interface OrganizationMember {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'MEMBER';
  isAdmin: boolean;
  joinedAt: string;
  lastActive?: string;
}

export interface OrganizationCreateRequest {
  name: string;
  description?: string;
}

export interface OrganizationUpdateRequest {
  name?: string;
  description?: string;
}

class OrganizationService {
  async createOrganization(data: OrganizationCreateRequest): Promise<Organization> {
    const response = await apiClient.post<{ success: boolean; data: Organization }>(
      '/api/organizations',
      data
    );
    return response.data;
  }

  async getOrganizationDetails(organizationId: string): Promise<OrganizationDetails> {
    const response = await apiClient.get<{ success: boolean; data: OrganizationDetails }>(
      `/api/organizations/${organizationId}/details`
    );
    return response.data;
  }

  async updateOrganization(organizationId: string, updates: OrganizationUpdateRequest): Promise<OrganizationDetails> {
    const response = await apiClient.put<{ success: boolean; data: OrganizationDetails }>(
      `/api/organizations/${organizationId}`,
      updates
    );
    return response.data;
  }

  async getOrganizationMembers(organizationId: string): Promise<OrganizationMember[]> {
    const response = await apiClient.get<{ success: boolean; data: OrganizationMember[] }>(
      `/api/organizations/${organizationId}/members`
    );
    return response.data;
  }

  async removeMember(organizationId: string, memberId: string): Promise<void> {
    await apiClient.delete<{ success: boolean; message: string }>(
      `/api/organizations/${organizationId}/members/${memberId}`
    );
  }

  async updateMemberRole(organizationId: string, memberId: string, role: OrganizationMember['role']): Promise<OrganizationMember> {
    const response = await apiClient.put<{ success: boolean; data: OrganizationMember }>(
      `/api/organizations/${organizationId}/members/${memberId}/role`,
      { role }
    );
    return response.data;
  }

  async getUserOrganizations(): Promise<Organization[]> {
    const response = await apiClient.get<{ user: { organizations: Organization[] } }>('/api/auth/me');
    return response.user.organizations;
  }

  async inviteMember(organizationId: string, email: string, role: OrganizationMember['role'] = 'MEMBER'): Promise<void> {
    await apiClient.post<{ success: boolean; message: string }>(
      `/api/organizations/${organizationId}/invitations`,
      {
        email,
        role
      }
    );
  }
}

export const organizationService = new OrganizationService();
