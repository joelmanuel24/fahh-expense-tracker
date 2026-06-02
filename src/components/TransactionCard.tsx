import React from 'react';
import { calculateKKBSplit, formatKKBShare } from '../features/Dashboard/utils/dashboardLogic';
import { Category } from '../types';

interface TransactionCardProps {
  group: any;
  isExpanded: boolean;
  onToggleAccordion: (groupId: string) => void;
  onViewSplit: (groupId: string) => void;
  onTriggerActions: (groupId: string, groupDesc: string) => void;
  categories?: Category[];
}

export const TransactionCard: React.FC<TransactionCardProps> = ({
  group,
  isExpanded,
  onToggleAccordion,
  onViewSplit,
  onTriggerActions,
  categories = []
}) => {
  const { hasKKBSplit, myShare } = calculateKKBSplit(group.items);

  const getGroupCategoryDetails = (groupItems: any[]) => {
    if (!groupItems || groupItems.length === 0 || !categories || categories.length === 0) {
      return { icon: '🧾', bgColor: 'rgba(255,255,255,0.04)', textColor: '#fff' };
    }
    const firstItemCat = groupItems[0].category;
    const matchedCat = categories.find(c => c.name === firstItemCat);
    if (matchedCat) {
      return {
        icon: matchedCat.icon,
        bgColor: matchedCat.bgColor || 'rgba(255,255,255,0.04)',
        textColor: matchedCat.textColor || '#fff'
      };
    }
    return { icon: '📦', bgColor: 'rgba(255,255,255,0.04)', textColor: '#fff' };
  };

  const catDetails = getGroupCategoryDetails(group.items);

  return (
    <div 
      className={`transaction-group-card ${isExpanded ? 'expanded' : ''}`}
      onClick={() => onToggleAccordion(group.id)}
    >
      <div className="card-main-row">
        <div className="card-left-info">
          <div className="tiny-bubble-stack">
            <div 
              className="tiny-bubble" 
              style={{ 
                background: catDetails.bgColor.replace('0.15', '0.2').replace('0.04', '0.08'), 
                color: catDetails.textColor 
              }}
            >
              {catDetails.icon}
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
          <span className="amount-text">
            {hasKKBSplit ? (
              formatKKBShare(myShare, group.total)
            ) : (
              `PHP ${group.total.toFixed(2)}`
            )}
          </span>
          <span className="sub-item-detail">{group.items.length} item{group.items.length > 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="card-accordion-content" onClick={(e) => e.stopPropagation()}>
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
              View Split
            </button>
          )}

          <button 
            type="button" 
            className="more-actions-btn"
            onClick={(e) => {
              e.stopPropagation();
              onTriggerActions(group.id, group.description);
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
};
