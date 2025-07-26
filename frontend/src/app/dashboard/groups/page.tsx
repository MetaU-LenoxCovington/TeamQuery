'use client';

import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '../../../components/auth/ProtectedRoute';
import { Navbar } from '../../../components/common';
import { useAuthContext } from '../../../contexts/AuthContext';
import { groupService, Group } from '../../../services/groupService';
import { useRouter } from 'next/navigation';

export default function GroupsPage() {
  const { currentOrganization } = useAuthContext();
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');

  useEffect(() => {
    if (currentOrganization) {
      loadGroups();
    }
  }, [currentOrganization]);

  const loadGroups = async () => {
    if (!currentOrganization) return;

    try {
      setLoading(true);
      const groupsData = await groupService.getGroups(currentOrganization.id);
      setGroups(groupsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName || !currentOrganization) return;

    try {
      setCreating(true);
      setError(null);

      await groupService.createGroup(currentOrganization.id, {
        name: groupName,
        description: groupDescription || undefined,
      });

      setGroupName('');
      setGroupDescription('');
      alert('Group created successfully!');
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group');
      alert('Failed to create group: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group?')) return;
    if (!currentOrganization) return;

    try {
      await groupService.deleteGroup(currentOrganization.id, groupId);
      await loadGroups();
      alert('Group deleted successfully!');
    } catch (err) {
      alert('Failed to delete group: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleViewGroup = (groupId: string) => {
    router.push(`/dashboard/groups/${groupId}`);
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

  return (
    <ProtectedRoute requireAuth={true} redirectTo="/">
      <div>
        <Navbar currentPage="groups" />
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-6">Groups</h1>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* Create Group Form */}
          <div className="border rounded p-4 mb-6">
            <h2 className="text-lg font-semibold mb-4">Create Group</h2>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Group Name</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  required
                  className="border rounded px-3 py-2 w-full"
                  placeholder="Enter group name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description (Optional)</label>
                <textarea
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  className="border rounded px-3 py-2 w-full"
                  placeholder="Enter group description"
                  rows={3}
                />
              </div>

              <button
                type="submit"
                disabled={creating || !groupName}
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
              >
                {creating ? 'Creating...' : 'Create Group'}
              </button>
            </form>
          </div>

          {/* Groups List */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Groups ({groups.length})</h2>
            {groups.length === 0 ? (
              <p className="text-gray-600">No groups created yet.</p>
            ) : (
              <div className="space-y-2">
                {groups.map((group) => (
                  <div key={group.id} className="border rounded p-4 flex justify-between items-center">
                    <div>
                      <h3 className="font-medium">{group.name}</h3>
                      {group.description && (
                        <p className="text-sm text-gray-600">{group.description}</p>
                      )}
                      <p className="text-xs text-gray-500">
                        Members: {group.memberCount || 0} | Created: {new Date(group.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleViewGroup(group.id)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(group.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
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
