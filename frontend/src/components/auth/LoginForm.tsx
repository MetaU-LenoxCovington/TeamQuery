import React, { useState } from 'react';
import { AuthInput } from './AuthInput';
import { AuthButton } from './AuthButton';
import { LoginRequest } from '../../services/authService';
import { FORM_LAYOUTS } from '../../styles/formStyles';
import { ERROR_MESSAGE_STYLES } from '../../styles/feedbackStyles';
import { TYPOGRAPHY_STYLES } from '../../styles/typographyStyles';

interface LoginFormProps {
  onSubmit: (data: LoginRequest) => Promise<void>;
  onSwitchToSignup: () => void;
  loading?: boolean;
  error?: string;
}

interface FormErrors {
  email?: string;
  password?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSubmit,
  onSwitchToSignup,
  loading = false,
  error,
}) => {
  const [formData, setFormData] = useState<LoginRequest>({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});

  // Validate individual fields
  const validateField = (name: keyof LoginRequest, value: string): string | undefined => {
    switch (name) {
      case 'email':
        if (!value.trim()) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email';
        return undefined;

      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 6) return 'Password must be at least 6 characters';
        return undefined;

      default:
        return undefined;
    }
  };

  const handleInputChange = (field: keyof LoginRequest, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    if (field in errors && errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field as keyof FormErrors]: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    newErrors.email = validateField('email', formData.email);
    newErrors.password = validateField('password', formData.password);

    Object.keys(newErrors).forEach(key => {
      if (newErrors[key as keyof FormErrors] === undefined) {
        delete newErrors[key as keyof FormErrors];
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit({
        email: formData.email,
        password: formData.password,
      });
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <div className={FORM_LAYOUTS.container}>
      <div className={FORM_LAYOUTS.header}>
        <h1 className={`${TYPOGRAPHY_STYLES.headings.h1} ${TYPOGRAPHY_STYLES.spacing.normal}`}>
          Welcome Back
        </h1>
        <p className={TYPOGRAPHY_STYLES.secondary.base}>
          Sign in to access your documents
        </p>
      </div>

      <form onSubmit={handleSubmit} className={FORM_LAYOUTS.spacing}>
        {error && (
          <div className={ERROR_MESSAGE_STYLES.container}>
            <p className={ERROR_MESSAGE_STYLES.text}>{error}</p>
          </div>
        )}

        <AuthInput
          id="email"
          type="email"
          label="Email Address"
          placeholder="Enter your email"
          value={formData.email}
          onChange={(value) => handleInputChange('email', value)}
          error={errors.email}
          required
          disabled={loading}
        />

        <AuthInput
          id="password"
          type="password"
          label="Password"
          placeholder="Enter your password"
          value={formData.password}
          onChange={(value) => handleInputChange('password', value)}
          error={errors.password}
          required
          disabled={loading}
        />


        <AuthButton
          type="submit"
          variant="primary"
          fullWidth
          loading={loading}
          disabled={loading}
        >
          {loading ? 'Signing In...' : 'Sign In'}
        </AuthButton>

        <div className={FORM_LAYOUTS.footer}>
          <p className={TYPOGRAPHY_STYLES.secondary.base}>
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToSignup}
              disabled={loading}
              className={loading ? TYPOGRAPHY_STYLES.interactive.linkDisabled : TYPOGRAPHY_STYLES.interactive.link}
            >
              Create one
            </button>
          </p>
        </div>
      </form>
    </div>
  );
};
