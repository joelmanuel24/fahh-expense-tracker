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
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22-.03-.63z"
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
