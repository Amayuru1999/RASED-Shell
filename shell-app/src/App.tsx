import React from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { LoadingIndicator } from './components/LoadingIndicator';

// ─── Login Page ────────────────────────────────────────────────────────────────
function LoginPage() {
  const { login } = useAuth();
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #1B2A4A 0%, #101a33 60%, #2a1a10 100%)' }}
    >
      <div className="w-full max-w-md mx-4">
        {/* Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl">
          {/* Emblem */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 rounded-full bg-gold-500/20 border-2 border-gold-500/50 flex items-center justify-center mb-4">
              <span className="text-4xl">⚜</span>
            </div>
            <h1 className="text-white text-xl font-bold text-center leading-tight">
              Revenue Administration System
            </h1>
            <p className="text-slate-400 text-sm mt-1">Excise Department of Sri Lanka</p>
          </div>

          {/* Divider */}
          <div className="border-t border-white/10 mb-6" />

          <p className="text-slate-300 text-sm text-center mb-6">
            Sign in with your government credentials to access the system.
          </p>
          <div className="flex flex-col gap-4">
            <button
              id="login-btn-keycloak"
              onClick={login}
              className="w-full py-3.5 px-6 rounded-xl font-semibold text-navy-700 transition-all duration-200
               hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #e0b84e)' }}
            >
              Sign In with Keycloak
            </button>

            <button
              id="login-btn-wso2"
              onClick={login}
              className="w-full py-3.5 px-6 rounded-xl font-semibold text-navy-700 transition-all duration-200
               hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #e0b84e)' }}
            >
              Sign In with WSO2
            </button>
          </div>

          <p className="text-slate-500 text-xs text-center mt-4">
            Secured by Keycloak&nbsp;|&nbsp; Sri Lanka Excise Department
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── App Shell ─────────────────────────────────────────────────────────────────
function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #1B2A4A 0%, #101a33 100%)' }}
      >
        <LoadingIndicator message="Checking authentication..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <Layout />;
}

// ─── Root App ──────────────────────────────────────────────────────────────────
interface AppProps {
  /** Called once after auth state resolves — triggers Single-SPA start */
  onSingleSpaReady?: () => void;
}

export default function App({ onSingleSpaReady }: AppProps) {
  return (
    <AuthProvider onReady={onSingleSpaReady}>
      <AppContent />
    </AuthProvider>
  );
}
