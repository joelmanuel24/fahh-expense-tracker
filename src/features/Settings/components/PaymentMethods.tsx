import React, { useState } from 'react';
import { PaymentMethod } from '../../../types';
import { ReorderableList } from '../../../components/ReorderableList';
import { SettingsCard } from './SettingsCard';

interface PaymentMethodsProps {
  payments: PaymentMethod[];
  onReorder: (newPayments: PaymentMethod[]) => void;
  onDelete: (id: string, name: string) => void;
  newPaymentName: string;
  setNewPaymentName: (name: string) => void;
  onAdd: () => void;
}

export const PaymentMethods: React.FC<PaymentMethodsProps> = ({
  payments,
  onReorder,
  onDelete,
  newPaymentName,
  setNewPaymentName,
  onAdd
}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);

  return (
    <SettingsCard
      title="Payment Methods"
      headerAction={
        <button 
          type="button" 
          onClick={() => setIsEditing(prev => !prev)}
          className="settings-edit-link"
        >
          {isEditing ? 'Done' : 'Edit'}
        </button>
      }
    >
      <div className="settings-list-container">
        <ReorderableList
          items={payments}
          onReorder={onReorder}
          itemClassName={`settings-item-row ${isEditing ? 'drag-row' : ''}`}
          disabled={!isEditing}
          renderItem={(pm) => (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                {isEditing && (
                  <div className="drag-handle" style={{ cursor: 'grab', display: 'flex', alignItems: 'center', opacity: 0.5 }}>
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '16px', height: '16px', color: 'var(--text-muted)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h.008v.008H8.25V6.75Zm.008 5.25h-.008v.008h.008V12Zm0 5.25h-.008v.008h.008v-.008ZM15.75 6.75h.008v.008H15.75V6.75Zm.008 5.25h-.008v.008h.008V12Zm0 5.25h-.008v.008h.008v-.008Z" />
                    </svg>
                  </div>
                )}
                <span className="settings-item-name" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '14px', fontWeight: 500 }}>
                  {pm.name}
                </span>
              </div>
              {isEditing && payments.length > 1 && (
                <button 
                  className="accent-icon-btn" 
                  style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                  onClick={() => onDelete(pm.id, pm.name)}
                  aria-label="Delete Payment Method"
                >
                  <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </>
          )}
        />
      </div>
      {isEditing && (
        <div className="settings-add-row" style={{ animation: 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          <input 
            type="text" 
            placeholder="e.g. Credit Card" 
            className="settings-input"
            value={newPaymentName}
            onChange={(e) => setNewPaymentName(e.target.value)}
          />
          <button className="accent-icon-btn" onClick={onAdd} aria-label="Add Payment Method">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
      )}
    </SettingsCard>
  );
};
