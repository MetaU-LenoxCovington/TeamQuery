'use client';

import React from 'react';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { Navbar } from '../../components/common';
import { ChatLayout } from '../../components/chat/ChatLayout';
import { useAuthContext } from '../../contexts/AuthContext';

export default function ChatPage() {
  const {
    user,
    currentOrganization,
    organizations,
    setCurrentOrganization,
    isLoading,
    error
  } = useAuthContext();

  const handleOrganizationChange = (organizationId: string) => {
    setCurrentOrganization(organizationId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600 mb-2">Authentication Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute requireAuth={true} redirectTo="/">
      <div className="min-h-screen flex flex-col">
        <Navbar currentPage="chat" />
        {user && currentOrganization ? (
          <div className="flex-1">
            <ChatLayout
              user={user}
              currentOrganization={currentOrganization}
              organizations={organizations}
              onOrganizationChange={handleOrganizationChange}
            />
          </div>
        ) : (
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-600 mb-2">No Organization Selected</h2>
              <p className="text-gray-500">Please select an organization to continue.</p>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
