import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { Account, ExpenseGroup, ExpenseItem, Category } from '../types';
import { sortItemsByIds } from './Settings';
import { TotalExpensesWidget } from '../components/TotalExpensesWidget';
import { CategoryListWidget } from '../components/CategoryListWidget';
import { CategoryGridWidget } from '../components/CategoryGridWidget';
import { RecentExpensesWidget } from '../components/RecentExpensesWidget';

interface DashboardProps {
  activeAccountId: string;
  activeMonth: Date;
  onMonthChange: (offset: number) => void;
  onNavigate: (viewId: string, queryParams?: string) => void;
  onEditExpense: (groupId: string) => void;
  onViewSplit: (groupId: string) => void;
  onModalToggle?: (open: boolean) => void;
  isActive: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({
  activeAccountId,
  activeMonth,
  onMonthChange,
  onNavigate,
  onEditExpense,
  onViewSplit,
  onModalToggle,
  isActive
}) => {
  const [accountName, setAccountName] = useState<string>('Personal');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isAccountSheetOpen, setIsAccountSheetOpen] = useState<boolean>(false);
  const [isBalanceVisible, setIsBalanceVisible] = useState<boolean>(true);
  const [totalExpenses, setTotalExpenses] = useState<number>(0);
  const [categorySummaries, setCategorySummaries] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<any[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [activeActionGroupId, setActiveActionGroupId] = useState<string | null>(null);
  const [activeActionGroupDesc, setActiveActionGroupDesc] = useState<string>('');

  const loadAccountInfo = async () => {
    const activeAcc = await db.get<Account>('accounts', activeAccountId);
    if (activeAcc) {
      setAccountName(activeAcc.name);
    }
    const allAccs = await db.getAll<Account>('accounts');
    const accountsOrder = await db.get<{ key: string; value: string[] }>('settings', 'accounts_order');
    setAccounts(sortItemsByIds(allAccs, accountsOrder ? accountsOrder.value : null));

    // Load all categories for quick shortcut grid
    const catsList = await db.getGroupedByIndex<Category>('categories', 'accountId', activeAccountId);
    const categoriesOrder = await db.get<{ key: string; value: string[] }>('settings', 'categories_order');
    setAllCategories(sortItemsByIds(catsList, categoriesOrder ? categoriesOrder.value : null));

    const saved = await db.get<{ key: string, value: any[] }>('settings', 'dashboardWidgets');
    const defaultWidgets = [
      { id: 'total_expenses', name: 'Total Expenses', visible: true },
      { id: 'categories', name: 'Category List', visible: true },
      { id: 'category_grid', name: 'Category Grid', visible: true },
      { id: 'recent_expenses', name: 'Recent Expenses', visible: true }
    ];
    
    let activeWidgets = defaultWidgets;
    if (saved && saved.value && Array.isArray(saved.value)) {
      const savedList = saved.value;
      const missing = defaultWidgets.filter(dw => !savedList.some(sw => sw.id === dw.id));
      if (missing.length > 0) {
        activeWidgets = [...savedList, ...missing];
        await db.put('settings', { key: 'dashboardWidgets', value: activeWidgets });
      } else {
        activeWidgets = savedList;
      }
    } else {
      await db.put('settings', { key: 'dashboardWidgets', value: defaultWidgets });
    }
    setWidgets(activeWidgets);
  };

  // Sync active account details and widgets order
  useEffect(() => {
    if (isActive) {
      loadAccountInfo();
    }
  }, [activeAccountId, isActive]);

  // Popstate back button listener to close drawer overlays
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('modal') !== 'accounts') {
        setIsAccountSheetOpen(false);
      }
      if (params.get('modal') !== 'actions') {
        setActiveActionGroupId(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sync bottom sheet state to parent view z-index wrapper
  useEffect(() => {
    if (onModalToggle) {
      onModalToggle(isAccountSheetOpen || !!activeActionGroupId);
    }
  }, [isAccountSheetOpen, activeActionGroupId, onModalToggle]);

  const loadDashboardData = async () => {
    // 1. Fetch scoped expense groups
    const allGroups = await db.getGroupedByIndex<ExpenseGroup>('expense_groups', 'accountId', activeAccountId);
    const targetYear = activeMonth.getFullYear();
    const targetMonth = activeMonth.getMonth();

    // Filter groups to active month
    const monthlyGroups = allGroups.filter((g) => {
      const d = new Date(g.date);
      return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
    });

    // 2. Fetch all items
    const allItems = await db.getAll<ExpenseItem>('expense_items');
    const monthlyItems = allItems.filter(item => monthlyGroups.some(g => g.id === item.groupId));

    // Helper to check if a groupId belongs to a KKB group
    const kkbGroupIds = new Set<string>();
    monthlyGroups.forEach(g => {
      const groupItems = monthlyItems.filter(item => item.groupId === g.id);
      const hasSplits = groupItems.some(i => i.splitUser && i.splitUser.trim() !== '');
      if (hasSplits) {
        kkbGroupIds.add(g.id);
      }
    });

    const shouldIncludeItemInAccount = (item: ExpenseItem) => {
      const hasSplits = kkbGroupIds.has(item.groupId);
      if (!hasSplits) return true;
      return item.splitUser?.trim().toLowerCase() === 'me';
    };

    // 3. Compute total balance sum
    const billSum = monthlyItems.filter(shouldIncludeItemInAccount).reduce((acc, curr) => acc + curr.amount, 0);
    setTotalExpenses(billSum);

    // 4. Compute categories sum
    const categoriesList = await db.getGroupedByIndex<Category>('categories', 'accountId', activeAccountId);
    const categoriesOrder = await db.get<{ key: string; value: string[] }>('settings', 'categories_order');
    const sortedCatsList = sortItemsByIds(categoriesList, categoriesOrder ? categoriesOrder.value : null);
    const sums = sortedCatsList.map((cat) => {
      const sum = monthlyItems
        .filter(item => item.category === cat.name && shouldIncludeItemInAccount(item))
        .reduce((acc, curr) => acc + curr.amount, 0);
      return {
        name: cat.name,
        amount: sum,
        icon: cat.icon,
        bgColor: cat.bgColor,
        textColor: cat.textColor
      };
    });
    setCategorySummaries(sums);

    // 5. Populate group-cards list with preloaded item arrays
    const populatedGroups = monthlyGroups.map((g) => {
      const groupItems = monthlyItems.filter(item => item.groupId === g.id);
      const groupTotal = groupItems.reduce((acc, curr) => acc + curr.amount, 0);
      return {
        ...g,
        items: groupItems,
        total: groupTotal
      };
    }).sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateB !== dateA) {
        return dateB - dateA;
      }
      return b.id.localeCompare(a.id);
    });

