import React, { useEffect, useState } from 'react';
import { db } from '../../../db';
import { Account, Category, PaymentMethod, KkbQr } from '../../../types';
import { ConfirmationDialog } from '../../../components/ConfirmationDialog';
import { SwitchToggle } from '../../../components/SwitchToggle';
import { ManageAccounts } from '../components/ManageAccounts';
import { PaymentMethods } from '../components/PaymentMethods';
import { ManageCategories } from '../components/ManageCategories';
import { KkbQrs } from '../components/KkbQrs';
import { ConfigureDashboard } from '../components/ConfigureDashboard';
import { SettingsCard } from '../components/SettingsCard';
import { useSettingsStore } from '../models/store';
import { supabase } from '../../../supabase';
import { processSyncQueue, syncWorkspace } from '../../../utils/syncEngine';

interface SettingsProps {
  activeAccountId: string;
  onNavigate: (viewId: string, queryParams?: string) => void;
  onModalToggle?: (open: boolean) => void;
  onProfileClick?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ 
  activeAccountId, 
  onNavigate, 
  onModalToggle,
  onProfileClick
}) => {
  const store = useSettingsStore();
  const [user, setUser] = useState<any>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState<boolean>(false);

  // Monitor auth status
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Monitor network status
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

  const loadPendingInvitations = async () => {
    if (!user || !isOnline) {
      setInvitations([]);
      return;
    }
    setIsLoadingInvites(true);
    try {
      const { data, error } = await supabase
        .from('account_invitations')
        .select('*')
        .eq('invitee_email', user.email)
        .eq('status', 'pending');
      if (!error && data) {
        setInvitations(data);
      }
    } catch (err) {
      console.error('Failed to load pending invitations:', err);
    } finally {
      setIsLoadingInvites(false);
    }
  };

  useEffect(() => {
    loadPendingInvitations();
  }, [user, isOnline]);

  const handleAcceptInvite = async (invite: any) => {
    if (!user) return;
    try {
      // 1. Add record to collaborators table
      const { error: colErr } = await supabase
        .from('collaborators')
        .insert({
          id: crypto.randomUUID(),
          account_id: invite.account_id,
          user_id: user.id,
          role: 'collaborator'
        });
      if (colErr) throw colErr;

      // 2. Update invitation status to accepted
      const { error: inviteErr } = await supabase
        .from('account_invitations')
        .update({ status: 'accepted' })
        .eq('id', invite.id);
      if (inviteErr) throw inviteErr;

      // 3. Force full workspace sync so that the account and all its data are downloaded locally
      await syncWorkspace(true);

      // 4. Update the settings store so the UI accounts list updates
      await store.loadAccounts();

      // 5. Switch active account to the accepted account and refresh
      await db.put('settings', { key: 'activeAccountId', value: invite.account_id });
      window.location.reload();
    } catch (err: any) {
      console.error('Failed to accept invitation:', err);
      alert('Error accepting invitation: ' + err.message);
    }
  };

  const handleDeclineInvite = async (invite: any) => {
    if (!confirm('Are you sure you want to decline this invitation?')) return;
    try {
      const { error } = await supabase
        .from('account_invitations')
        .update({ status: 'declined' })
        .eq('id', invite.id);
      if (error) throw error;

      setInvitations((prev) => prev.filter((i) => i.id !== invite.id));
    } catch (err: any) {
      console.error('Failed to decline invitation:', err);
      alert('Error declining invitation: ' + err.message);
    }
  };

  const loadSettingsData = async () => {
    await Promise.all([
      store.loadAccounts(),
      store.loadPayments(),
      store.loadCategories(activeAccountId),
      store.loadQrs(),
      store.loadLocationAndWidgets(),
    ]);
  };

  useEffect(() => {
    loadSettingsData();
  }, [activeAccountId]);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('modal') !== 'confirm-delete-payment') {
        store.setDeleteTargetPaymentId(null);
      }
      if (params.get('modal') !== 'confirm-delete-account') {
        store.setDeleteTargetAccountId(null);
      }
      if (params.get('modal') !== 'confirm-delete-category') {
        store.setDeleteTargetCategoryId(null);
      }
      if (params.get('modal') !== 'confirm-delete-qr') {
        store.setDeleteTargetQrId(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (onModalToggle) {
      onModalToggle(
        !!store.deleteTargetPaymentId || 
        !!store.deleteTargetAccountId || 
        !!store.deleteTargetCategoryId || 
        !!store.deleteTargetQrId
      );
    }
  }, [
    store.deleteTargetPaymentId, 
    store.deleteTargetAccountId, 
    store.deleteTargetCategoryId, 
    store.deleteTargetQrId, 
    onModalToggle
  ]);

  // Backup and Wiping Utilities
  const handleExportJSON = async () => {
    const allAccounts = await db.getAll('accounts');
    const allGroups = await db.getAll('expense_groups');
    const allItems = await db.getAll('expense_items');
    const allCats = await db.getAll('categories');
    const allLbls = await db.getAll('labels');
    const allPayments = await db.getAll('payment_methods');
    const allSettings = await db.getAll('settings');

    const backupDump = {
      accounts: allAccounts,
      expense_groups: allGroups,
      expense_items: allItems,
      categories: allCats,
      labels: allLbls,
      payment_methods: allPayments,
      settings: allSettings,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(backupDump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Fahh_Tracker_Backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleResetDatabase = async () => {
    if (confirm('⚠️ WARNING: Wiping the database will erase ALL expense records, accounts, and QR sheets. Proceed?')) {
      if (confirm('Are you absolutely certain? This operation CANNOT be undone!')) {
        indexedDB.deleteDatabase('FahhExpenseTracker');
        alert('Database reset successful. The application will now reload to pre-seed default configurations.');
        window.location.reload();
      }
    }
  };

  return (
    <>
      <header className="view-header">
        <h1 className="view-title">Settings</h1>
      </header>

      <div className="scroll-content padding-bottom-large">
        

        {/* Account Management section */}
        <ManageAccounts
          accounts={store.accounts}
          activeAccountId={activeAccountId}
          onReorder={store.handleReorderAccounts}
          onSwitch={store.handleSwitchAccount}
          newAccountName={store.newAccountName}
          setNewAccountName={store.setNewAccountName}
          onAdd={store.handleAddAccount}
          onConfigureAccount={(id) => onNavigate('configure-account', `accountId=${id}`)}
        />

        {/* Global Payment Methods */}
        <PaymentMethods
          payments={store.payments}
          onReorder={store.handleReorderPayments}
          onDelete={store.triggerDeletePayment}
          newPaymentName={store.newPaymentName}
          setNewPaymentName={store.setNewPaymentName}
          onAdd={store.handleAddPayment}
        />

        {/* Categories Manager */}
        <ManageCategories
          categories={store.categories}
          onReorder={store.handleReorderCategories}
          onDelete={(id, name) => store.triggerDeleteCategory(id, name, store.categories.length)}
          newCatIcon={store.newCatIcon}
          setNewCatIcon={store.setNewCatIcon}
          newCatName={store.newCatName}
          setNewCatName={store.setNewCatName}
          onAdd={() => store.handleAddCategory(activeAccountId)}
        />

        {/* KKB QR attachments */}
        <KkbQrs
          qrs={store.qrs}
          newQrName={store.newQrName}
          setNewQrName={store.setNewQrName}
          newQrFileName={store.newQrFileName}
          setNewQrFileName={store.setNewQrFileName}
          setNewQrBase64={store.setNewQrBase64}
          onAdd={store.handleAddQr}
          onDelete={store.triggerDeleteQr}
        />

        {/* Enable location check toggle */}
        <SettingsCard
          title="Enable Location Suggestions"
          description="Scopes autocompletes based on physical proximity"
          flexRowBetween
        >
          <SwitchToggle
            id="location-toggle-checkbox"
            checked={store.locationEnabled}
            onChange={store.handleToggleLocation}
          />
        </SettingsCard>

        {/* Dashboard Widgets Configurator */}
        <ConfigureDashboard
          widgets={store.widgets}
          onReorder={store.handleReorderWidgets}
          onToggleWidget={store.handleToggleWidget}
        />

        {/* Excel Exporter Integration */}
        <SettingsCard title="Excel Exporter">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '24px' }}>📊</span>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                Export filtered transactions & KKB splits to formatted .xlsx
              </span>
            </div>
            <button 
              type="button"
              className="utility-action-btn-tinted" 
              style={{ width: '100%', marginTop: '4px' }} 
              onClick={() => onNavigate('excel-export')}
            >
              Export Transactions
            </button>
          </div>
        </SettingsCard>

        {/* Data Utilities reset */}
        <SettingsCard title="Data Utilities">
          <div className="settings-utilities-grid">
            <button className="utility-action-btn-tinted" onClick={handleExportJSON}>Export JSON</button>
            <button className="utility-action-btn-danger" onClick={handleResetDatabase}>Reset Database</button>
          </div>
        </SettingsCard>

        {/* Pending Invitations list */}
        {user && isOnline && invitations.length > 0 && (
          <SettingsCard 
            title="Pending Invitations" 
            titleStyle={{
              fontFamily: 'Outfit, sans-serif',
              fontSize: '16px',
              fontWeight: 700
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {invitations.map((invite) => (
                <div 
                  key={invite.id} 
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '8px', 
                    padding: '12px', 
                    backgroundColor: 'var(--color-primary-tinted)', 
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid rgba(88, 76, 244, 0.15)' 
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                      Invited by <strong style={{ color: 'var(--text-primary)' }}>{invite.inviter_email}</strong>
                    </span>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-primary)', fontFamily: 'Outfit, sans-serif' }}>
                      Join "{invite.account_name}"
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button 
                      type="button"
                      className="utility-action-btn-tinted" 
                      style={{ flex: 1, margin: 0, padding: '10px 0', fontSize: '13px', fontWeight: 600, height: 'auto', borderRadius: 'var(--radius-sm)' }}
                      onClick={() => handleAcceptInvite(invite)}
                    >
                      Accept
                    </button>
                    <button 
                      type="button"
                      className="utility-action-btn-danger" 
                      style={{ flex: 1, margin: 0, padding: '10px 0', fontSize: '13px', fontWeight: 600, height: 'auto', borderRadius: 'var(--radius-sm)' }}
                      onClick={() => handleDeclineInvite(invite)}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </SettingsCard>
        )}

        {/* Supabase Account Profile Card */}
        <SettingsCard title="Cloud Account">
          {user ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>👤</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                    {user.email}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Provider: {user.app_metadata?.provider?.toUpperCase() || 'EMAIL'}
                  </span>
                </div>
              </div>
              {isOnline ? (
                <button 
                  className="utility-action-btn-tinted" 
                  style={{ width: '100%', marginTop: '4px' }} 
                  onClick={async (e) => {
                    const btn = e.currentTarget;
                    btn.disabled = true;
                    const originalText = btn.innerText;
                    btn.innerText = 'Syncing... 🔄';
                    try {
                      await syncWorkspace(true);
                      btn.innerText = 'Sync Successful! ✓';
                      setTimeout(() => {
                        btn.innerText = originalText;
                        btn.disabled = false;
                      }, 2000);
                    } catch (err) {
                      console.error('Manual sync failed:', err);
                      btn.innerText = 'Sync Failed ✕';
                      setTimeout(() => {
                        btn.innerText = originalText;
                        btn.disabled = false;
                      }, 2000);
                    }
                  }}
                >
                  Sync Workspace
                </button>
              ) : (
                <button 
                  className="utility-action-btn-tinted" 
                  style={{ width: '100%', marginTop: '4px', opacity: 0.5, cursor: 'not-allowed' }} 
                  disabled
                >
                  Offline (Sync Unavailable) 🔌
                </button>
              )}
              <button 
                className="utility-action-btn-danger" 
                style={{ width: '100%', marginTop: '4px' }} 
                onClick={async () => {
                  if (confirm('Are you sure you want to log out?')) {
                    await supabase.auth.signOut();
                  }
                }}
              >
                Log Out
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                Back up your expenses and sync across multiple devices by logging in to your cloud account.
              </span>
              <button 
                className="utility-action-btn-tinted" 
                style={{ width: '100%', marginTop: '6px' }}
                onClick={onProfileClick}
              >
                Log In / Register
              </button>
            </div>
          )}
        </SettingsCard>
      </div>

      {/* Reusable Deletion Confirmation Dialogs */}
      <ConfirmationDialog
        isOpen={!!store.deleteTargetPaymentId}
        title="Delete Payment Method?"
        description={
          <>
            Are you sure you want to delete <strong>{store.deleteTargetPaymentName}</strong>? This action cannot be undone.
          </>
        }
        onConfirm={store.confirmDeletePayment}
        onCancel={() => {
          store.setDeleteTargetPaymentId(null);
          window.history.back();
        }}
      />

      <ConfirmationDialog
        isOpen={!!store.deleteTargetAccountId}
        title="Delete Account?"
        description={
          <>
            Are you sure you want to delete <strong>{store.deleteTargetAccountName}</strong>? All associated expenses, custom categories, and labels will be deleted.
          </>
        }
        onConfirm={() => store.confirmDeleteAccount(activeAccountId)}
        onCancel={() => {
          store.setDeleteTargetAccountId(null);
          window.history.back();
        }}
      />

      <ConfirmationDialog
        isOpen={!!store.deleteTargetCategoryId}
        title="Delete Category?"
        description={
          <>
            Are you sure you want to delete <strong>{store.deleteTargetCategoryName}</strong>? Linked transaction items will remain but category card resets.
          </>
        }
        onConfirm={store.confirmDeleteCategory}
        onCancel={() => {
          store.setDeleteTargetCategoryId(null);
          window.history.back();
        }}
      />

      <ConfirmationDialog
        isOpen={!!store.deleteTargetQrId}
        title="Delete QR Code?"
        description={
          <>
            Are you sure you want to delete <strong>{store.deleteTargetQrName}</strong>? This action cannot be undone.
          </>
        }
        onConfirm={store.confirmDeleteQr}
        onCancel={() => {
          store.setDeleteTargetQrId(null);
          window.history.back();
        }}
      />
    </>
  );
};
