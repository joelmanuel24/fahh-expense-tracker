import React, { useState } from 'react';
import { Account } from '../../../types';
import { ReorderableList } from '../../../components/ReorderableList';
import { SettingsCard } from './SettingsCard';

interface ManageAccountsProps {
  accounts: Account[];
  activeAccountId: string;
  onReorder: (newAccounts: Account[]) => void;
  onSwitch: (id: string) => void;
  newAccountName: string;
  setNewAccountName: (name: string) => void;
  onAdd: () => void;
  onConfigureAccount: (id: string) => void;
}

export const ManageAccounts: React.FC<ManageAccountsProps> = ({
  accounts,
  activeAccountId,
  onReorder,
  onSwitch,
  newAccountName,
  setNewAccountName,
  onAdd,
  onConfigureAccount
}) => {
  const [isReordering, setIsReordering] = useState<boolean>(false);

  return (
    <SettingsCard
      title="Manage Accounts"
      headerAction={
        <button 
          type="button" 
          onClick={() => setIsReordering(prev => !prev)}
          className="settings-edit-link"
        >
          {isReordering ? 'Done' : 'Reorder'}
        </button>
      }
    >
      <div className="settings-list-container">
        <ReorderableList
          items={accounts}
          onReorder={onReorder}
          itemClassName={`settings-item-row ${isReordering ? 'drag-row' : ''}`}
          getItemClassName={(acc) => (acc.id === activeAccountId ? 'active' : '')}
          disabled={!isReordering}
          renderItem={(acc) => {
            const isActive = acc.id === activeAccountId;
            return (
              <>
                <div 
                  onClick={() => {
                    if (!isReordering && !isActive) {
                      onSwitch(acc.id);
                    }
                  }}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    flex: 1,
                    cursor: (!isReordering && !isActive) ? 'pointer' : 'default'
                  }}
                >
                  {isReordering && (
                    <div className="drag-handle" style={{ cursor: 'grab', display: 'flex', alignItems: 'center', opacity: 0.5 }}>
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '16px', height: '16px', color: 'var(--text-muted)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h.008v.008H8.25V6.75Zm.008 5.25h-.008v.008h.008V12Zm0 5.25h-.008v.008h.008v-.008ZM15.75 6.75h.008v.008H15.75V6.75Zm.008 5.25h-.008v.008h.008V12Zm0 5.25h-.008v.008h.008v-.008Z" />
                      </svg>
                    </div>
                  )}
                  <span 
                    className="settings-item-name" 
                    style={{ 
                      fontFamily: "'Plus Jakarta Sans', sans-serif", 
                      fontSize: '14px', 
                      fontWeight: isActive ? 700 : 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    {acc.name}
                    {isActive && (
                      <span 
                        style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          backgroundColor: 'rgba(88, 76, 244, 0.15)',
                          color: 'var(--color-primary)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          height: '16px',
                          lineHeight: '12px'
                        }}
                      >
                        Selected
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {!isReordering && (
                    <button className="accent-icon-btn" onClick={() => onConfigureAccount(acc.id)} title="Configure Account">
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                    </button>
                  )}
                </div>
              </>
            );
          }}
        />
      </div>
      {!isReordering && (
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
