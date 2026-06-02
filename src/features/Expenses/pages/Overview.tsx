import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../Settings/models/store';
import { useExpensesStore } from '../models/store';
import { TransactionCard } from '../../../components/TransactionCard';

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
  const { categories, loadCategories } = useSettingsStore();
  const {
    loadExpensesData,
    deleteExpenseGroup,
    getTotalExpensesForMonth,
    getOverviewCategorySums,
    getOverviewDayGroups
  } = useExpensesStore();

  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [hoveredCategory, setHoveredCategory] = useState<{ icon: string; percent: string } | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [activeActionGroupId, setActiveActionGroupId] = useState<string | null>(null);
  const [activeActionGroupDesc, setActiveActionGroupDesc] = useState<string>('');

  // Parallel load categories and expenses data
  useEffect(() => {
    if (isActive) {
      Promise.all([
        loadCategories(activeAccountId),
        loadExpensesData(activeAccountId)
      ]);
    }
  }, [activeAccountId, isActive, loadCategories, loadExpensesData]);

  // Popstate history back overlay close registers
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

  // Sync actions modal state with App view z-index wrapper
  useEffect(() => {
    if (onModalToggle) {
      onModalToggle(!!activeActionGroupId);
    }
  }, [activeActionGroupId, onModalToggle]);

  const handleDeleteGroup = async (groupId: string) => {
    if (confirm('Are you sure you want to delete this transaction and all its items? This action cannot be undone.')) {
      await deleteExpenseGroup(groupId, activeAccountId);
    }
  };

  // Derive overview data from Zustand store selectors reactively
  const totalBill = getTotalExpensesForMonth(activeMonth);
  const categorySums = getOverviewCategorySums(activeMonth, categories);
  const dayGroups = getOverviewDayGroups(activeMonth, selectedCategory);

  // Center indicator display logic (prioritizes hovered, then selected category, then highest spending category)
  const getCenterIndicator = () => {
    if (hoveredCategory) {
      return hoveredCategory;
    }
    if (totalBill > 0 && categorySums.length > 0) {
      if (selectedCategory !== 'all') {
        const activeCat = categorySums.find(c => c.name === selectedCategory);
        if (activeCat) {
          return {
            icon: activeCat.icon || '📦',
            percent: `${((activeCat.amount / totalBill) * 100).toFixed(0)}%`
          };
        }
      } else {
        const highest = categorySums[0];
        return {
          icon: highest.icon,
          percent: `${((highest.amount / totalBill) * 100).toFixed(0)}%`
        };
      }
    }
    return null;
  };

  const centerInfo = getCenterIndicator();

  // SVG Donut offset calculator helpers
  const radius = 70;
  const circumference = 2 * Math.PI * radius; // ~439.82
  let strokeOffsetAccumulator = 0;

  return (
    <>
      <header className="view-header" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button className="icon-btn" onClick={() => onNavigate('dashboard')} aria-label="Back" style={{ zIndex: 5 }}>
          <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </button>
        
        <h1 className="view-title" style={{ 
          position: 'absolute', 
          left: '50%', 
          transform: 'translateX(-50%)', 
          margin: 0,
          textAlign: 'center',
          fontSize: '18px',
          fontWeight: 700,
          width: 'max-content',
          fontFamily: "'Plus Jakarta Sans', sans-serif"
        }}>
          Expenses
        </h1>
        
        <button className="icon-btn" aria-label="Menu" style={{ zIndex: 5 }}>
          <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '20px', height: '20px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
          </svg>
        </button>
      </header>

      <div className="scroll-content padding-bottom-large">
        
        <div className="overview-sub-header" style={{ padding: '0 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <span className="sub-section-title" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1px' }}>OVERVIEW</span>
          <div className="dropdown-filter-container" style={{ position: 'relative' }}>
            <button 
              className="dropdown-badge-btn"
              onClick={() => setIsFilterDropdownOpen(prev => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '20px',
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <span>{selectedCategory === 'all' ? 'All' : selectedCategory}</span>
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '10px', height: '10px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            
            {isFilterDropdownOpen && (
              <div 
                className="dropdown-menu" 
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '6px',
                  backgroundColor: '#1c1c1e',
                  border: '1px solid var(--border-light)',
                  borderRadius: '12px',
                  padding: '6px',
                  zIndex: 200,
                  minWidth: '140px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                }}
              >
                <div 
                  className={`dropdown-item ${selectedCategory === 'all' ? 'active' : ''}`}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: selectedCategory === 'all' ? '#fff' : 'var(--text-secondary)',
                    backgroundColor: selectedCategory === 'all' ? 'rgba(255,255,255,0.06)' : 'transparent',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
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
                    style={{
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: selectedCategory === cat.name ? '#fff' : 'var(--text-secondary)',
                      backgroundColor: selectedCategory === cat.name ? 'rgba(255,255,255,0.06)' : 'transparent',
                      cursor: 'pointer',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onClick={() => {
                      setSelectedCategory(cat.name);
                      setIsFilterDropdownOpen(false);
                    }}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 1. Dynamic SVG Doughnut Chart */}
        <div className="chart-container" style={{ margin: '16px 0 32px 0' }}>
          <div className="donut-chart-wrapper" style={{ cursor: 'pointer' }} onClick={() => setSelectedCategory('all')}>
            <svg id="donut-chart-svg" viewBox="0 0 200 200" width="180" height="180">
              <circle cx="100" cy="100" r={radius} fill="none" stroke="#262626" strokeWidth="18" />
              {categorySums.map((share, idx) => {
                const percentage = share.amount / totalBill;
                const segmentLength = circumference * percentage;
                const offset = strokeOffsetAccumulator;
                strokeOffsetAccumulator += segmentLength;

                const isSelected = selectedCategory === share.name;

                return (
                  <circle
                    key={idx}
                    cx="100"
                    cy="100"
                    r={radius}
                    fill="none"
                    stroke={share.textColor}
                    strokeWidth={isSelected ? '22' : '18'}
                    strokeDasharray={`${segmentLength} ${circumference}`}
                    strokeDashoffset={-offset}
                    className="chart-segment"
                    style={{
                      transition: 'stroke-width 0.25s ease, filter 0.25s ease',
                      filter: isSelected ? 'drop-shadow(0 0 3px rgba(255,255,255,0.2))' : undefined
                    }}
                    onMouseOver={() => {
                      setHoveredCategory({
                        icon: share.icon,
                        percent: `${(percentage * 100).toFixed(0)}%`
                      });
                    }}
                    onMouseLeave={() => setHoveredCategory(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCategory(share.name);
                    }}
                  />
                );
              })}
            </svg>
            
            <div 
              className={`chart-center-indicator ${centerInfo ? '' : 'hidden'}`} 
              id="chart-center-badge"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none'
              }}
            >
              {centerInfo && (
                <>
                  <span className="center-indicator-icon" style={{ fontSize: '26px', marginBottom: '2px' }}>{centerInfo.icon}</span>
                  <span className="center-indicator-value" style={{ fontFamily: 'Space Mono, monospace', fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{centerInfo.percent}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 2. Grouped Transaction History */}
        <div className="overview-list-section">
          <div className="transactions-list-grouped" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {dayGroups.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px 0', fontSize: '13px' }}>
                No transaction records match the filters.
              </div>
            ) : (
              dayGroups.map((group, groupIdx) => (
                <div key={groupIdx} className="day-header-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h3 className="day-title" style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.5px', margin: '4px 0', textTransform: 'uppercase' }}>
                    {group.dayTitle}
                  </h3>
                  
                  {group.list.map((groupVal: any) => {
                    const isExpanded = expandedGroupId === groupVal.id;

                    return (
                      <TransactionCard
                        key={groupVal.id}
                        group={groupVal}
                        isExpanded={isExpanded}
                        onToggleAccordion={(groupId) => setExpandedGroupId(prev => (prev === groupId ? null : groupId))}
                        onViewSplit={onViewSplit}
                        onTriggerActions={(groupId, groupDesc) => {
                          setActiveActionGroupId(groupId);
                          setActiveActionGroupDesc(groupDesc);
                          window.history.pushState({ modal: 'actions' }, '', '?modal=actions');
                        }}
                        categories={categories}
                      />
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
            window.history.back();
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
                  window.history.back();
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
                  window.history.back();
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
