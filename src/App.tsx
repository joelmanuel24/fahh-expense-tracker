import { useState, useEffect } from 'react';
import { db } from './db';
import { BottomNav } from './components/BottomNav';
import { Dashboard } from './views/Dashboard';
import { ExpensesOverview } from './views/ExpensesOverview';
import { ExpenseForm } from './views/ExpenseForm';
import { SplitReceipt } from './components/SplitReceipt';
import { Settings } from './views/Settings';
import './App.css';

function App() {
  const [activeAccountId, setActiveAccountId] = useState<string>('');
  const [activeMonth, setActiveMonth] = useState<Date>(new Date());
  
  // Navigation Stack Router State
  const [historyStack, setHistoryStack] = useState<string[]>(['dashboard']);
  
  // Sub-view item trackers
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [viewingGroupId, setViewingGroupId] = useState<string | null>(null);
  
  const [isDbLoaded, setIsDbLoaded] = useState<boolean>(false);
  const [isModalActive, setIsModalActive] = useState<boolean>(false);

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
        setHistoryStack([view]);
        window.history.replaceState({ view }, '', `?view=${view}`);
      }
    };
    initializeApp();
  }, []);

  // Intercept and reconcile Browser hardware back buttons (Popstate events)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const params = new URLSearchParams(window.location.search);
      
      // If popping a modal overlay, ignore screen stack changes
      if (params.has('modal')) return;

      const targetView = params.get('view') || 'dashboard';
      
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

  // Centralized Navigation Pushes
  const handleNavigate = (viewId: string, queryParams?: string) => {
    // If navigating to detail screens, push into URL query parameters
    const url = queryParams ? `?view=${viewId}&${queryParams}` : `?view=${viewId}`;
    window.history.pushState({ view: viewId }, '', url);
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
    setActiveMonth((prev) => {
      const next = new Date(prev);
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
    <div className={`app-container ${isModalActive ? 'modal-active' : ''}`}>
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
          />
        </section>
      )}

      {/* 6. Global PWA Floating Bottom Navigation */}
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
    </div>
  );
}

export default App;
