import { apiClient } from './api';

export interface Invitation {
  id: string;
  email: string;
  role: 'MEMBER' | 'MANAGER';
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  organizationId: string;
  invitedBy: string;
  groupIds: string[];
  organization: {
    id: string;
    name: string;
    description?: string;
  };
  inviter: {
    id: string;
    name: string;
    email: string;
  };
}

export interface InviteUserRequest {
  email: string;
  role: 'MEMBER' | 'MANAGER';
  groupIds?: string[];
}

export interface InvitationListResponse {
  success: boolean;
  data: Invitation[];
}

export interface InvitationResponse {
  success: boolean;
  data: Invitation;
}

class InvitationService {
  async getPendingInvitations(): Promise<Invitation[]> {
    const response = await apiClient.get<InvitationListResponse>('/api/invitations');
    return response.data;
  }

  async acceptInvitation(invitationId: string): Promise<void> {
    await apiClient.post<{ success: boolean; message: string }>(
      `/api/invitations/${invitationId}/accept`
    );
  }

  async declineInvitation(invitationId: string): Promise<void> {
    await apiClient.post<{ success: boolean; message: string }>(
      `/api/invitations/${invitationId}/decline`
    );
  }

  async sendInvitation(organizationId: string, inviteData: InviteUserRequest): Promise<Invitation> {
    const response = await apiClient.post<InvitationResponse>(
      `/api/organizations/${organizationId}/invitations`,
      inviteData
    );
    return response.data;
  }

  async getOrganizationInvitations(organizationId: string): Promise<Invitation[]> {
    const response = await apiClient.get<InvitationListResponse>(
      `/api/organizations/${organizationId}/invitations`
    );
    return response.data;
  }

  async cancelInvitation(organizationId: string, invitationId: string): Promise<void> {
    await apiClient.delete<{ success: boolean; message: string }>(
      `/api/organizations/${organizationId}/invitations/${invitationId}`
    );
  }

  async resendInvitation(organizationId: string, invitationId: string): Promise<Invitation> {
    const response = await apiClient.post<InvitationResponse>(
      `/api/organizations/${organizationId}/invitations/${invitationId}/resend`
    );
    return response.data;
  }
}

export const invitationService = new InvitationService();
