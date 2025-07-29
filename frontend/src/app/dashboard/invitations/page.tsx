'use client';

import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '../../../components/auth/ProtectedRoute';
import { Navbar } from '../../../components/common';
import { useAuthContext } from '../../../contexts/AuthContext';
import { invitationService, Invitation, InviteUserRequest } from '../../../services/invitationService';

export default function InvitationsPage() {
  const { currentOrganization } = useAuthContext();
  const [pendingInvitations, setPendingInvitations] = useState<Invitation[]>([]);
  const [sentInvitations, setSentInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'MEMBER' | 'MANAGER'>('MEMBER');

  const canManageUsers = currentOrganization?.role === 'ADMIN' || currentOrganization?.role === 'MANAGER';

  useEffect(() => {
    loadData();
  }, [currentOrganization]);

  const loadData = async () => {
    try {
      setLoading(true);
      const pendingPromise = invitationService.getPendingInvitations();
      const sentPromise = canManageUsers && currentOrganization
        ? invitationService.getOrganizationInvitations(currentOrganization.id)
        : Promise.resolve([]);

      const [pendingData, sentData] = await Promise.all([pendingPromise, sentPromise]);

      setPendingInvitations(pendingData);
      setSentInvitations(sentData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invitations');
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !currentOrganization) return;

    try {
      setSending(true);
      setError(null);

      const inviteData: InviteUserRequest = {
        email: inviteEmail,
        role: inviteRole
      };

      await invitationService.sendInvitation(currentOrganization.id, inviteData);

      setInviteEmail('');
      setInviteRole('MEMBER');
      alert('Invitation sent successfully!');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
      alert('Failed to send invitation: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSending(false);
    }
  };

  const handleAcceptInvitation = async (invitationId: string) => {
    try {
      await invitationService.acceptInvitation(invitationId);
      alert('Invitation accepted successfully!');
      await loadData();
    } catch (err) {
      alert('Failed to accept invitation: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to decline this invitation?')) return;

    try {
      await invitationService.declineInvitation(invitationId);
      alert('Invitation declined successfully!');
      await loadData();
    } catch (err) {
      alert('Failed to decline invitation: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) return;
    if (!currentOrganization) return;

    try {
      await invitationService.cancelInvitation(currentOrganization.id, invitationId);
      alert('Invitation cancelled successfully!');
      await loadData();
    } catch (err) {
      alert('Failed to cancel invitation: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleResendInvitation = async (invitationId: string) => {
    if (!currentOrganization) return;

    try {
      await invitationService.resendInvitation(currentOrganization.id, invitationId);
      alert('Invitation resent successfully!');
      await loadData();
    } catch (err) {
      alert('Failed to resend invitation: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requireAuth={true} redirectTo="/">
        <div>
          <Navbar currentPage="invitations" />
          <div className="p-6">Loading...</div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requireAuth={true} redirectTo="/">
      <div>
        <Navbar currentPage="invitations" />
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-6">Invitations</h1>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* Send Invitation Form */}
          {canManageUsers && (
            <div className="border rounded p-4 mb-6">
              <h2 className="text-lg font-semibold mb-4">Send Invitation</h2>
              <form onSubmit={handleSendInvitation} className="space-y-4">
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
                    onChange={(e) => setInviteRole(e.target.value as 'MEMBER' | 'MANAGER')}
                    className="border rounded px-3 py-2 w-full"
                  >
                    <option value="MEMBER">Member</option>
                    <option value="MANAGER">Manager</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={sending || !inviteEmail}
                  className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
                >
                  {sending ? 'Sending...' : 'Send Invitation'}
                </button>
              </form>
            </div>
          )}

          {/* Pending Invitations Received */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-4">Pending Invitations ({pendingInvitations.length})</h2>
            {pendingInvitations.length === 0 ? (
              <p className="text-gray-600">No pending invitations.</p>
            ) : (
              <div className="space-y-2">
                {pendingInvitations.map((invitation) => (
                  <div key={invitation.id} className="border rounded p-4 flex justify-between items-center">
                    <div>
                      <h3 className="font-medium">{invitation.organization.name}</h3>
                      <p className="text-sm text-gray-600">
                        Invited by: {invitation.inviter.name} ({invitation.inviter.email})
                      </p>
                      <p className="text-xs text-gray-500">
                        Role: {invitation.role} | Sent: {new Date(invitation.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleAcceptInvitation(invitation.id)}
                        className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleDeclineInvitation(invitation.id)}
                        className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sent Invitations */}
          {canManageUsers && (
            <div>
              <h2 className="text-lg font-semibold mb-4">Sent Invitations ({sentInvitations.length})</h2>
              {sentInvitations.length === 0 ? (
                <p className="text-gray-600">No invitations sent.</p>
              ) : (
                <div className="space-y-2">
                  {sentInvitations.map((invitation) => (
                    <div key={invitation.id} className="border rounded p-4 flex justify-between items-center">
                      <div>
                        <h3 className="font-medium">{invitation.email}</h3>
                        <p className="text-sm text-gray-600">
                          Role: {invitation.role} | Status: {invitation.status}
                        </p>
                        <p className="text-xs text-gray-500">
                          Sent: {new Date(invitation.createdAt).toLocaleDateString()}
                          {invitation.updatedAt !== invitation.createdAt &&
                            ` | Updated: ${new Date(invitation.updatedAt).toLocaleDateString()}`
                          }
                        </p>
                      </div>
                      {invitation.status === 'PENDING' && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleResendInvitation(invitation.id)}
                            className="text-blue-600 hover:text-blue-800 text-sm"
                          >
                            Resend
                          </button>
                          <button
                            onClick={() => handleCancelInvitation(invitation.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
