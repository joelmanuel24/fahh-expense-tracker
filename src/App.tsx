import { useState, useEffect, useRef } from 'react';
import { db } from './db';
import { BottomNav } from './components/BottomNav';
import { Dashboard } from './features/Dashboard/pages/Index';
import { ExpensesOverview } from './features/Expenses/pages/Overview';
import { ExpenseForm } from './features/Expenses/pages/Index';
import { SplitReceipt } from './features/Expenses/components/SplitReceipt';
import { Settings } from './features/Settings/pages/Index';
import { ConfigureAccount } from './features/Settings/pages/ConfigureAccount';
import { OweDetails } from './features/Dashboard/pages/OweDetails';
import { AuthDrawer } from './components/AuthDrawer';
import { FirstSyncOverlay } from './components/FirstSyncOverlay';
import { supabase } from './supabase';
import { Account, Credit } from './types';
import { processSyncQueue, subscribeToSyncStatus, subscribeToSyncCompletion, syncWorkspace, pullUpdatesFromServer } from './utils/syncEngine';
import { useSettingsStore } from './features/Settings/models/store';
import { useExpensesStore } from './features/Expenses/models/store';
import './App.css';

function App() {
  const [activeAccountId, setActiveAccountId] = useState<string>('');
  const [activeMonth, setActiveMonth] = useState<Date>(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  
  const lastMonthChangeTime = useRef<number>(0);
  
  // Navigation Stack Router State
  const [historyStack, setHistoryStack] = useState<string[]>(['dashboard']);
  
  // Sub-view item trackers
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [viewingGroupId, setViewingGroupId] = useState<string | null>(null);
  const [configuringAccountId, setConfiguringAccountId] = useState<string | null>(null);
  
  const [isDbLoaded, setIsDbLoaded] = useState<boolean>(false);
  const [isModalActive, setIsModalActive] = useState<boolean>(false);
  const [isAuthDrawerOpen, setIsAuthDrawerOpen] = useState<boolean>(false);

  // First Sync & Auth State Management
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [showFirstSyncScreen, setShowFirstSyncScreen] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'completed' | 'failed'>('idle');
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleSyncAccounts = async (userObj: any = null) => {
    const targetUser = userObj || sessionUser;
    if (!targetUser) return;

    setSyncStatus('syncing');
    useSettingsStore.getState().setIsSyncing(true);
    setSyncError(null);

    try {
      // Check if user has existing account data in Supabase
      const { data: serverAccounts, error: checkErr } = await supabase
        .from('accounts')
        .select('id')
        .eq('owner_id', targetUser.id)
        .limit(1);

      if (!checkErr && serverAccounts && serverAccounts.length > 0) {
        const confirmReplace = confirm(
          "We found existing online data for your account.\n\n" +
          "Would you like to clear this device's local offline/seeded data and download your online data instead?\n\n" +
          "Click OK to REPLACE local data with your online data.\n" +
          "Click Cancel to MERGE local data with your online data."
        );

        if (confirmReplace) {
          // Clear all local database tables
          await db.clearTable('accounts');
          await db.clearTable('expense_groups');
          await db.clearTable('expense_items');
          await db.clearTable('categories');
          await db.clearTable('labels');
          await db.clearTable('payment_methods');
          await db.clearTable('settings');
          await db.clearTable('sync_queue');
          await db.clearTable('credits');

          // Pull all server updates
          await pullUpdatesFromServer(true); // Force full reconciliation

          // Mark first sync completed
          await db.put('settings', { key: `firstSyncCompleted_${targetUser.id}`, value: true });

          setSyncStatus('completed');
          useSettingsStore.getState().setIsSyncing(false);
          
          // Reload page to refresh all active memory states cleanly
          window.location.reload();
          return;
        }
      }

      // 1. Fetch all local accounts from IndexedDB
      const localAccounts = await db.getAll<Account>('accounts');
      if (localAccounts.length === 0) {
        await db.seedDefaultDatabase();
      }
      const freshAccounts = await db.getAll<Account>('accounts');

      // 2. Format and upsert accounts
      const accountsPayload = freshAccounts.map(acc => ({
        id: acc.id,
        name: acc.name,
        owner_id: targetUser.id
      }));
      const { error: accErr } = await supabase
        .from('accounts')
        .upsert(accountsPayload);
      if (accErr) throw accErr;

      // 2b. Add user as owner collaborator for each account to collaborators table
      const { data: existingCols, error: getColErr } = await supabase
        .from('collaborators')
        .select('account_id')
        .eq('user_id', targetUser.id);
      if (getColErr) throw getColErr;

      const existingAccountIds = new Set(existingCols?.map(c => c.account_id) || []);

      const collaboratorsPayload = freshAccounts
        .filter(acc => !existingAccountIds.has(acc.id))
        .map(acc => ({
          id: crypto.randomUUID(),
          account_id: acc.id,
          user_id: targetUser.id,
          role: 'owner'
        }));

      if (collaboratorsPayload.length > 0) {
        const { error: colErr } = await supabase
          .from('collaborators')
          .insert(collaboratorsPayload);
        if (colErr) throw colErr;
      }

      // 3. Format and upsert payment methods
      const freshPayments = await db.getAll<any>('payment_methods');
      if (freshPayments.length > 0) {
        const paymentsPayload = freshPayments.map(pm => ({
          id: pm.id,
          name: pm.name,
          owner_id: targetUser.id
        }));
        const { error: pmErr } = await supabase
          .from('payment_methods')
          .upsert(paymentsPayload);
        if (pmErr) throw pmErr;
      }

      // 4. Format and upsert categories (map bgColor/textColor to lowercase columns)
      const freshCategories = await db.getAll<any>('categories');
      if (freshCategories.length > 0) {
        const categoriesPayload = freshCategories.map(cat => ({
          id: cat.id,
          accountId: cat.accountId,
          name: cat.name,
          icon: cat.icon,
          bgcolor: cat.bgColor,
          textcolor: cat.textColor
        }));
        const { error: catErr } = await supabase
          .from('categories')
          .upsert(categoriesPayload);
        if (catErr) throw catErr;
      }

      // 5. Format and upsert labels
      const freshLabels = await db.getAll<any>('labels');
      if (freshLabels.length > 0) {
        const labelsPayload = freshLabels.map(lbl => ({
          id: lbl.id,
          accountId: lbl.accountId,
          name: lbl.name
        }));
        const { error: lblErr } = await supabase
          .from('labels')
          .upsert(labelsPayload);
        if (lblErr) throw lblErr;
      }

      // 6. Format and upsert settings
      const freshSettings = await db.getAll<any>('settings');
      const keysToSync = new Set([
        'locationSuggestEnabled',
        'dashboardWidgets',
        'kkbQrs',
        'accounts_order',
        'categories_order',
        'payment_methods_order'
      ]);
      const settingsPayload = freshSettings
        .filter(s => keysToSync.has(s.key))
        .map(s => ({
          key: s.key,
          value: s.value,
          owner_id: targetUser.id
        }));
      if (settingsPayload.length > 0) {
        const { error: setErr } = await supabase
          .from('settings')
          .upsert(settingsPayload);
        if (setErr) throw setErr;
      }

      // 7. Format and upsert expense groups
      const freshGroups = await db.getAll<any>('expense_groups');
      if (freshGroups.length > 0) {
        const groupsPayload = freshGroups.map(g => ({
          id: g.id,
          accountId: g.accountId,
          description: g.description,
          date: g.date,
          paymentmethod: g.paymentMethod,
          labels: g.labels || [],
          paidusers: g.paidUsers || [],
          lat: g.lat || null,
          lng: g.lng || null,
          receiptimage: g.receiptImage || null
        }));
        const { error: gErr } = await supabase
          .from('expense_groups')
          .upsert(groupsPayload);
        if (gErr) throw gErr;
      }

      // 8. Format and upsert expense items
      const freshItems = await db.getAll<any>('expense_items');
      if (freshItems.length > 0) {
        const itemsPayload = freshItems.map(item => ({
          id: item.id,
          groupId: item.groupId,
          description: item.description,
          amount: item.amount,
          category: item.category,
          splituser: item.splitUser || null
        }));
        const { error: iErr } = await supabase
          .from('expense_items')
          .upsert(itemsPayload);
        if (iErr) throw iErr;
      }

      // 8.2. Format and upsert credits
      const freshCredits = await db.getAll<Credit>('credits');
      if (freshCredits.length > 0) {
        const creditsPayload = freshCredits.map(c => ({
          id: c.id,
          account_id: c.accountId,
          user_name: c.userName,
          amount: c.amount,
          description: c.description,
          date: c.date,
          owner_id: targetUser.id
        }));
        const { error: cErr } = await supabase
          .from('credits')
          .upsert(creditsPayload);
        if (cErr) throw cErr;
      }

      // 9. Mark completion in settings store
      await db.put('settings', { key: `firstSyncCompleted_${targetUser.id}`, value: true });

      setSyncStatus('completed');
      useSettingsStore.getState().setIsSyncing(false);
      setTimeout(() => {
        setShowFirstSyncScreen(false);
        setSyncStatus('idle');
      }, 1500);
    } catch (err: any) {
      console.error('Account sync error:', err);
      setSyncStatus('failed');
      useSettingsStore.getState().setIsSyncing(false);
      setSyncError(err.message || 'An unknown error occurred during synchronization.');
    }
  };

  // Listen to browser network connectivity changes to replay offline queue
  useEffect(() => {
    if (!sessionUser) return;

    const handleOnline = () => {
      console.log('[Connection] Device is back online. Replaying sync queue and pulling updates...');
      syncWorkspace();
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [sessionUser]);

  // Listen to Supabase auth events once database is ready
  useEffect(() => {
    if (!isDbLoaded) return;

    // Process sync cycle on load (replays offline actions and pulls server updates)
    syncWorkspace();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const user = session?.user ?? null;
      setSessionUser(user);

      if (user) {
        // Check if sync has been completed for this user
        const syncStatusRecord = await db.get<{ key: string, value: boolean }>('settings', `firstSyncCompleted_${user.id}`);
        if (!syncStatusRecord || !syncStatusRecord.value) {
          setShowFirstSyncScreen(true);
          // Start the synchronization automatically
          handleSyncAccounts(user);
        } else {
          // If first sync is done, process outstanding actions and pull updates
          syncWorkspace();
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isDbLoaded]);

  // Subscribe to sync engine status and completion changes to reload stores
  useEffect(() => {
    const setIsSyncing = useSettingsStore.getState().setIsSyncing;
    const unsubscribeStatus = subscribeToSyncStatus((isSyncing) => {
      setIsSyncing(isSyncing);
    });

    const unsubscribeCompletion = subscribeToSyncCompletion(() => {
      console.log('[App] Sync completed. Reloading Zustand stores for active account:', activeAccountId);
      if (activeAccountId) {
        useSettingsStore.getState().loadAccounts();
        useSettingsStore.getState().loadPayments();
        useSettingsStore.getState().loadCategories(activeAccountId);
        useSettingsStore.getState().loadQrs();
        useSettingsStore.getState().loadLocationAndWidgets();
        useExpensesStore.getState().loadExpensesData(activeAccountId);
      }
    });

    return () => {
      unsubscribeStatus();
      unsubscribeCompletion();
    };
  }, [activeAccountId]);

  // Initialize and Seed Database on Mount
  useEffect(() => {
    const initializeApp = async () => {
      // 1. Seed configurations and get active account id
      const activeId = await db.seedDefaultDatabase();
      setActiveAccountId(activeId);
      setIsDbLoaded(true);

      // 2. Intercept PWA shortcut launch parameters
      const params = new URLSearchParams(window.location.search);
      if (params.get('action') === 'new-expense') {
        setHistoryStack(['dashboard', 'expense-form']);
        setEditingGroupId(null);
        window.history.replaceState({ view: 'expense-form' }, '', '?view=expense-form');
      } else {
        const view = params.get('view') || 'dashboard';
        if (view === 'split-receipt') {
          const gid = params.get('groupId');
          if (gid) setViewingGroupId(gid);
        } else if (view === 'configure-account') {
          const aid = params.get('accountId');
          if (aid) setConfiguringAccountId(aid);
        }
        setHistoryStack([view]);
        window.history.replaceState({ view }, '', window.location.search || `?view=${view}`);
      }

      // 3. Check if auth modal needs to be open immediately
      if (params.get('modal') === 'auth') {
        setIsAuthDrawerOpen(true);
      }
    };
    initializeApp();
  }, []);

  // Listen to popstate to toggle auth drawer overlay
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('modal') !== 'auth') {
        setIsAuthDrawerOpen(false);
      } else {
        setIsAuthDrawerOpen(true);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleOpenAuth = () => {
    setIsAuthDrawerOpen(true);
    window.history.pushState({ modal: 'auth' }, '', '?modal=auth');
  };

  // Intercept and reconcile Browser hardware back buttons (Popstate events)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const params = new URLSearchParams(window.location.search);
      
      // If popping a modal overlay, ignore screen stack changes
      if (params.has('modal')) return;

      const targetView = params.get('view') || 'dashboard';
      if (targetView === 'split-receipt') {
        const gid = params.get('groupId');
        if (gid) setViewingGroupId(gid);
      } else if (targetView === 'configure-account') {
        const aid = params.get('accountId');
        if (aid) setConfiguringAccountId(aid);
      }
      
      setHistoryStack((prevStack) => {
        const idx = prevStack.indexOf(targetView);
        if (idx !== -1) {
          // If the target view is already in our stack, pop everything above it
          return prevStack.slice(0, idx + 1);
        } else {
          // Otherwise push it onto the stack cleanly
          return [...prevStack, targetView];
        }
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Reconcile and clear editing/viewing states when exiting their respective sub-views
  useEffect(() => {
    if (!historyStack.includes('expense-form')) {
      setEditingGroupId(null);
    }
    if (!historyStack.includes('split-receipt')) {
      setViewingGroupId(null);
    }
    if (!historyStack.includes('configure-account')) {
      setConfiguringAccountId(null);
    }
  }, [historyStack]);

  // Centralized Navigation Pushes
  const handleNavigate = (viewId: string, queryParams?: string) => {
    // If navigating to detail screens, push into URL query parameters
    const url = queryParams ? `?view=${viewId}&${queryParams}` : `?view=${viewId}`;
    window.history.pushState({ view: viewId }, '', url);

    if (queryParams) {
      const params = new URLSearchParams(queryParams);
      if (viewId === 'configure-account') {
        const aid = params.get('accountId');
        if (aid) setConfiguringAccountId(aid);
      } else if (viewId === 'split-receipt') {
        const gid = params.get('groupId');
        if (gid) setViewingGroupId(gid);
      }
    }

    setHistoryStack((prev) => {
      if (prev.includes(viewId)) {
        const idx = prev.indexOf(viewId);
        return prev.slice(0, idx + 1);
      }
      return [...prev, viewId];
    });
  };

  // Base Tab switches (resets navigation stack root)
  const handleTabChange = (tabId: string) => {
    window.history.replaceState({ view: tabId }, '', `?view=${tabId}`);
    setHistoryStack([tabId]);
  };

  const handleEditExpense = (groupId: string) => {
    setEditingGroupId(groupId);
    handleNavigate('expense-form');
  };

  const handleViewSplit = (groupId: string) => {
    setViewingGroupId(groupId);
    handleNavigate('split-receipt');
  };

  const handleMonthOffset = (offset: number) => {
    const now = Date.now();
    if (now - lastMonthChangeTime.current < 300) {
      return;
    }
    lastMonthChangeTime.current = now;

    setActiveMonth((prev) => {
      const next = new Date(prev);
      next.setDate(1); // Crucial: Set day to 1st first to prevent rollover overflow bug on the 31st of a month (e.g. May 31 + 1 month -> June 31 -> July 1)
      next.setMonth(next.getMonth() + offset);
      return next;
    });
  };

  // Class helper to assign active/sliding positions based on stack indices
  const getViewClass = (viewId: string) => {
    const activeView = historyStack[historyStack.length - 1];
    if (activeView === viewId) {
      return 'view state-active';
    }
    const idx = historyStack.indexOf(viewId);
    if (idx === -1) {
      return 'view state-offscreen';
    }
    return 'view state-behind';
  };

  // Determine underlying base tab to highlight active tab buttons
  const getActiveTab = () => {
    for (let i = historyStack.length - 1; i >= 0; i--) {
      const view = historyStack[i];
      if (view === 'dashboard' || view === 'overview' || view === 'settings') {
        return view;
      }
    }
    return 'dashboard';
  };

  const activeView = historyStack[historyStack.length - 1];
  const showBottomNav = activeView === 'dashboard' || activeView === 'overview' || activeView === 'settings';

  if (!isDbLoaded) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#121212',
        color: '#fff',
        fontFamily: 'Outfit, sans-serif'
      }}>
        <div style={{ fontSize: '32px', marginBottom: '16px', animation: 'pulse 1.5s infinite' }}>⚡</div>
        <span style={{ fontSize: '14px', fontWeight: 500, letterSpacing: '1px', color: 'var(--text-secondary)' }}>
          LOADING FAHH!...
        </span>
      </div>
    );
  }

  return (
    <div className={`app-container ${isModalActive || isAuthDrawerOpen ? 'modal-active' : ''}`}>
      {/* 1. Dashboard View */}
      <section className={getViewClass('dashboard')}>
        <Dashboard
          activeAccountId={activeAccountId}
          activeMonth={activeMonth}
          onMonthChange={handleMonthOffset}
          onNavigate={handleNavigate}
          onEditExpense={handleEditExpense}
          onViewSplit={handleViewSplit}
          onModalToggle={(open) => setIsModalActive(open)}
          isActive={activeView === 'dashboard'}
          onProfileClick={handleOpenAuth}
        />
      </section>
 
      {/* 2. Expenses Overview View */}
      {historyStack.includes('overview') && (
        <section className={getViewClass('overview')}>
          <ExpensesOverview
            activeAccountId={activeAccountId}
            activeMonth={activeMonth}
            onNavigate={handleNavigate}
            onEditExpense={handleEditExpense}
            onViewSplit={handleViewSplit}
            onModalToggle={(open) => setIsModalActive(open)}
            isActive={activeView === 'overview'}
          />
        </section>
      )}

      {/* 3. New / Edit Expense Form View */}
      {historyStack.includes('expense-form') && (
        <section className={getViewClass('expense-form')}>
          <ExpenseForm
            activeAccountId={activeAccountId}
            editingGroupId={editingGroupId}
            onClose={() => window.history.back()}
            activeMonth={activeMonth}
          />
        </section>
      )}

      {/* 4. Split Receipt Details View */}
      {historyStack.includes('split-receipt') && viewingGroupId && (
        <section className={getViewClass('split-receipt')}>
          <SplitReceipt
            groupId={viewingGroupId}
            activeAccountId={activeAccountId}
            onClose={() => window.history.back()}
          />
        </section>
      )}

      {/* 5. Settings Configuration View */}
      {historyStack.includes('settings') && (
        <section className={getViewClass('settings')}>
          <Settings
            activeAccountId={activeAccountId}
            onNavigate={handleNavigate}
            onModalToggle={(open) => setIsModalActive(open)}
            onProfileClick={handleOpenAuth}
          />
        </section>
      )}

      {/* 6. Configure Account View */}
      {historyStack.includes('configure-account') && (
        <section className={getViewClass('configure-account')}>
          <ConfigureAccount
            accountId={configuringAccountId}
            onClose={() => window.history.back()}
          />
        </section>
      )}

      {/* 6b. Owed Details View */}
      {historyStack.includes('owe-details') && (
        <section className={getViewClass('owe-details')}>
          <OweDetails
            activeAccountId={activeAccountId}
            onClose={() => window.history.back()}
          />
        </section>
      )}

      {/* 7. Global PWA Floating Bottom Navigation */}
      {showBottomNav && (
        <BottomNav
          activeTab={getActiveTab()}
          onTabChange={handleTabChange}
          onAddTrigger={() => {
            setEditingGroupId(null);
            handleNavigate('expense-form');
          }}
        />
      )}

      {/* 7. Global Supabase Authentication Slider Drawer */}
      <AuthDrawer isOpen={isAuthDrawerOpen} onClose={() => {
        setIsAuthDrawerOpen(false);
        // pop modal out of window history
        if (window.location.search.includes('modal=auth')) {
          window.history.back();
        }
      }} />

      {/* 8. Global First Sync Progress Overlay */}
      {showFirstSyncScreen && (
        <FirstSyncOverlay
          status={syncStatus}
          error={syncError}
          onRetry={() => handleSyncAccounts(sessionUser)}
          onCancel={async () => {
            // Skips sync by marking it as completed for this session
            if (sessionUser) {
              await db.put('settings', { key: `firstSyncCompleted_${sessionUser.id}`, value: true });
            }
            setShowFirstSyncScreen(false);
            setSyncStatus('idle');
          }}
        />
      )}
    </div>
  );
}

export default App;
