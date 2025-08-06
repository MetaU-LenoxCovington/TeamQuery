import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '../../contexts/AuthContext';

interface NavbarProps {
  currentPage?: 'chat' | 'dashboard' | 'documents' | 'members' | 'groups' | 'invitations';
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage }) => {
  const { user, currentOrganization, logout } = useAuthContext();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="border-b p-4 bg-white">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-6">
          <h1 className="text-xl font-bold">TeamQuery</h1>
          <Link href="/chat" className={currentPage === 'chat' ? 'font-bold' : 'text-blue-600'}>
            Chat
          </Link>
          <Link href="/dashboard/documents" className={currentPage === 'documents' ? 'font-bold' : 'text-blue-600'}>
            Documents
          </Link>
          <Link href="/dashboard/members" className={currentPage === 'members' ? 'font-bold' : 'text-blue-600'}>
            Members
          </Link>
          <Link href="/dashboard/groups" className={currentPage === 'groups' ? 'font-bold' : 'text-blue-600'}>
            Groups
          </Link>
          <Link href="/dashboard/invitations" className={currentPage === 'invitations' ? 'font-bold' : 'text-blue-600'}>
            Invitations
          </Link>
        </div>
        <div className="flex items-center space-x-4">
          {currentOrganization && <span className="text-sm">{currentOrganization.name}</span>}
          <span>{user?.name}</span>
          <button onClick={handleLogout} className="text-blue-600">
            Logout
          </button>
        </div>
      </div>
    </div>
  );
};
