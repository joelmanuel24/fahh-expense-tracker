import React, { useState } from 'react';
import { Account } from '../../../types';
import { ReorderableList } from '../../../components/ReorderableList';
import { SettingsCard } from './SettingsCard';

interface ManageAccountsProps {
  accounts: Account[];
  activeAccountId: string;
  onReorder: (newAccounts: Account[]) => void;
  onRename: (acc: Account) => void;
  onSwitch: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  newAccountName: string;
  setNewAccountName: (name: string) => void;
  onAdd: () => void;
}

export const ManageAccounts: React.FC<ManageAccountsProps> = ({
  accounts,
  activeAccountId,
  onReorder,
  onRename,
  onSwitch,
  onDelete,
  newAccountName,
  setNewAccountName,
  onAdd
}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);

  return (
    <SettingsCard
      title="Manage Accounts"
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
          items={accounts}
          onReorder={onReorder}
          itemClassName={`settings-item-row ${isEditing ? 'drag-row' : ''}`}
          getItemClassName={(acc) => (acc.id === activeAccountId ? 'active' : '')}
          disabled={!isEditing}
          renderItem={(acc) => {
            const isActive = acc.id === activeAccountId;
            return (
              <>
                <div 
                  onClick={() => {
                    if (!isEditing && !isActive) {
                      onSwitch(acc.id);
                    }
                  }}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    flex: 1,
                    cursor: (!isEditing && !isActive) ? 'pointer' : 'default'
                  }}
                >
                  {isEditing && (
                    <div className="drag-handle" style={{ cursor: 'grab', display: 'flex', alignItems: 'center', opacity: 0.5 }}>
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '16px', height: '16px', color: 'var(--text-muted)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h.008v.008H8.25V6.75Zm.008 5.25h-.008v.008h.008V12Zm0 5.25h-.008v.008h.008v-.008ZM15.75 6.75h.008v.008H15.75V6.75Zm.008 5.25h-.008v.008h.008V12Zm0 5.25h-.008v.008h.008v-.008Z" />
                      </svg>
                    </div>
                  )}
                  <span className="settings-item-name" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '14px', fontWeight: isActive ? 700 : 500 }}>
                    {acc.name} {isActive ? '🏆' : ''}
                  </span>
                </div>
                {isEditing && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="accent-icon-btn" onClick={() => onRename(acc)} title="Rename Account">
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                      </svg>
                    </button>
                    {!isActive && (
                      <button className="accent-icon-btn" onClick={() => onSwitch(acc.id)} title="Switch to Account">
                        <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      </button>
                    )}
                    {accounts.length > 1 && (
                      <button 
                        className="accent-icon-btn" 
                        style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                        onClick={() => onDelete(acc.id, acc.name)} 
                        title="Delete Account"
                      >
                        <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </>
            );
          }}
        />
      </div>
      {isEditing && (
        <div className="settings-add-row" style={{ animation: 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          <input 
            type="text" 
            placeholder="e.g. Work Expenses" 
            className="settings-input"
            value={newAccountName}
            onChange={(e) => setNewAccountName(e.target.value)}
          />
          <button className="accent-icon-btn" onClick={onAdd} aria-label="Add Account">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
      )}
    </SettingsCard>
  );
};
