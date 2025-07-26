'use client';

import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '../../../../components/auth/ProtectedRoute';
import { Navbar } from '../../../../components/common';
import { useAuthContext } from '../../../../contexts/AuthContext';
import { groupService, Group, GroupMember } from '../../../../services/groupService';
import { useRouter, useParams } from 'next/navigation';

export default function GroupDetailPage() {
  const { currentOrganization } = useAuthContext();
  const router = useRouter();
  const params = useParams();
  const groupId = params.groupId as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [memberEmail, setMemberEmail] = useState('');

  useEffect(() => {
    if (currentOrganization && groupId) {
      loadGroupData();
    }
  }, [currentOrganization, groupId]);

  const loadGroupData = async () => {
    if (!currentOrganization || !groupId) return;

    try {
      setLoading(true);
      const [groupsData, membersData] = await Promise.all([
        groupService.getGroups(currentOrganization.id),
        groupService.getGroupMembers(currentOrganization.id, groupId)
      ]);

      const currentGroup = groupsData.find(g => g.id === groupId);
      if (!currentGroup) {
        setError('Group not found');
        return;
      }

      setGroup(currentGroup);
      setMembers(membersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load group data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberEmail || !currentOrganization || !groupId) return;

    try {
      setAdding(true);
      setError(null);

      await groupService.addMembersToGroup(currentOrganization.id, groupId, {
        userIds: [memberEmail]
      });

      setMemberEmail('');
      alert('Member added successfully!');
      await loadGroupData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
      alert('Failed to add member: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member from the group?')) return;
    if (!currentOrganization || !groupId) return;

    try {
      await groupService.removeMemberFromGroup(currentOrganization.id, groupId, memberId);
      await loadGroupData();
      alert('Member removed successfully!');
    } catch (err) {
      alert('Failed to remove member: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requireAuth={true} redirectTo="/">
        <div>
          <Navbar currentPage="groups" />
          <div className="p-6">Loading...</div>
        </div>
      </ProtectedRoute>
    );
  }

  if (!group) {
    return (
      <ProtectedRoute requireAuth={true} redirectTo="/">
        <div>
          <Navbar currentPage="groups" />
          <div className="p-6">
            <div className="mb-4">
              <button
                onClick={() => router.push('/dashboard/groups')}
                className="text-blue-600 hover:text-blue-800"
              >
                Back to Groups
              </button>
            </div>
            <p className="text-red-600">Group not found.</p>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requireAuth={true} redirectTo="/">
      <div>
        <Navbar currentPage="groups" />
        <div className="p-6">
          <div className="mb-4">
            <button
              onClick={() => router.push('/dashboard/groups')}
              className="text-blue-600 hover:text-blue-800"
            >
              ← Back to Groups
            </button>
          </div>

          <h1 className="text-2xl font-bold mb-2">{group.name}</h1>
          {group.description && (
            <p className="text-gray-600 mb-6">{group.description}</p>
          )}

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* Add Member Form */}
          <div className="border rounded p-4 mb-6">
            <h2 className="text-lg font-semibold mb-4">Add Member</h2>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Member Email</label>
                <input
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  required
                  className="border rounded px-3 py-2 w-full"
                  placeholder="Enter member email"
                />
                <p className="text-xs text-gray-500 mt-1">
                  The user must already be a member of your organization.
                </p>
              </div>

              <button
                type="submit"
                disabled={adding || !memberEmail}
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
              >
                {adding ? 'Adding...' : 'Add Member'}
              </button>
            </form>
          </div>

          {/* Members List */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Group Members ({members.length})</h2>
            {members.length === 0 ? (
              <p className="text-gray-600">No members in this group yet.</p>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div key={member.id} className="border rounded p-4 flex justify-between items-center">
                    <div>
                      <h3 className="font-medium">{member.name}</h3>
                      <p className="text-sm text-gray-600">{member.email}</p>
                      <p className="text-xs text-gray-500">
                        Role: {member.role} | Joined: {new Date(member.joinedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
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
