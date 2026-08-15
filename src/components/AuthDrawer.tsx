import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { syncWorkspace } from '../utils/syncEngine';

interface AuthDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthDrawer: React.FC<AuthDrawerProps> = ({ isOpen, onClose }) => {
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isSignUpMode, setIsSignUpMode] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Monitor Auth session state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        syncWorkspace();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Intercept back actions for clean URL updates on popstate
  useEffect(() => {
    if (isOpen) {
      window.history.pushState({ modal: 'auth' }, '', '?modal=auth');
    }
  }, [isOpen]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setAlert({ type: 'error', message: 'Please enter both email and password.' });
      return;
    }

    try {
      setLoading(true);
      setAlert(null);

      if (isSignUpMode) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password.trim()
        });

        if (error) throw error;
        
        if (data.user && data.session === null) {
          setAlert({ type: 'success', message: '✉️ Verification link sent! Check your inbox.' });
        } else {
          setAlert({ type: 'success', message: 'Account created successfully!' });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim()
        });

        if (error) throw error;
        setAlert({ type: 'success', message: 'Successfully logged in!' });
        setTimeout(() => {
          onClose();
          window.history.back(); // Clean URL query string
        }, 1200);
      }

    } catch (err: any) {
      console.error('Email Auth Error:', err);
      setAlert({ type: 'error', message: err.message || 'Authentication failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      setAlert(null);
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + window.location.pathname
        }
      });

      if (error) throw error;

    } catch (err: any) {
      console.error('Google OAuth Error:', err);
      setAlert({ type: 'error', message: err.message || 'Google Sign-In failed.' });
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      await supabase.from('settings').delete().eq('key', 'lastSyncTime');
      
      setAlert({ type: 'success', message: 'Logged out successfully.' });
      setTimeout(() => {
        onClose();
        window.history.back();
        window.location.reload();
      }, 1000);

    } catch (err: any) {
      console.error('Sign Out Error:', err);
      setAlert({ type: 'error', message: err.message || 'Log out failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    if (window.history.state?.modal === 'auth') {
      window.history.back();
    }
  };

  return (
    <div className={`auth-drawer-overlay ${isOpen ? 'active' : ''}`}>
      <div className="auth-drawer-scrim" onClick={handleClose}></div>
      <div className="auth-drawer-content">
        <div className="auth-drawer-header">
          <button className="auth-drawer-close" onClick={handleClose}>&times;</button>
          <h3 className="auth-drawer-title">
            {session ? 'Account details' : isSignUpMode ? 'Create Account' : 'Login Account'}
          </h3>
        </div>

        <div className="auth-drawer-body">
          {alert && (
            <div className={`auth-alert ${alert.type}`}>
              {alert.message}
            </div>
          )}

          {session ? (
            /* ==========================================
               AUTHENTICATED VIEW (Logged In Profile)
               ========================================== */
            <div className="auth-profile-section">
              <div className="auth-avatar-large">👤</div>
              <div className="auth-user-meta">
                <span className="meta-label">LOGGED IN AS</span>
                <span className="meta-value">{session.user.email}</span>
                <span className="meta-badge">ONLINE SYNC ACTIVE</span>
              </div>
              <button 
                type="button" 
                className="auth-btn logout-btn" 
                onClick={handleSignOut}
                disabled={loading}
              >
                {loading ? 'Logging out...' : 'Log Out Account'}
              </button>
            </div>
          ) : (
            /* ==========================================
               ANONYMOUS VIEW (Login / Sign Up Form)
               ========================================== */
            <>
              <p className="auth-intro-text">
                {isSignUpMode 
                  ? 'Join shared accounts and keep your expense summaries and category budgets synced in real-time.' 
                  : 'Access your shared transactions and collaborative expense ledgers with your family.'}
              </p>

              <form className="auth-form" onSubmit={handleEmailAuth}>
                <div className="form-group">
                  <label htmlFor="auth-email-input">Email Address</label>
                  <input 
                    id="auth-email-input"
                    type="email" 
                    className="auth-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="auth-password-input">Password</label>
                  <input 
                    id="auth-password-input"
                    type="password" 
                    className="auth-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  className="auth-btn submit-btn" 
                  disabled={loading}
                >
                  {loading ? 'Authenticating...' : isSignUpMode ? 'Create Account' : 'Sign In'}
                </button>
              </form>

              <div className="auth-toggle-link">
                {isSignUpMode ? 'Already have an account?' : "Don't have an account?"}
                <button 
                  type="button" 
                  onClick={() => {
                    setIsSignUpMode(prev => !prev);
                    setAlert(null);
                  }}
                >
                  {isSignUpMode ? 'Sign In' : 'Sign Up'}
                </button>
              </div>

              <div className="auth-divider">
                <span>OR</span>
              </div>

              <button 
                type="button" 
                className="auth-btn google-btn"
                onClick={handleGoogleAuth}
                disabled={loading}
              >
                <svg className="google-icon" style={{ width: '18px', height: '18px' }} viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                Sign In with Google
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
