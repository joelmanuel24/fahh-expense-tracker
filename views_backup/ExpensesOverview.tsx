import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { ExpenseGroup, ExpenseItem, Category } from '../types';
import { sortItemsByIds } from './Settings';

interface ExpensesOverviewProps {
  activeAccountId: string;
  activeMonth: Date;
  onNavigate: (viewId: string) => void;
  onEditExpense: (groupId: string) => void;
  onViewSplit: (groupId: string) => void;
  onModalToggle?: (open: boolean) => void;
  isActive: boolean;
}

export const ExpensesOverview: React.FC<ExpensesOverviewProps> = ({
  activeAccountId,
  activeMonth,
  onNavigate,
  onEditExpense,
  onViewSplit,
  onModalToggle,
  isActive
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [totalBill, setTotalBill] = useState<number>(0);
  const [categorySums, setCategorySums] = useState<any[]>([]);
  const [dayGroups, setDayGroups] = useState<any[]>([]);
  const [hoveredCategory, setHoveredCategory] = useState<{ icon: string; percent: string } | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [activeActionGroupId, setActiveActionGroupId] = useState<string | null>(null);
  const [activeActionGroupDesc, setActiveActionGroupDesc] = useState<string>('');

  // Load static categories
  useEffect(() => {
    const loadCategories = async () => {
      const allCats = await db.getGroupedByIndex<Category>('categories', 'accountId', activeAccountId);
      const categoriesOrder = await db.get<{ key: string; value: string[] }>('settings', 'categories_order');
      setCategories(sortItemsByIds(allCats, categoriesOrder ? categoriesOrder.value : null));
    };
    if (isActive) {
      loadCategories();
    }
  }, [activeAccountId, isActive]);

  // Popstate back button listener to close drawer overlays
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
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
      onModalToggle(!!activeActionGroupId);
    }
  }, [activeActionGroupId, onModalToggle]);

  // Calculate and group transactions
  const calculateData = async () => {
    const allGroups = await db.getGroupedByIndex<ExpenseGroup>('expense_groups', 'accountId', activeAccountId);
    const targetYear = activeMonth.getFullYear();
    const targetMonth = activeMonth.getMonth();

    const monthlyGroups = allGroups.filter((g) => {
      const d = new Date(g.date);
      return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
    });

    const allItems = await db.getAll<ExpenseItem>('expense_items');
    const monthlyItems = allItems.filter(item => monthlyGroups.some(g => g.id === item.groupId));

    // Helper to check if a groupId belongs to a KKB group
    const kkbGroupIds = new Set<string>();
    monthlyGroups.forEach(g => {
      const groupItems = allItems.filter(item => item.groupId === g.id);
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

    // Compute total sum
    const billSum = monthlyItems.filter(shouldIncludeItemInAccount).reduce((acc, curr) => acc + curr.amount, 0);
    setTotalBill(billSum);

    // Compute category summaries
    const sums: any[] = [];
    categories.forEach((cat) => {
      const sum = monthlyItems
        .filter(item => item.category === cat.name && shouldIncludeItemInAccount(item))
        .reduce((acc, curr) => acc + curr.amount, 0);
      if (sum > 0) {
        sums.push({
          name: cat.name,
          amount: sum,
          icon: cat.icon,
          bgColor: cat.bgColor,
          textColor: cat.textColor
        });
      }
    });
    setCategorySums(sums);

    // Filter groups by selected category
    const filteredGroups = monthlyGroups.filter((g) => {
      const groupItems = monthlyItems.filter(item => item.groupId === g.id);
      if (selectedCategory === 'all') return true;
      return groupItems.some(item => item.category === selectedCategory);
    });

    // Group by friendly date headers
    const friendlyDateFormatter = (dateStr: string) => {
      const today = new Date();
      today.setHours(0,0,0,0);
      const target = new Date(dateStr);
      target.setHours(0,0,0,0);

      const diffTime = today.getTime() - target.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays > 1 && diffDays < 7) {
        const options = { weekday: 'long' } as const;
        return `Last ${target.toLocaleDateString('default', options)}`;
      }
      return target.toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' });
    };

    const sortedGroups = filteredGroups.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateB !== dateA) {
        return dateB - dateA;
      }
      return b.id.localeCompare(a.id);
    });
    
    const groupedMap = new Map<string, any[]>();
    sortedGroups.forEach((g) => {
      const header = friendlyDateFormatter(g.date);
      const groupItems = monthlyItems.filter(item => item.groupId === g.id);
      const groupTotal = groupItems.reduce((acc, curr) => acc + curr.amount, 0);
      const populated = {
        ...g,
        items: groupItems,
        total: groupTotal
      };

      if (!groupedMap.has(header)) {
        groupedMap.set(header, []);
      }
      groupedMap.get(header)!.push(populated);
    });

    const dayGroupsList: any[] = [];
    for (const [dayTitle, list] of groupedMap.entries()) {
      dayGroupsList.push({ dayTitle, list });
    }
    setDayGroups(dayGroupsList);
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (confirm('Are you sure you want to delete this transaction and all its items? This action cannot be undone.')) {
      await db.deleteExpenseGroup(groupId);
      calculateData();
    }
  };

  useEffect(() => {
    if (isActive && categories.length > 0) {
      calculateData();
    }
  }, [activeAccountId, activeMonth, categories, selectedCategory, isActive]);

  // Doughnut drawing calculations
  const radius = 70;
  const circumference = 2 * Math.PI * radius; // ~439.82
  let strokeOffsetAccumulator = 0;

  return (
    <>
      <header className="view-header">
        <button className="icon-btn" onClick={() => onNavigate('dashboard')} aria-label="Back">
          <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </button>
        <h1 className="view-title">Expenses</h1>
        <div style={{ width: '40px' }}></div>
      </header>

      <div className="scroll-content padding-bottom-large">
        <div className="overview-sub-header">
          <span className="sub-section-title">OVERVIEW</span>
          <div className="dropdown-filter-container">
            <button 
              className="dropdown-badge-btn"
              onClick={() => setIsFilterDropdownOpen(prev => !prev)}
            >
              <span>{selectedCategory === 'all' ? 'All' : selectedCategory}</span>
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            
            <div className={`dropdown-menu ${isFilterDropdownOpen ? '' : 'hidden'}`}>
              <div 
                className={`dropdown-item ${selectedCategory === 'all' ? 'active' : ''}`}
                onClick={() => {
                  setSelectedCategory('all');
                  setIsFilterDropdownOpen(false);
                }}
              >
                All
              </div>
              {categories.map((cat) => (
                <div 
                  key={cat.id}
                  className={`dropdown-item ${selectedCategory === cat.name ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedCategory(cat.name);
                    setIsFilterDropdownOpen(false);
                  }}
                >
                  {cat.name}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 1. Dynamic SVG Doughnut Chart */}
        <div className="chart-container">
          <div className="donut-chart-wrapper">
            <svg id="donut-chart-svg" viewBox="0 0 200 200" width="180" height="180">
              <circle cx="100" cy="100" r={radius} fill="none" stroke="#262626" strokeWidth="18" />
              {categorySums.map((share, idx) => {
                const percentage = share.amount / totalBill;
                const segmentLength = circumference * percentage;
                const offset = strokeOffsetAccumulator;
                strokeOffsetAccumulator += segmentLength;

                return (
                  <circle
                    key={idx}
                    cx="100"
                    cy="100"
                    r={radius}
                    fill="none"
                    stroke={share.textColor}
                    strokeWidth="18"
                    strokeDasharray={`${segmentLength} ${circumference}`}
                    strokeDashoffset={-offset}
                    className="chart-segment"
                    onMouseOver={() => {
                      setHoveredCategory({
                        icon: share.icon,
                        percent: `${(percentage * 100).toFixed(0)}%`
                      });
                    }}
                    onClick={() => {
                      setSelectedCategory(share.name);
                    }}
                  />
                );
              })}
            </svg>
            
            <div className={`chart-center-indicator ${hoveredCategory ? '' : 'hidden'}`} id="chart-center-badge">
              {hoveredCategory && (
                <>
                  <span className="center-indicator-icon">{hoveredCategory.icon}</span>
                  <span className="center-indicator-value">{hoveredCategory.percent}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 2. Grouped Transaction History */}
        <div className="overview-list-section">
          <div className="transactions-list-grouped">
            {dayGroups.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0', fontSize: '13px' }}>
                No transaction records match the filters.
              </div>
            ) : (
              dayGroups.map((group, groupIdx) => (
                <div key={groupIdx} className="day-header-group">
                  <h3 className="day-title">{group.dayTitle}</h3>
                  {group.list.map((groupVal: any) => {
                    const isExpanded = expandedGroupId === groupVal.id;
                    const hasKKBSplit = groupVal.items.some((i: any) => i.splitUser && i.splitUser.trim() !== '');
                    const myShare = groupVal.items
                      .filter((i: any) => i.splitUser && i.splitUser.trim().toLowerCase() === 'me')
                      .reduce((acc: number, curr: any) => acc + curr.amount, 0);

                    return (
                      <div 
                        key={groupVal.id}
                        className={`transaction-group-card ${isExpanded ? 'expanded' : ''}`}
                        onClick={() => setExpandedGroupId(prev => (prev === groupVal.id ? null : groupVal.id))}
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
                                {groupVal.description}
                              </span>
                              <span className="group-payment-method-label">{groupVal.paymentMethod}</span>
                            </div>
                          </div>
                          <div className="card-right-amount">
                            <span className="amount-text">
                              {hasKKBSplit ? (
                                `PHP ${myShare % 1 === 0 ? myShare.toFixed(0) : myShare.toFixed(2)}/${groupVal.total.toFixed(2)}`
                              ) : (
                                `PHP ${groupVal.total.toFixed(2)}`
                              )}
                            </span>
                            <span className="sub-item-detail">{groupVal.items.length} item{groupVal.items.length > 1 ? 's' : ''}</span>
                          </div>
                        </div>

                        <div className="card-accordion-content">
                          {groupVal.items.map((item: any) => (
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
                                  onViewSplit(groupVal.id);
                                }}
                              >
                                View Split
                              </button>
                            )}

                            <button 
                              type="button" 
                              className="more-actions-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveActionGroupId(groupVal.id);
                                setActiveActionGroupDesc(groupVal.description);
                                window.history.pushState({ modal: 'actions' }, '', '?modal=actions');
                              }}
                              aria-label="More Actions"
                            >
                              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
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
