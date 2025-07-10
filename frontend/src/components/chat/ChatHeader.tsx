import React, { useState } from 'react';
import { Organization } from '../../types';
import { chatStyles } from '../../styles/chatStyles';
import { MenuButton } from './MenuButton';
import { OrganizationDisplay } from './OrganizationDisplay';
import { ProfileDropdown } from './ProfileDropdown';

interface ChatHeaderProps {
  onToggleSidebar: () => void;
  currentOrganization?: Organization;
  user?: {
    name: string;
    email: string;
  };
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  onToggleSidebar,
  currentOrganization,
  user,
}) => {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  return (
    <header
      className={chatStyles.chatHeader.container.base}
      style={chatStyles.chatHeader.container.style}
    >
      <div className={chatStyles.chatHeader.leftSection}>
        <MenuButton onClick={onToggleSidebar} />
      </div>

      <OrganizationDisplay organization={currentOrganization} />

      <ProfileDropdown
        user={user}
        isOpen={profileDropdownOpen}
        onToggle={() => setProfileDropdownOpen(!profileDropdownOpen)}
      />
    </header>
  );
};
