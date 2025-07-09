'use client';

import { AuthPage } from '../components/auth/AuthPage';

export default function Home() {
  const handleAuthSuccess = (user: any, token: string) => {
    console.log('Authentication successful:', { user, token });
    // TODO: Redirect to main app
    const userName = user?.name || 'User';
    const orgCount = user?.organizations?.length || 0;
    alert(`Welcome ${userName}! You have access to ${orgCount} organization(s). Authentication successful.`);
  };

  return (
    <AuthPage
      onAuthSuccess={handleAuthSuccess}
      initialMode="login"
    />
  );
}
