import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Organization } from '../../types';
import { chatStyles } from '../../styles/chatStyles';
import { COLORS } from '../../styles/colors';
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

const NavigationLinks: React.FC = () => {
  const pathname = usePathname();

  const navItems = [
    { href: '/chat', label: 'Chat', icon: '💬' },
    { href: '/dashboard/documents', label: 'Documents', icon: '📄' },
    { href: '/dashboard/groups', label: 'Groups', icon: '👥' },
    { href: '/dashboard/members', label: 'Members', icon: '👤' },
  ];

  return (
    <nav className="flex items-center gap-1">
      {navItems.map((item) => {
        const isActive = pathname === item.href ||
          (item.href !== '/dashboard' && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className="px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/10"
            style={{
              color: isActive ? COLORS.forestGreen : COLORS.charcoal,
              backgroundColor: isActive ? 'white' : 'transparent',
              textDecoration: 'none'
            }}
          >
            <span className="flex items-center gap-2">
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
};

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

      <div className="flex items-center gap-6">
        <OrganizationDisplay organization={currentOrganization} />
        <NavigationLinks />
      </div>

      <ProfileDropdown
        user={user}
        isOpen={profileDropdownOpen}
        onToggle={() => setProfileDropdownOpen(!profileDropdownOpen)}
      />
    </header>
  );
};
