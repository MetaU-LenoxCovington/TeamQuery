import React from 'react';
import { chatStyles } from '../../styles/chatStyles';

interface ProfileDropdownProps {
  user?: { name: string; email: string };
  isOpen: boolean;
  onToggle: () => void;
}
// TODO: change to make the buttons actually functional and route to the other pages once they are made
export const ProfileDropdown: React.FC<ProfileDropdownProps> = ({ user, isOpen, onToggle }) => (
  <div className={chatStyles.chatHeader.profileDropdown.container}>
    <button
      onClick={onToggle}
      className={chatStyles.chatHeader.profileDropdown.trigger.base}
      style={chatStyles.chatHeader.profileDropdown.trigger.getStyle()}
    >
      <div className={chatStyles.chatHeader.profileDropdown.avatar}>
        👤
      </div>
      <span className={chatStyles.chatHeader.profileDropdown.userName}>
        {user?.name || 'User'}
      </span>
      <span className="text-xs">
        {isOpen ? '▼' : '▶'}
      </span>
    </button>

    {isOpen && (
      <div
        className={chatStyles.chatHeader.profileDropdown.dropdown.container}
        style={chatStyles.chatHeader.profileDropdown.dropdown.style}
      >
        <div
          className={chatStyles.chatHeader.profileDropdown.dropdown.userInfo.container}
          style={chatStyles.chatHeader.profileDropdown.dropdown.userInfo.style}
        >
          <div className={chatStyles.chatHeader.profileDropdown.dropdown.userInfo.name}>
            {user?.name || 'User'}
          </div>
          <div className={chatStyles.chatHeader.profileDropdown.dropdown.userInfo.email}>
            {user?.email || 'user@example.com'}
          </div>
        </div>

        <div className={chatStyles.chatHeader.profileDropdown.dropdown.menu}>
          <button className={chatStyles.chatHeader.profileDropdown.dropdown.menuItem}>
            <span className={chatStyles.chatHeader.profileDropdown.dropdown.menuItemText}>
              Account Settings
            </span>
          </button>
          <button className={chatStyles.chatHeader.profileDropdown.dropdown.menuItem}>
            <span className={chatStyles.chatHeader.profileDropdown.dropdown.menuItemText}>
              Organization Dashboard
            </span>
          </button>
          <hr
            className="my-1"
            style={chatStyles.chatHeader.profileDropdown.dropdown.divider.style}
          />
          <button className={chatStyles.chatHeader.profileDropdown.dropdown.logoutItem}>
            <span className={chatStyles.chatHeader.profileDropdown.dropdown.menuItemText}>
              Logout
            </span>
          </button>
        </div>
      </div>
    )}
  </div>
);
