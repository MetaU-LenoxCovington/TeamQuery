import React, { useState } from 'react';
import { ChatHeader } from './ChatHeader';
import { ChatSidebar } from './ChatSidebar';
import { ChatArea } from './ChatArea';
import { User, Organization } from '../../types';

interface ChatLayoutProps {
  user: User;
  currentOrganization: Organization;
  organizations: Organization[];
  onOrganizationChange: (organizationId: string) => void;
}

export const ChatLayout: React.FC<ChatLayoutProps> = ({
  user,
  currentOrganization,
  organizations,
  onOrganizationChange,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleSidebarToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <ChatHeader
        onToggleSidebar={handleSidebarToggle}
        currentOrganization={currentOrganization}
        user={user}
      />
      
      <div className="flex-1 flex">
        <ChatSidebar
          isOpen={sidebarOpen}
          onToggle={handleSidebarToggle}
          currentOrganization={currentOrganization}
          organizations={organizations}
          onOrganizationChange={onOrganizationChange}
        />
        
        <ChatArea />
      </div>
    </div>
  );
}; 