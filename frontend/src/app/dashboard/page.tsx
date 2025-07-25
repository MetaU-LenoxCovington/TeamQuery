'use client';

import React from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';
import { Navbar } from '../../components/common';
import { useAuthContext } from '../../contexts/AuthContext';

export default function DashboardPage() {
  const { currentOrganization, user } = useAuthContext();

  return (
    <ProtectedRoute requireAuth={true} redirectTo="/">
      <div>
        <Navbar currentPage="dashboard" />
        <div className="p-6">
          <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
          <p className="mb-2">Welcome, {user?.name}</p>
          <p className="text-sm text-gray-600 mb-6">Organization: {currentOrganization?.name}</p>

          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-2">Quick Actions</h2>
              <div className="space-y-2">
                <Link href="/chat" className="block p-3 border rounded text-blue-600">
                  Chat - Ask questions about your documents
                </Link>
                <Link href="/dashboard/documents" className="block p-3 border rounded text-blue-600">
                  Documents - Upload and manage files
                </Link>
                <Link href="/dashboard/members" className="block p-3 border rounded text-blue-600">
                  Members - Manage organization members
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
