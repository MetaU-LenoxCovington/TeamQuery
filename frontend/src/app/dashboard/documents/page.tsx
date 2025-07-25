'use client';

import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '../../../components/auth/ProtectedRoute';
import { Navbar } from '../../../components/common';
import { useAuthContext } from '../../../contexts/AuthContext';
import { documentService, Document } from '../../../services/documentService';
import { groupService, Group } from '../../../services/groupService';

export default function DocumentsPage() {
  const { currentOrganization } = useAuthContext();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [accessLevel, setAccessLevel] = useState<'PUBLIC' | 'PRIVATE' | 'GROUP'>('PUBLIC');

  useEffect(() => {
    if (currentOrganization) {
      loadData();
    }
  }, [currentOrganization]);

  const loadData = async () => {
    if (!currentOrganization) return;

    try {
      setLoading(true);
      const [docsData, groupsData] = await Promise.all([
        documentService.getDocuments(currentOrganization.id),
        groupService.getGroups(currentOrganization.id)
      ]);
      setDocuments(docsData);
      setGroups(groupsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !title || !currentOrganization) return;

    try {
      setUploading(true);
      setError(null);

      await documentService.uploadDocument(currentOrganization.id, {
        file: selectedFile,
        title,
        groupId: selectedGroupId || undefined,
        accessLevel
      });

      setSelectedFile(null);
      setTitle('');
      setSelectedGroupId('');
      setAccessLevel('PUBLIC');

      await loadData();
      alert('Document uploaded successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      alert('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;

    try {
      await documentService.deleteDocument(documentId);
      await loadData();
      alert('Document deleted successfully!');
    } catch (err) {
      alert('Delete failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  if (loading) {
    return (
      <ProtectedRoute requireAuth={true} redirectTo="/">
        <div>
          <Navbar currentPage="documents" />
          <div className="p-6">Loading...</div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute requireAuth={true} redirectTo="/">
      <div>
        <Navbar currentPage="documents" />
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-6">Documents</h1>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* Upload Form */}
          <div className="border rounded p-4 mb-6">
            <h2 className="text-lg font-semibold mb-4">Upload Document</h2>
            <form onSubmit={handleFileUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">File</label>
                <input
                  type="file"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx,.txt,.md"
                  required
                  className="border rounded px-3 py-2 w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="border rounded px-3 py-2 w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Group (Optional)</label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="border rounded px-3 py-2 w-full"
                >
                  <option value="">No Group</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Access Level</label>
                <select
                  value={accessLevel}
                  onChange={(e) => setAccessLevel(e.target.value as 'PUBLIC' | 'PRIVATE' | 'GROUP')}
                  className="border rounded px-3 py-2 w-full"
                >
                  <option value="PUBLIC">Public</option>
                  <option value="PRIVATE">Private</option>
                  <option value="GROUP">Group Only</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={uploading || !selectedFile || !title}
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
              >
                {uploading ? 'Uploading...' : 'Upload Document'}
              </button>
            </form>
          </div>

          {/* Documents List */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Documents ({documents.length})</h2>
            {documents.length === 0 ? (
              <p className="text-gray-600">No documents uploaded yet.</p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="border rounded p-4 flex justify-between items-center">
                    <div>
                      <h3 className="font-medium">{doc.title}</h3>
                      <p className="text-sm text-gray-600">
                        Status: {doc.status} | Access: {doc.accessLevel}
                        {doc.group?.name && ` | Group: ${doc.group.name}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
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
