import React from 'react';
import { INPUT_BASE_CLASSES, INPUT_STATES, LABEL_CLASSES, REQUIRED_INDICATOR_CLASSES, InputState } from '../../styles/inputStyles';
import { ERROR_MESSAGE_STYLES } from '../../styles/feedbackStyles';

interface AuthInputProps {
  type: 'text' | 'email' | 'password';
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  id: string;
  label: string;
}

export const AuthInput: React.FC<AuthInputProps> = ({
  type,
  placeholder,
  value,
  onChange,
  error,
  disabled = false,
  required = false,
  id,
  label,
}) => {
  const inputState: InputState = error ? 'error' : 'default';

  return (
    <div className="w-full">
      <label htmlFor={id} className={LABEL_CLASSES}>
        {label}
        {required && <span className={REQUIRED_INDICATOR_CLASSES}>*</span>}
      </label>

      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        className={`${INPUT_BASE_CLASSES} ${INPUT_STATES[inputState]}`}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${id}-error` : undefined}
      />

      {error && (
        <p
          id={`${id}-error`}
          className={ERROR_MESSAGE_STYLES.inline}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
};
