import React, { useState } from 'react';
import { AuthInput } from './AuthInput';
import { AuthButton } from './AuthButton';
import { SignupRequest } from '../../services/authService';
import { FORM_LAYOUTS } from '../../styles/formStyles';
import { ERROR_MESSAGE_STYLES } from '../../styles/feedbackStyles';
import { TYPOGRAPHY_STYLES } from '../../styles/typographyStyles';

interface SignupFormProps {
  onSubmit: (data: SignupRequest) => Promise<void>;
  onSwitchToLogin: () => void;
  loading?: boolean;
  error?: string;
}

interface SignupFormData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  organizationMode: 'create' | 'join';
  organizationName?: string;
  inviteCode?: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  organizationName?: string;
  inviteCode?: string;
}

export const SignupForm: React.FC<SignupFormProps> = ({
  onSubmit,
  onSwitchToLogin,
  loading = false,
  error,
}) => {
  const [formData, setFormData] = useState<SignupFormData>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    organizationMode: 'create',
    organizationName: '',
    inviteCode: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const validateField = (name: keyof SignupFormData, value: string): string | undefined => {
    switch (name) {
      case 'name':
        if (!value.trim()) return 'Name is required';
        if (value.trim().length < 2) return 'Name must be at least 2 characters';
        return undefined;

      case 'email':
        if (!value.trim()) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Please enter a valid email';
        return undefined;

      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
          return 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
        }
        return undefined;

      case 'confirmPassword':
        if (!value) return 'Please confirm your password';
        if (value !== formData.password) return 'Passwords do not match';
        return undefined;

      case 'organizationName':
        if (formData.organizationMode === 'create') {
          if (!value.trim()) return 'Organization name is required';
          if (value.trim().length < 2) return 'Organization name must be at least 2 characters';
        }
        return undefined;

      default:
        return undefined;
    }
  };


  const handleInputChange = (field: keyof SignupFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear error when user starts typing. Only for fields that have errors
    if (field in errors && errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field as keyof FormErrors]: undefined }));
    }

    // Re-validate confirm password when password changes
    if (field === 'password' && formData.confirmPassword) {
      const confirmPasswordError = validateField('confirmPassword', formData.confirmPassword);
      setErrors(prev => ({ ...prev, confirmPassword: confirmPasswordError }));
    }
  };


  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    newErrors.name = validateField('name', formData.name);
    newErrors.email = validateField('email', formData.email);
    newErrors.password = validateField('password', formData.password);
    newErrors.confirmPassword = validateField('confirmPassword', formData.confirmPassword);

    if (formData.organizationMode === 'create') {
      newErrors.organizationName = validateField('organizationName', formData.organizationName || '');
    }

    // Remove undefined errors
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
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        organizationName: formData.organizationName?.trim(),
      });
    } catch (error) {
      console.error('Signup failed:', error);
    }
  };

  return (
    <div className={FORM_LAYOUTS.container}>
      <div className={FORM_LAYOUTS.header}>
        <h1 className={`${TYPOGRAPHY_STYLES.headings.h1} ${TYPOGRAPHY_STYLES.spacing.normal}`}>
          Create Account
        </h1>
        <p className={TYPOGRAPHY_STYLES.secondary.base}>
          Join TeamQuery to start managing your documents
        </p>
      </div>

      <form onSubmit={handleSubmit} className={FORM_LAYOUTS.spacing}>
        {error && (
          <div className={ERROR_MESSAGE_STYLES.container}>
            <p className={ERROR_MESSAGE_STYLES.text}>{error}</p>
          </div>
        )}

        <AuthInput
          id="name"
          type="text"
          label="Full Name"
          placeholder="Enter your full name"
          value={formData.name}
          onChange={(value) => handleInputChange('name', value)}
          error={errors.name}
          required
          disabled={loading}
        />

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
          placeholder="Create a strong password"
          value={formData.password}
          onChange={(value) => handleInputChange('password', value)}
          error={errors.password}
          required
          disabled={loading}
        />

        <AuthInput
          id="confirmPassword"
          type="password"
          label="Confirm Password"
          placeholder="Confirm your password"
          value={formData.confirmPassword}
          onChange={(value) => handleInputChange('confirmPassword', value)}
          error={errors.confirmPassword}
          required
          disabled={loading}
        />

        <AuthInput
          id="organizationName"
          type="text"
          label="Organization Name"
          placeholder="Enter your organization name"
          value={formData.organizationName || ''}
          onChange={(value) => handleInputChange('organizationName', value)}
          error={errors.organizationName}
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
          {loading ? 'Creating Account...' : 'Create Account'}
        </AuthButton>

        {/* Switch to Login */}
        <div className={FORM_LAYOUTS.footer}>
          <p className={TYPOGRAPHY_STYLES.secondary.base}>
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              disabled={loading}
              className={loading ? TYPOGRAPHY_STYLES.interactive.linkDisabled : TYPOGRAPHY_STYLES.interactive.link}
            >
              Sign in
            </button>
          </p>
        </div>
      </form>
    </div>
  );
};
