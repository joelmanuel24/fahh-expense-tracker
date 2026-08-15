import React, { useEffect, useState } from 'react';
import { db } from '../../../db';
import { Account } from '../../../types';
import { SettingsCard } from '../components/SettingsCard';
import { useSettingsStore } from '../models/store';
import { supabase } from '../../../supabase';

interface ConfigureAccountProps {
  accountId: string | null;
  onClose: () => void;
}

export const ConfigureAccount: React.FC<ConfigureAccountProps> = ({ accountId, onClose }) => {
  const store = useSettingsStore();
  const [account, setAccount] = useState<Account | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [isLoadingCols, setIsLoadingCols] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [sentInvitations, setSentInvitations] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [isSendingInvite, setIsSendingInvite] = useState<boolean>(false);
  const [inviteStatus, setInviteStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const accountFromStore = store.accounts.find(acc => acc.id === accountId);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
    });
  }, []);

  useEffect(() => {
    if (!accountId) return;
    db.get<Account>('accounts', accountId).then(acc => {
      if (acc) setAccount(acc);
    });
  }, [accountId]);

  useEffect(() => {
    if (!accountId || !isOnline) {
      setCollaborators([]);
      setSentInvitations([]);
      return;
    }

    setIsLoadingCols(true);
    supabase
      .from('collaborators_view')
      .select('*')
      .eq('account_id', accountId)
      .then(({ data, error }) => {
        setIsLoadingCols(false);
        if (!error && data) {
          setCollaborators(data);
        } else if (error) {
          console.error('Failed to load collaborators:', error);
        }
      });

    supabase
      .from('account_invitations')
      .select('*')
      .eq('account_id', accountId)
      .eq('status', 'pending')
      .then(({ data, error }) => {
        if (!error && data) {
          setSentInvitations(data);
        } else if (error) {
          console.error('Failed to load sent invitations:', error);
        }
      });
  }, [accountId, isOnline]);

  const handleSendInvite = async () => {
    const emailVal = inviteEmail.trim().toLowerCase();
    if (!emailVal) return;

    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailVal)) {
      setInviteStatus({ type: 'error', message: 'Please enter a valid email address.' });
      return;
    }

    // Check if user is already a collaborator
    const isAlreadyCol = collaborators.some(
      (c) => c.email?.toLowerCase() === emailVal || c.display_name?.toLowerCase() === emailVal
    );
    if (isAlreadyCol) {
      setInviteStatus({ type: 'error', message: 'User is already a collaborator on this account.' });
      return;
    }

    // Check if an invitation is already pending
    const isAlreadyInvited = sentInvitations.some(
      (i) => i.invitee_email.toLowerCase() === emailVal
    );
    if (isAlreadyInvited) {
      setInviteStatus({ type: 'error', message: 'An invitation is already pending for this email.' });
      return;
    }

    try {
      setIsSendingInvite(true);
      setInviteStatus(null);

      const inviteId = crypto.randomUUID();
      const newInvite = {
        id: inviteId,
        account_id: accountId!,
        account_name: account?.name || accountFromStore?.name || 'Shared Account',
        invitee_email: emailVal,
        inviter_email: currentUser?.email || '',
        inviter_id: currentUser?.id,
        status: 'pending'
      };

      const { error } = await supabase
        .from('account_invitations')
        .insert(newInvite);

      if (error) throw error;

      setInviteStatus({ type: 'success', message: 'Invitation sent successfully!' });
      setInviteEmail('');
      setSentInvitations((prev) => [...prev, newInvite]);
    } catch (err: any) {
      console.error('Failed to send invite:', err);
      setInviteStatus({ type: 'error', message: err.message || 'Failed to send invitation.' });
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    if (!confirm('Are you sure you want to cancel this invitation?')) return;
    try {
      const { error } = await supabase
        .from('account_invitations')
        .delete()
        .eq('id', inviteId);
      if (error) throw error;
      setSentInvitations((prev) => prev.filter((i) => i.id !== inviteId));
    } catch (err: any) {
      console.error('Failed to cancel invite:', err);
      alert('Error cancelling invite: ' + err.message);
    }
  };

  const isOwner = collaborators.some(c => c.user_id === currentUser?.id && c.role === 'owner');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Monitor account deletion: if this account is deleted from settings store, close this page
  useEffect(() => {
    if (accountId && store.accounts.length > 0) {
      const exists = store.accounts.some(acc => acc.id === accountId);
      if (!exists) {
        onClose();
      }
    }
  }, [store.accounts, accountId, onClose]);

  // Ensure accounts are loaded in settings store on mount
  useEffect(() => {
    if (store.accounts.length === 0) {
      store.loadAccounts();
    }
  }, []);

  return (
    <>
      <header className="view-header" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button className="icon-btn" onClick={onClose} aria-label="Back" style={{ zIndex: 5, flexShrink: 0 }}>
          <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </button>
        <h1 className="view-title" id="configure-title" style={{
          position: 'absolute',
          left: 0,
          right: 0,
          textAlign: 'center',
          margin: 0,
          pointerEvents: 'none',
          fontSize: '18px',
          fontWeight: 700,
          fontFamily: 'Outfit, sans-serif'
        }}>
          {accountFromStore ? accountFromStore.name : (account ? account.name : 'Configure Account')}
        </h1>
        
        {/* Ellipsis actions button */}
        <button 
          className="icon-btn" 
          onClick={() => setIsMenuOpen(prev => !prev)} 
          aria-label="Account options"
          style={{ zIndex: 5, flexShrink: 0 }}
        >
          <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '20px', height: '20px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
          </svg>
        </button>
      </header>

      <div className="scroll-content padding-bottom-large">
        <SettingsCard
          title="Collaborators"
          headerAction={
            !isOnline && (
              <span 
                style={{ 
                  fontSize: '11px', 
                  color: 'var(--color-danger)', 
                  fontWeight: 'bold', 
                  backgroundColor: 'var(--color-danger-tinted)', 
                  padding: '4px 10px', 
                  borderRadius: '12px',
                  fontFamily: 'Plus Jakarta Sans, sans-serif'
                }}
              >
                Offline 🔌
              </span>
            )
          }
          className="collaborators-card"
          titleStyle={{
            fontFamily: 'Outfit, sans-serif',
            fontSize: '16px',
            fontWeight: 700
          }}
        >
          <div 
            style={{
              opacity: isOnline ? 1 : 0.45,
              pointerEvents: isOnline ? 'auto' : 'none',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            {isOnline ? (
              isLoadingCols ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                  Loading collaborators...
                </div>
              ) : (
                <>
                  {collaborators.length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontStyle: 'italic', marginBottom: '8px' }}>
                      No collaborators found for this account.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {collaborators.map((col) => {
                        const displayName = col.display_name || col.email;
                        const colIsOwner = col.role === 'owner';
                        return (
                          <div 
                            key={col.id} 
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 0',
                              backgroundColor: 'transparent',
                              border: 'none'
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                                {displayName}
                              </span>
                              {col.display_name && (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                                  {col.email}
                                </span>
                              )}
                            </div>
                            <span 
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                backgroundColor: colIsOwner ? 'rgba(88, 76, 244, 0.15)' : 'rgba(255, 255, 255, 0.06)',
                                color: colIsOwner ? 'var(--color-primary)' : 'var(--text-secondary)',
                                textTransform: 'capitalize',
                                fontFamily: 'Plus Jakarta Sans, sans-serif'
                              }}
                            >
                              {col.role}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Sent Invitations List */}
                  {sentInvitations.length > 0 && (
                    <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                        Pending Invites
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {sentInvitations.map((inv) => (
                          <div 
                            key={inv.id} 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between',
                              padding: '4px 0'
                            }}
                          >
                            <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                              {inv.invitee_email}
                            </span>
                            {isOwner && (
                              <button 
                                type="button" 
                                style={{ 
                                  background: 'transparent', 
                                  border: 'none', 
                                  color: 'var(--color-danger)', 
                                  fontSize: '11px', 
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  padding: '4px 8px',
                                  fontFamily: 'Plus Jakarta Sans, sans-serif'
                                }}
                                onClick={() => handleCancelInvite(inv.id)}
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Invite New Collaborator Input */}
                  {isOwner && (
                    <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'Outfit, sans-serif' }}>
                        Invite Collaborator
                      </label>
                      <div className="settings-add-row" style={{ display: 'flex', gap: '8px' }}>
                        <input 
                          type="email" 
                          className="settings-input" 
                          placeholder="Enter invitee email" 
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          disabled={isSendingInvite}
                          style={{ flex: 1 }}
                        />
                        <button 
                          type="button"
                          className="utility-action-btn-tinted" 
                          style={{ margin: 0, padding: '0 16px', flexShrink: 0, fontSize: '13px', fontWeight: 600, height: '38px', borderRadius: 'var(--radius-sm)' }}
                          onClick={handleSendInvite}
                          disabled={isSendingInvite}
                        >
                          {isSendingInvite ? 'Sending...' : 'Invite'}
                        </button>
                      </div>
                      {inviteStatus && (
                        <span style={{ 
                          fontSize: '12px', 
                          fontWeight: 500,
                          color: inviteStatus.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
                          fontFamily: 'Plus Jakarta Sans, sans-serif',
                          marginTop: '4px' 
                        }}>
                          {inviteStatus.message}
                        </span>
                      )}
                    </div>
                  )}
                </>
              )
            ) : (
              <p style={{ 
                fontSize: '13px', 
                color: 'var(--text-secondary)', 
                lineHeight: '1.5', 
                margin: 0,
                fontFamily: 'Plus Jakarta Sans, sans-serif'
              }}>
                Manage user collaboration and access settings for this account.
              </p>
            )}
            
            {!isOnline && (
              <div style={{ 
                fontSize: '12px', 
                color: 'var(--text-muted)', 
                fontStyle: 'italic',
                fontFamily: 'Plus Jakarta Sans, sans-serif',
                marginTop: '4px'
              }}>
                Collaboration settings are currently disabled because the device is offline.
              </div>
            )}
          </div>
        </SettingsCard>
      </div>

      {/* Bottom Sheet Context Menu Drawer */}
      <div className={`bottom-sheet-overlay ${isMenuOpen ? '' : 'hidden'}`} style={{ zIndex: 300 }}>
        <div 
          className="sheet-scrim" 
          onClick={() => setIsMenuOpen(false)}
        ></div>
        <div className="sheet-content-wrapper" style={{ paddingBottom: '32px' }}>
          <div 
            className="sheet-drag-indicator" 
            onClick={() => setIsMenuOpen(false)}
          ></div>
          
          <div className="sheet-menu-list" style={{ padding: '8px 0 12px 0' }}>
            <button
              type="button"
              className="sheet-menu-item"
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                fontWeight: 600,
                fontSize: '15px',
                textAlign: 'left',
                borderRadius: 'var(--radius-md)',
                transition: 'var(--transition-smooth)'
              }}
              onClick={() => {
                setIsMenuOpen(false);
                if (account) {
                  store.handleRenameAccount(account).then(() => {
                    if (accountId) {
                      db.get<Account>('accounts', accountId).then(acc => {
                        if (acc) setAccount(acc);
                      });
                    }
                  });
                }
              }}
            >
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '20px', height: '20px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.83 20.013a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
              Edit Account
            </button>

            <div className="sheet-menu-divider" />

            <button
              type="button"
              className="sheet-menu-item danger"
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: store.accounts.length <= 1 ? 'not-allowed' : 'pointer',
                color: store.accounts.length <= 1 ? 'var(--text-muted)' : 'var(--color-danger)',
                fontWeight: 600,
                fontSize: '15px',
                textAlign: 'left',
                borderRadius: 'var(--radius-md)',
                transition: 'var(--transition-smooth)',
                opacity: store.accounts.length <= 1 ? 0.5 : 1
              }}
              disabled={store.accounts.length <= 1}
              onClick={() => {
                setIsMenuOpen(false);
                if (account) {
                  store.triggerDeleteAccount(account.id, account.name, store.accounts.length);
                }
              }}
            >
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '20px', height: '20px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
              Delete Account
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
