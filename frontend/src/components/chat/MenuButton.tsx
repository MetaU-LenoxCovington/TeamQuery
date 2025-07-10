import React from 'react';
import { chatStyles } from '../../styles/chatStyles';

interface MenuButtonProps {
  onClick: () => void;
}

export const MenuButton: React.FC<MenuButtonProps> = ({ onClick }) => (
  <button
    onClick={onClick}
    className={chatStyles.chatHeader.menuButton.base}
    style={chatStyles.chatHeader.menuButton.getStyle()}
    title="Toggle sidebar"
  >
    ☰
  </button>
);
