'use client';

import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '../../../components/auth/ProtectedRoute';
import { Navbar } from '../../../components/common';
import { useAuthContext } from '../../../contexts/AuthContext';
import { organizationService, OrganizationMember } from '../../../services/organizationService';
import { groupService, GroupRecommendation } from '../../../services/groupService';

export default function MembersPage() {
  const { currentOrganization } = useAuthContext();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MANAGER' | 'MEMBER'>('MEMBER');
  const [inviting, setInviting] = useState(false);

  const [memberRecommendations, setMemberRecommendations] = useState<Record<string, GroupRecommendation[]>>({});
  const [loadingRecommendations, setLoadingRecommendations] = useState<Record<string, boolean>>({});
  const [showRecommendations, setShowRecommendations] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (currentOrganization) {
      loadMembers();
    }
  }, [currentOrganization]);

  const loadMembers = async () => {
    if (!currentOrganization) return;

    try {
      setLoading(true);
      const membersData = await organizationService.getOrganizationMembers(currentOrganization.id);
      setMembers(membersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !currentOrganization) return;

    try {
      setInviting(true);
      setError(null);

      await organizationService.inviteMember(currentOrganization.id, inviteEmail, inviteRole);

      setInviteEmail('');
      setInviteRole('MEMBER');
      alert('Invitation sent successfully!');
      await loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
      alert('Failed to send invitation: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    if (!currentOrganization) return;

    try {
      await organizationService.removeMember(currentOrganization.id, memberId);
      await loadMembers();
      alert('Member removed successfully!');
    } catch (err) {
      alert('Failed to remove member: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const loadRecommendationsForMember = async (memberId: string) => {
    if (!currentOrganization) return;

    try {
      setLoadingRecommendations(prev => ({ ...prev, [memberId]: true }));
      const recommendations = await groupService.getUserGroupRecommendations(
        currentOrganization.id,
        memberId,
        3
      );
      setMemberRecommendations(prev => ({ ...prev, [memberId]: recommendations }));
    } catch (err) {
      console.error(`Failed to load recommendations for member ${memberId}:`, err);
      setMemberRecommendations(prev => ({ ...prev, [memberId]: [] }));
    } finally {
      setLoadingRecommendations(prev => ({ ...prev, [memberId]: false }));
    }
  };

  const handleAddToRecommendedGroup = async (memberId: string, groupId: string, groupName: string) => {
    if (!currentOrganization) return;

    try {
      await groupService.addMembersToGroup(currentOrganization.id, groupId, {
        userIds: [memberId]
      });

      await loadRecommendationsForMember(memberId);
      alert(`Member added to ${groupName} successfully!`);
    } catch (err) {
      alert('Failed to add member to group: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const toggleRecommendations = async (memberId: string) => {
    const isCurrentlyShowing = showRecommendations[memberId];

    setShowRecommendations(prev => ({ ...prev, [memberId]: !isCurrentlyShowing }));

    // Load recommendations if we're showing them and haven't loaded them yet
    if (!isCurrentlyShowing && !memberRecommendations[memberId]) {
      await loadRecommendationsForMember(memberId);
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requireAuth={true} redirectTo="/">
        <div>
          <Navbar currentPage="members" />
          <div className="p-6">Loading...</div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requireAuth={true} redirectTo="/">
      <div>
        <Navbar currentPage="members" />
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-6">Members</h1>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* Invite Form */}
          <div className="border rounded p-4 mb-6">
            <h2 className="text-lg font-semibold mb-4">Invite Member</h2>
            <form onSubmit={handleInviteMember} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  className="border rounded px-3 py-2 w-full"
                  placeholder="Enter email address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'ADMIN' | 'MANAGER' | 'MEMBER')}
                  className="border rounded px-3 py-2 w-full"
                >
                  <option value="MEMBER">Member</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={inviting || !inviteEmail}
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
              >
                {inviting ? 'Sending...' : 'Send Invitation'}
              </button>
            </form>
          </div>

          {/* Members List */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Organization Members ({members.length})</h2>
            {members.length === 0 ? (
              <p className="text-gray-600">No members found.</p>
            ) : (
              <div className="space-y-4">
                {members.map((member) => (
                  <div key={member.id} className="border rounded p-4">
                    {/* Member Info Header */}
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{member.name}</h3>
                        <p className="text-sm text-gray-600">{member.email}</p>
                        <p className="text-xs text-gray-500">
                          Role: {member.role} | Joined: {new Date(member.joinedAt).toLocaleDateString()}
                          {member.lastActive && ` | Last active: ${new Date(member.lastActive).toLocaleDateString()}`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleRecommendations(member.id)}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          {showRecommendations[member.id] ? 'Hide Groups' : 'Show Recommended Groups'}
                        </button>
                        {!member.isAdmin && (
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Group Recommendations Section */}
                    {showRecommendations[member.id] && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="text-sm font-medium text-gray-700">Recommended Groups</h4>
                          <button
                            onClick={() => loadRecommendationsForMember(member.id)}
                            disabled={loadingRecommendations[member.id]}
                            className="text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400"
                          >
                            {loadingRecommendations[member.id] ? 'Loading...' : 'Refresh'}
                          </button>
                        </div>

                        {loadingRecommendations[member.id] ? (
                          <p className="text-sm text-gray-500">Loading recommendations...</p>
                        ) : memberRecommendations[member.id]?.length > 0 ? (
                          <div className="space-y-2">
                            {memberRecommendations[member.id].map((rec) => (
                              <div key={rec.group_id} className="flex justify-between items-center bg-gray-50 p-3 rounded">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-medium">{rec.group_name}</span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleAddToRecommendedGroup(member.id, rec.group_id, rec.group_name)}
                                  className="ml-3 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                                >
                                  Add to Group
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">
                            {memberRecommendations[member.id] ? 'No recommendations available' : 'Click "Refresh" to load recommendations'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
