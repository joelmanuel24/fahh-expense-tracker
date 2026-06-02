import React from 'react';

interface TotalExpensesWidgetProps {
  totalExpenses: number;
  isBalanceVisible: boolean;
  onToggleBalance: () => void;
  onNavigate: (viewId: string) => void;
}

export const TotalExpensesWidget: React.FC<TotalExpensesWidgetProps> = ({
  totalExpenses,
  isBalanceVisible,
  onToggleBalance,
  onNavigate
}) => {
  return (
    <div 
      className="total-expenses-card" 
      onClick={() => onNavigate('overview')}
    >
      <div className="card-header-row">
        <span className="card-label">TOTAL EXPENSES</span>
        <span className="card-subtitle">THIS MONTH</span>
      </div>
      <div className="balance-display-row">
        <span className="currency-value">
          {isBalanceVisible ? `PHP ${totalExpenses.toFixed(2)}` : 'PHP ••••••'}
        </span>
        <button 
          className="icon-btn-tinted" 
          onClick={(e) => {
            e.stopPropagation(); // Avoid navigating to overview
            onToggleBalance();
          }}
          aria-label="Toggle Balance Visibility"
        >
          <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.43 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        </button>
      </div>
    </div>
  );
};
