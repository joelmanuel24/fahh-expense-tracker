import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';

interface AuthDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthDrawer: React.FC<AuthDrawerProps> = ({ isOpen, onClose }) => {
  const [user, setUser] = useState<any>(null);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Monitor auth state changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);


  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      if (isSignUp) {
        // Sign Up Flow
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim()
        });

        if (error) throw error;

        if (data.user && !data.session) {
          setSuccessMsg('✉️ Verification email sent! Please check your inbox.');
        } else {
          setSuccessMsg('✨ Registration successful! Welcome to Fahh!');
          setTimeout(onClose, 1500);
        }
      } else {
        // Sign In Flow
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim()
        });

        if (error) throw error;

        setSuccessMsg('⚡ Logged in successfully!');
        setTimeout(onClose, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to initialize Google login.');
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSuccessMsg('Logged out successfully.');
      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Logout failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`auth-drawer-overlay ${isOpen ? 'active' : ''}`}>
      {/* Clickable dim background backdrop */}
      <div className="auth-drawer-scrim" onClick={onClose}></div>

      {/* Main sliding content container */}
      <div className="auth-drawer-content">
        <header className="auth-drawer-header">
          <button className="auth-drawer-close" onClick={onClose}>✕</button>
          <h2 className="auth-drawer-title">{user ? 'User Profile' : (isSignUp ? 'Create Account' : 'Sign In')}</h2>
        </header>

        <div className="auth-drawer-body">
          {user ? (
            /* Authenticated view */
            <div className="auth-profile-section">
              <div className="auth-avatar-large">👤</div>
              <div className="auth-user-meta">
                <span className="meta-label">Signed in as</span>
                <span className="meta-value">{user.email}</span>
                {user.app_metadata?.provider && (
                  <span className="meta-badge">{user.app_metadata.provider.toUpperCase()}</span>
                )}
              </div>

              {successMsg && <div className="auth-alert success">{successMsg}</div>}
              {errorMsg && <div className="auth-alert error">{errorMsg}</div>}

              <button 
                type="button" 
                className="auth-btn logout-btn" 
                onClick={handleLogout}
                disabled={loading}
              >
                {loading ? 'Logging out...' : 'Log Out'}
              </button>
            </div>
          ) : (
            /* Unauthenticated Form view */
            <div className="auth-form-section">
              <p className="auth-intro-text">
                {isSignUp 
                  ? 'Sign up to keep your settings and records backed up securely.' 
                  : 'Sign in to access your budget and expenses across all devices.'}
              </p>

              {successMsg && <div className="auth-alert success">{successMsg}</div>}
              {errorMsg && <div className="auth-alert error">{errorMsg}</div>}

              <form onSubmit={handleAuth} className="auth-form">
                <div className="form-group">
                  <label htmlFor="auth-email">Email Address</label>
                  <input
                    id="auth-email"
                    type="email"
                    placeholder="name@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="auth-input"
                    disabled={loading}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="auth-password">Password</label>
                  <input
                    id="auth-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="auth-input"
                    disabled={loading}
                  />
                </div>

                <button 
                  type="submit" 
                  className="auth-btn submit-btn" 
                  disabled={loading}
                >
                  {loading ? 'Processing...' : (isSignUp ? 'Register Account' : 'Sign In')}
                </button>
              </form>

              {/* Social Login Separator */}
              <div className="auth-divider">
                <span>or</span>
              </div>

              {/* Google OAuth Trigger */}
              <button 
                type="button" 
                className="auth-btn google-btn" 
                onClick={handleGoogleLogin}
                disabled={loading}
              >
                {/* Native styled SVG Google G Logo */}
                <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
                  <path
                    fill="#EA4335"
                    d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.33 0 3.327 2.682 1.409 6.591L5.266 9.765z"
                  />
                  <path
                    fill="#34A853"
                    d="M16.04 15.341c-1.07.727-2.43 1.168-4.04 1.168-2.909 0-5.382-1.964-6.264-4.591L1.872 15.1A11.979 11.979 0 0 0 12 24c3.245 0 6.19-1.064 8.364-2.909l-4.324-5.75z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.49 12.273c0-.818-.082-1.609-.236-2.364H12v4.51h6.473c-.278 1.495-1.118 2.763-2.39 3.627l4.324 5.75c2.527-2.336 5.083-6.223 5.083-9.523z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.776 11.918c-.236-.709-.373-1.464-.373-2.25s.137-1.541.373-2.25L1.91 4.25A11.933 11.933 0 0 0 0 9.668c0 1.95.464 3.79 1.282 5.432l4.494-3.182z"
                  />
                </svg>
                Continue with Google
              </button>

              {/* Mode Toggle Link */}
              <div className="auth-toggle-link">
                {isSignUp ? (
                  <span>
                    Already have an account?{' '}
                    <button type="button" onClick={() => { setIsSignUp(false); setErrorMsg(null); setSuccessMsg(null); }}>
                      Sign In
                    </button>
                  </span>
                ) : (
                  <span>
                    New to Fahh?{' '}
                    <button type="button" onClick={() => { setIsSignUp(true); setErrorMsg(null); setSuccessMsg(null); }}>
                      Create Account
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
