import { MembershipRole } from '../../generated/prisma';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  searchMetadata?: any;
  createdAt: Date;
}

export interface UserWithMemberships {
  id: string;
  email: string;
  name: string;
  organizations: {
    id: string;
    name: string;
    role: MembershipRole;
  }[];
}

export interface UpdateProfileRequest {
  name?: string;
  searchMetadata?: any;
}

export interface UpdateProfileResponse {
  user: UserProfile;
}

export interface OrganizationMember {
  userId: string;
  email: string;
  name: string;
  role: MembershipRole;
  permissionsGroupId?: string;
  permissionsGroupName?: string;
  joinedAt: Date;
}

export interface InviteUserRequest {
  email: string;
  role?: MembershipRole;
  permissionsGroupId?: string;
}

export interface InviteUserResponse {
  message: string;
  invitationId?: string;
}

export interface UpdateMemberRequest {
  role?: MembershipRole;
  permissionsGroupId?: string;
}

export interface UpdateMemberResponse {
  message: string;
  member: OrganizationMember;
}
