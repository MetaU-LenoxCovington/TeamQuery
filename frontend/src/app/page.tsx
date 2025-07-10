'use client';

import React from 'react';
import { ProtectedRoute } from '../components/auth/ProtectedRoute';
import { AuthPage } from '../components/auth/AuthPage';

export default function Home() {
  return (
    <ProtectedRoute requireAuth={false} redirectTo="/chat">
      <AuthPage />
    </ProtectedRoute>
  );
}
