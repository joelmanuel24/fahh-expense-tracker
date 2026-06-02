import React from 'react';

interface CategorySummary {
  name: string;
  amount: number;
  icon: string;
  bgColor?: string;
  textColor?: string;
}

interface CategoryListWidgetProps {
  categorySummaries: CategorySummary[];
}

export const CategoryListWidget: React.FC<CategoryListWidgetProps> = ({ categorySummaries }) => {
  return (
    <div className="categories-section">
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
};
