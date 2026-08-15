import React, { useState, useEffect } from 'react';
import { TransactionCard } from '../../../components/TransactionCard';
import { Category } from '../../../types';

interface RecentExpensesWidgetProps {
  groups: any[];
  activeAccountId: string;
  activeMonth: Date;
  expandedGroupId: string | null;
  onToggleAccordion: (groupId: string) => void;
  onViewSplit: (groupId: string) => void;
  onTriggerActions: (groupId: string, groupDesc: string) => void;
  allCategories?: Category[];
}

export const RecentExpensesWidget: React.FC<RecentExpensesWidgetProps> = ({
  groups,
  activeAccountId,
  activeMonth,
  expandedGroupId,
  onToggleAccordion,
  onViewSplit,
  onTriggerActions,
  allCategories = []
}) => {
  const [visibleCount, setVisibleCount] = useState<number>(10);

  // Reset pagination limit when the active month or account changes
  useEffect(() => {
    setVisibleCount(10);
  }, [activeAccountId, activeMonth.getTime()]);

  const displayedGroups = groups.slice(0, visibleCount);
  const hasMore = groups.length > visibleCount;

  const handleLoadMore = () => {
    setVisibleCount(prev => prev + 10);
  };

  return (
    <div className="recent-expenses-section">
      <h2 className="section-title">RECENT EXPENSES</h2>
      <div className="transactions-list">
        {groups.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0', fontSize: '13px' }}>
            No expenses recorded this month.
          </div>
        ) : (
          <>
            {displayedGroups.map((group) => {
              const isExpanded = expandedGroupId === group.id;

              return (
                <TransactionCard
                  key={group.id}
                  group={group}
                  isExpanded={isExpanded}
                  onToggleAccordion={onToggleAccordion}
                  onViewSplit={onViewSplit}
                  onTriggerActions={onTriggerActions}
                  categories={allCategories}
                />
              );
            })}
            
            {hasMore && (
              <button
                type="button"
                className="load-more-btn"
                onClick={handleLoadMore}
              >
                <span>Load More</span>
                <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '14px', height: '14px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
