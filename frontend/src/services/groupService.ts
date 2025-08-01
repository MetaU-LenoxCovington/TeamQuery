import { apiClient } from './api';

export interface Group {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
}

export interface GroupCreateRequest {
  name: string;
  description?: string;
}

export interface GroupUpdateRequest {
  name?: string;
  description?: string;
}

export interface GroupMember {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'MEMBER';
  joinedAt: string;
}

export interface GroupMembershipRequest {
  userIds: string[];
}

export interface GroupListResponse {
  success: boolean;
  data: Group[];
}

export interface GroupResponse {
  success: boolean;
  data: Group;
}

export interface GroupMembersResponse {
  success: boolean;
  data: GroupMember[];
}

class GroupService {
  async getGroups(organizationId: string): Promise<Group[]> {
    const response = await apiClient.get<GroupListResponse>(
      `/api/organizations/${organizationId}/groups`
    );
    return response.data;
  }

  async createGroup(organizationId: string, data: GroupCreateRequest): Promise<Group> {
    const response = await apiClient.post<GroupResponse>(
      `/api/organizations/${organizationId}/groups`,
      data
    );
    return response.data;
  }

  async updateGroup(organizationId: string, groupId: string, data: GroupUpdateRequest): Promise<Group> {
    const response = await apiClient.put<GroupResponse>(
      `/api/organizations/${organizationId}/groups/${groupId}`,
      data
    );
    return response.data;
  }

  async deleteGroup(organizationId: string, groupId: string): Promise<void> {
    await apiClient.delete<{ success: boolean; message: string }>(
      `/api/organizations/${organizationId}/groups/${groupId}`
    );
  }

  async getGroupMembers(organizationId: string, groupId: string): Promise<GroupMember[]> {
    const response = await apiClient.get<GroupMembersResponse>(
      `/api/organizations/${organizationId}/groups/${groupId}/members`
    );
    return response.data;
  }

  async addMembersToGroup(organizationId: string, groupId: string, data: GroupMembershipRequest): Promise<void> {
    await apiClient.post<{ success: boolean; message: string }>(
      `/api/organizations/${organizationId}/groups/${groupId}/members`,
      data
    );
  }

  async removeMemberFromGroup(organizationId: string, groupId: string, memberId: string): Promise<void> {
    await apiClient.delete<{ success: boolean; message: string }>(
      `/api/organizations/${organizationId}/groups/${groupId}/members/${memberId}`
    );
  }

  async updateMemberPermissions(organizationId: string, groupId: string, memberId: string, permissions: any): Promise<void> {
    await apiClient.put<{ success: boolean; message: string }>(
      `/api/organizations/${organizationId}/groups/${groupId}/members/${memberId}/permissions`,
      permissions
    );
  }
}

export const groupService = new GroupService();
