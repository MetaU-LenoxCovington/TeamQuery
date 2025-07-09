import React, { useState } from 'react';
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { useAuth } from '../../hooks/useAuth';
import { LoginRequest, SignupRequest } from '../../services/authService';
import { COLORS } from '../../styles/colors';
import { TYPOGRAPHY_STYLES } from '../../styles/typographyStyles';

type AuthMode = 'login' | 'signup';

interface AuthPageProps {
  onAuthSuccess: (user: any, token: string) => void;
  initialMode?: AuthMode;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  onAuthSuccess,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const { login, signup, loading, error, clearError } = useAuth();

  const handleLogin = async (data: LoginRequest) => {
    try {
      const response = await login(data);
      onAuthSuccess(response.user, response.accessToken);
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  const handleSignup = async (data: SignupRequest) => {
    try {
      const response = await signup(data);
      onAuthSuccess(response.user, response.accessToken);
    } catch (err) {
      console.error('Signup failed:', err);
    }
  };

  const switchToLogin = () => {
    setMode('login');
    clearError();
  };

  const switchToSignup = () => {
    setMode('signup');
    clearError();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F8F5F2] via-[#DFF0DE] to-[#D2DEEE] flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, ${COLORS.forestGreen} 2px, transparent 2px), radial-gradient(circle at 75% 75%, ${COLORS.lavender} 2px, transparent 2px)`,
          backgroundSize: '60px 60px',
        }} />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-[#25433B] to-[#747CAD] mb-4 shadow-lg">
            <span className={`text-white text-2xl font-bold font-['Tiempos']`}>TQ</span>
          </div>
          <h1 className={`${TYPOGRAPHY_STYLES.headings.h2} text-center`}>
            TeamQuery
          </h1>
          <p className={`${TYPOGRAPHY_STYLES.secondary.base} text-center mt-1`}>
            Your intelligent document assistant
          </p>
        </div>

        {/* Auth Form Card */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/20 p-8">
          {mode === 'login' ? (
            <LoginForm
              onSubmit={handleLogin}
              onSwitchToSignup={switchToSignup}
              loading={loading}
              error={error || undefined}
            />
          ) : (
            <SignupForm
              onSubmit={handleSignup}
              onSwitchToLogin={switchToLogin}
              loading={loading}
              error={error || undefined}
            />
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className={`${TYPOGRAPHY_STYLES.secondary.small} opacity-70`}>
            © 2024 TeamQuery. Built for efficient document management.
          </p>
        </div>
      </div>

    </div>
  );
};
