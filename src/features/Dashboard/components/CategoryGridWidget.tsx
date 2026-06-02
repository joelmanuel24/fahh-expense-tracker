import React from 'react';
import { Category } from '../../../types';

interface CategoryGridWidgetProps {
  allCategories: Category[];
  onNavigate: (viewId: string, queryParams?: string) => void;
}

export const CategoryGridWidget: React.FC<CategoryGridWidgetProps> = ({
  allCategories,
  onNavigate
}) => {
  return (
    <div style={{ marginBottom: '24px', padding: '0 4px', position: 'relative', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: '12px',
        justifyItems: 'center',
        alignItems: 'center',
        width: '100%'
      }}>
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
              position: 'relative',
              width: '100%',
              minWidth: '0'
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
};
