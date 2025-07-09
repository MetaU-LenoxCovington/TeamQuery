import React from 'react';
import { BUTTON_BASE_CLASSES, BUTTON_VARIANTS, ButtonVariant } from '../../styles/buttonStyles';

interface AuthButtonProps {
  type?: 'button' | 'submit';
  variant?: ButtonVariant;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  className?: string;
}

export const AuthButton: React.FC<AuthButtonProps> = ({
  type = 'button',
  variant = 'primary',
  children,
  onClick,
  disabled = false,
  loading = false,
  fullWidth = false,
  className = '',
}) => {
  const baseClasses = `
    ${BUTTON_BASE_CLASSES}
    ${fullWidth ? 'w-full' : ''}
  `;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${BUTTON_VARIANTS[variant]} ${className}`}
      aria-disabled={disabled || loading}
    >
      {loading && (
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
      )}
      <span className={loading ? 'opacity-70' : ''}>{children}</span>
    </button>
  );
};
