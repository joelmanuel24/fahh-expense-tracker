import React from 'react';
import { TransactionCard } from '../../../components/TransactionCard';
import { Category } from '../../../types';

interface RecentExpensesWidgetProps {
  groups: any[];
  expandedGroupId: string | null;
  onToggleAccordion: (groupId: string) => void;
  onViewSplit: (groupId: string) => void;
  onTriggerActions: (groupId: string, groupDesc: string) => void;
  allCategories?: Category[];
}

export const RecentExpensesWidget: React.FC<RecentExpensesWidgetProps> = ({
  groups,
  expandedGroupId,
  onToggleAccordion,
  onViewSplit,
  onTriggerActions,
  allCategories = []
}) => {
  return (
    <div className="recent-expenses-section">
      <h2 className="section-title">RECENT EXPENSES</h2>
      <div className="transactions-list">
        {groups.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0', fontSize: '13px' }}>
            No expenses recorded this month.
          </div>
        ) : (
          groups.map((group) => {
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
          })
        )}
      </div>
    </div>
  );
};
