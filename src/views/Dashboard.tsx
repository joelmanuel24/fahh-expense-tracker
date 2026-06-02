import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { Account, ExpenseGroup, ExpenseItem, Category } from '../types';

interface DashboardProps {
  activeAccountId: string;
  activeMonth: Date;
  onMonthChange: (offset: number) => void;
  onNavigate: (viewId: string, queryParams?: string) => void;
  onEditExpense: (groupId: string) => void;
  onViewSplit: (groupId: string) => void;
  onModalToggle?: (open: boolean) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  activeAccountId,
  activeMonth,
  onMonthChange,
  onNavigate,
  onEditExpense,
  onViewSplit,
  onModalToggle
}) => {
  const [accountName, setAccountName] = useState<string>('Personal Account');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isAccountSheetOpen, setIsAccountSheetOpen] = useState<boolean>(false);
  const [isBalanceVisible, setIsBalanceVisible] = useState<boolean>(true);
  const [totalExpenses, setTotalExpenses] = useState<number>(0);
  const [categorySummaries, setCategorySummaries] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<any[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);

  // Sync active account details and widgets order
  useEffect(() => {
    const loadAccountInfo = async () => {
      const activeAcc = await db.get<Account>('accounts', activeAccountId);
      if (activeAcc) {
        setAccountName(activeAcc.name);
      }
      const allAccs = await db.getAll<Account>('accounts');
      setAccounts(allAccs);

      // Load all categories for quick shortcut grid
      const catsList = await db.getGroupedByIndex<Category>('categories', 'accountId', activeAccountId);
      setAllCategories(catsList);

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
    loadAccountInfo();
  }, [activeAccountId]);

  // Popstate back button listener to close accounts drawer overlay
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('modal') !== 'accounts') {
        setIsAccountSheetOpen(false);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sync bottom sheet state to parent view z-index wrapper
  useEffect(() => {
    if (onModalToggle) {
      onModalToggle(isAccountSheetOpen);
    }
  }, [isAccountSheetOpen, onModalToggle]);

  // Load monthly totals and expenses
  useEffect(() => {
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

      // 3. Compute total balance sum
      const billSum = monthlyItems.reduce((acc, curr) => acc + curr.amount, 0);
      setTotalExpenses(billSum);

      // 4. Compute categories sum
      const categoriesList = await db.getGroupedByIndex<Category>('categories', 'accountId', activeAccountId);
      const sums = categoriesList.map((cat) => {
        const sum = monthlyItems
          .filter(item => item.category === cat.name)
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
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setGroups(populatedGroups);
    };

    loadDashboardData();
  }, [activeAccountId, activeMonth]);

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
              <div 
                key="total_expenses"
                className="total-expenses-card" 
                onClick={() => onNavigate('overview')}
              >
                <span className="card-label">TOTAL EXPENSES</span>
                <div className="balance-display-row">
                  <span className="currency-value">
                    {isBalanceVisible ? `PHP ${totalExpenses.toFixed(2)}` : 'PHP ••••••'}
                  </span>
                  <button 
                    className="icon-btn-tinted" 
                    onClick={(e) => {
                      e.stopPropagation(); // Avoid navigating to overview
                      setIsBalanceVisible(prev => !prev);
                    }}
                    aria-label="Toggle Balance Visibility"
                  >
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.43 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  </button>
                </div>
                <span className="card-subtitle">THIS MONTH</span>
              </div>
            );
          }

          if (widget.id === 'categories') {
            return (
              <div key="categories" className="categories-section">
                <div className="categories-grid">
                  {categorySummaries.map((cat, idx) => (
                    <div key={idx} className="category-bubble-card">
                      <div className="icon-bubble" style={{ backgroundColor: cat.bgColor, color: cat.textColor }}>
                        {cat.icon}
                      </div>
                      <span className="category-name">{cat.name}</span>
                      <span className="amount-text" style={{ fontSize: '11px', color: 'var(--text-primary)' }}>
                        PHP {cat.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          if (widget.id === 'category_grid') {
            return (
              <div key="category_grid" style={{ marginBottom: '24px', padding: '0 4px', position: 'relative' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  {allCategories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className="category-bubble-card"
                      style={{ 
                        background: 'transparent',
                        border: 'none',
                        padding: '6px 2px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'var(--transition-spring)',
                        position: 'relative'
                      }}
                      onClick={() => onNavigate('expense-form', `quickAddCategory=${encodeURIComponent(cat.name)}`)}
                    >
                      <div className="icon-bubble" style={{ 
                        backgroundColor: cat.bgColor, 
                        color: cat.textColor, 
                        width: '52px', 
                        height: '52px', 
                        borderRadius: '18px', 
                        fontSize: '24px', 
                        boxShadow: '0 4px 10px rgba(0, 0, 0, 0.12)' 
                      }}>
                        {cat.icon}
                      </div>
                      <span className="category-name" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                        {cat.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          }

          if (widget.id === 'recent_expenses') {
            return (
              <div key="recent_expenses" className="recent-expenses-section">
                <h2 className="section-title">RECENT EXPENSES</h2>
                <div className="transactions-list">
                  {groups.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0', fontSize: '13px' }}>
                      No expenses recorded this month.
                    </div>
                  ) : (
                    groups.map((group) => {
                      const isExpanded = expandedGroupId === group.id;
                      const hasKKBSplit = group.items.some((i: any) => i.splitUser && i.splitUser.trim() !== '');

                      return (
                        <div 
                          key={group.id} 
                          className={`transaction-group-card ${isExpanded ? 'expanded' : ''}`}
                          onClick={() => toggleAccordion(group.id)}
                        >
                          <div className="card-main-row">
                            <div className="card-left-info">
                              <div className="tiny-bubble-stack">
                                <div className="tiny-bubble" style={{ background: '#252528', color: 'var(--text-primary)', fontSize: '16px' }}>
                                  🧾
                                </div>
                                {hasKKBSplit && (
                                  <div className="kkb-badge">
                                    KKB
                                  </div>
                                )}
                              </div>
                              <div className="card-meta-text">
                                <span className="group-title-label">
                                  {group.description}
                                </span>
                                <span className="group-payment-method-label">{group.paymentMethod}</span>
                              </div>
                            </div>
                            <div className="card-right-amount">
                              <span className="amount-text">PHP {group.total.toFixed(2)}</span>
                              <span className="sub-item-detail">{group.items.length} item{group.items.length > 1 ? 's' : ''}</span>
                            </div>
                          </div>

                          <div className="card-accordion-content">
                            {group.items.map((item: any) => (
                              <div key={item.id} className="accordion-item-row">
                                <div className="item-left">
                                  <span>•</span>
                                  <span className="item-name">{item.description || 'Item'}</span>
                                  {item.splitUser && <span className="item-tag-user">{item.splitUser}</span>}
                                </div>
                                <span className="item-amount">PHP {item.amount.toFixed(2)}</span>
                              </div>
                            ))}
                            
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px', paddingTop: '8px', borderTop: '1px dashed rgba(255,255,255,0.06)' }}>
                              {hasKKBSplit && (
                                <button 
                                  type="button" 
                                  className="badge-action-btn view-split-slip-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onViewSplit(group.id);
                                  }}
                                >
                                  🧾 View Split
                                </button>
                              )}
                              <button 
                                type="button" 
                                className="badge-action-btn edit-group-pencil-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditExpense(group.id);
                                }}
                              >
                                ✏️ Edit
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
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

          <div className="sheet-footer-actions">
            <button 
              className="sheet-flat-action-btn"
              onClick={() => {
                setIsAccountSheetOpen(false);
                window.history.back();
                onNavigate('settings');
              }}
            >
              Manage Accounts
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
