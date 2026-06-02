import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { ExpenseGroup, ExpenseItem, Category } from '../types';

interface ExpensesOverviewProps {
  activeAccountId: string;
  activeMonth: Date;
  onNavigate: (viewId: string) => void;
  onEditExpense: (groupId: string) => void;
  onViewSplit: (groupId: string) => void;
}

export const ExpensesOverview: React.FC<ExpensesOverviewProps> = ({
  activeAccountId,
  activeMonth,
  onNavigate,
  onEditExpense,
  onViewSplit
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [totalBill, setTotalBill] = useState<number>(0);
  const [categorySums, setCategorySums] = useState<any[]>([]);
  const [dayGroups, setDayGroups] = useState<any[]>([]);
  const [hoveredCategory, setHoveredCategory] = useState<{ icon: string; percent: string } | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  // Load static categories
  useEffect(() => {
    const loadCategories = async () => {
      const allCats = await db.getGroupedByIndex<Category>('categories', 'accountId', activeAccountId);
      setCategories(allCats);
    };
    loadCategories();
  }, [activeAccountId]);

  // Calculate and group transactions
  useEffect(() => {
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

      // Compute total sum
      const billSum = monthlyItems.reduce((acc, curr) => acc + curr.amount, 0);
      setTotalBill(billSum);

      // Compute category summaries
      const sums: any[] = [];
      categories.forEach((cat) => {
        const sum = monthlyItems
          .filter(item => item.category === cat.name)
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

      const sortedGroups = filteredGroups.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
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

    if (categories.length > 0) {
      calculateData();
    }
  }, [activeAccountId, activeMonth, categories, selectedCategory]);

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
                            <span className="amount-text">PHP {groupVal.total.toFixed(2)}</span>
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
                                🧾 View Split
                              </button>
                            )}
                            <button 
                              type="button" 
                              className="badge-action-btn edit-group-pencil-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditExpense(groupVal.id);
                              }}
                            >
                              ✏️ Edit
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
    </>
  );
};