    setGroups(populatedGroups);
  };

  // Load monthly totals and expenses
  useEffect(() => {
    if (isActive) {
      loadDashboardData();
    }
  }, [activeAccountId, activeMonth, isActive]);

  const handleDeleteGroup = async (groupId: string) => {
    if (confirm('Are you sure you want to delete this transaction and all its items? This action cannot be undone.')) {
      await db.deleteExpenseGroup(groupId);
      loadDashboardData();
    }
  };

  const handleSwitchAccount = async (id: string) => {
    await db.put('settings', { key: 'activeAccountId', value: id });
    setIsAccountSheetOpen(false);
    window.location.reload(); // Quick refresh to reset global context safely
  };

  const toggleAccordion = (groupId: string) => {
    setExpandedGroupId(prev => (prev === groupId ? null : groupId));
  };

  const formatMonthYear = (date: Date): string => {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };

  return (
    <>
      {/* 1. Dashboard Header */}
      <header className="view-header">
        <button 
          id="account-switcher-trigger" 
          className="account-badge-btn"
          onClick={() => {
            setIsAccountSheetOpen(true);
            // Push modal query to url state
            window.history.pushState({ modal: 'accounts' }, '', '?modal=accounts');
          }}
        >
          <span id="active-account-name">{accountName}</span>
          <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="chevron-down-icon">
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        <div className="month-selector">
          <button className="icon-btn" onClick={() => onMonthChange(-1)} aria-label="Previous Month">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <span className="month-year-title" style={{ fontSize: '15px' }}>
            {formatMonthYear(activeMonth).split(' ')[0]}
            <span className="year-sub" style={{ fontSize: '10px' }}>{activeMonth.getFullYear()}</span>
          </span>
          <button className="icon-btn" onClick={() => onMonthChange(1)} aria-label="Next Month">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </div>
      </header>

      {/* 2. Main Content Area */}
      <div className="scroll-content padding-bottom-large">
        {widgets.map((widget) => {
          if (!widget.visible) return null;

          if (widget.id === 'total_expenses') {
            return (
              <TotalExpensesWidget
                key="total_expenses"
                totalExpenses={totalExpenses}
                isBalanceVisible={isBalanceVisible}
                onToggleBalance={() => setIsBalanceVisible(prev => !prev)}
                onNavigate={onNavigate}
              />
            );
          }

          if (widget.id === 'categories') {
            return (
              <CategoryListWidget
                key="categories"
                categorySummaries={categorySummaries}
              />
            );
          }

          if (widget.id === 'category_grid') {
            return (
              <CategoryGridWidget
                key="category_grid"
                allCategories={allCategories}
                onNavigate={onNavigate}
              />
            );
          }

          if (widget.id === 'recent_expenses') {
            return (
              <RecentExpensesWidget
                key="recent_expenses"
                groups={groups}
                expandedGroupId={expandedGroupId}
                onToggleAccordion={toggleAccordion}
                onViewSplit={onViewSplit}
                onTriggerActions={(groupId, groupDesc) => {
                  setActiveActionGroupId(groupId);
                  setActiveActionGroupDesc(groupDesc);
                  window.history.pushState({ modal: 'actions' }, '', '?modal=actions');
                }}
              />
            );
          }

          return null;
        })}
      </div>

      {/* 3. Account Switcher Bottom Sheet Modal */}
      <div className={`bottom-sheet-overlay ${isAccountSheetOpen ? '' : 'hidden'}`}>
        <div 
          className="sheet-scrim" 
          onClick={() => {
            setIsAccountSheetOpen(false);
            window.history.back(); // Trigger url cleanup
          }}
        ></div>
        <div className="sheet-content-wrapper">
          <div className="sheet-drag-indicator" onClick={() => {
            setIsAccountSheetOpen(false);
            window.history.back();
          }}></div>
          <h3 className="sheet-title">Switch Account</h3>
          
          <div className="sheet-accounts-list">
            {accounts.map((acc) => {
              const isActive = acc.id === activeAccountId;
              return (
                <div 
                  key={acc.id} 
                  className={`sheet-account-row ${isActive ? 'active' : ''}`}
                  onClick={() => handleSwitchAccount(acc.id)}
                >
                  <span className="row-name">{acc.name}</span>
                  <div className="check-dot"></div>
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* Transaction Actions Bottom Sheet */}
      <div className={`bottom-sheet-overlay ${activeActionGroupId ? '' : 'hidden'}`}>
        <div 
          className="sheet-scrim" 
          onClick={() => {
            setActiveActionGroupId(null);
            window.history.back(); // Trigger url cleanup
          }}
        ></div>
        <div className="sheet-content-wrapper">
          <div className="sheet-drag-indicator" onClick={() => {
            setActiveActionGroupId(null);
            window.history.back();
          }}></div>
          <h3 className="sheet-title">{activeActionGroupDesc || 'Transaction Actions'}</h3>
          
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
                if (activeActionGroupId) {
                  onEditExpense(activeActionGroupId);
                  setActiveActionGroupId(null);
                  window.history.back(); // Clean URL state
                }
              }}
            >
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '20px', height: '20px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.83 20.013a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
              Edit Transaction
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
                cursor: 'pointer',
                color: 'var(--color-danger)',
                fontWeight: 600,
                fontSize: '15px',
                textAlign: 'left',
                borderRadius: 'var(--radius-md)',
                transition: 'var(--transition-smooth)'
              }}
              onClick={() => {
                if (activeActionGroupId) {
                  handleDeleteGroup(activeActionGroupId);
                  setActiveActionGroupId(null);
                  window.history.back(); // Clean URL state
                }
              }}
            >
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '20px', height: '20px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
              Delete Transaction
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
