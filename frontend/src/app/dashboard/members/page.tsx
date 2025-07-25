'use client';

import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '../../../components/auth/ProtectedRoute';
import { Navbar } from '../../../components/common';
import { useAuthContext } from '../../../contexts/AuthContext';
import { organizationService, OrganizationMember } from '../../../services/organizationService';

export default function MembersPage() {
  const { currentOrganization } = useAuthContext();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'MANAGER' | 'MEMBER'>('MEMBER');
  const [inviting, setInviting] = useState(false);

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
              <div className="space-y-2">
                {members.map((member) => (
                  <div key={member.id} className="border rounded p-4 flex justify-between items-center">
                    <div>
                      <h3 className="font-medium">{member.name}</h3>
                      <p className="text-sm text-gray-600">{member.email}</p>
                      <p className="text-xs text-gray-500">
                        Role: {member.role} | Joined: {new Date(member.joinedAt).toLocaleDateString()}
                        {member.lastActive && ` | Last active: ${new Date(member.lastActive).toLocaleDateString()}`}
                      </p>
                    </div>
                    {!member.isAdmin && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
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
