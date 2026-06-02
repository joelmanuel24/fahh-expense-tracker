import React, { useState } from 'react';
import { Category } from '../../../types';
import { ReorderableList } from '../../../components/ReorderableList';
import { SettingsCard } from './SettingsCard';

interface ManageCategoriesProps {
  categories: Category[];
  onReorder: (newCategories: Category[]) => void;
  onDelete: (id: string, name: string) => void;
  newCatIcon: string;
  setNewCatIcon: (icon: string) => void;
  newCatName: string;
  setNewCatName: (name: string) => void;
  onAdd: () => void;
}

export const ManageCategories: React.FC<ManageCategoriesProps> = ({
  categories,
  onReorder,
  onDelete,
  newCatIcon,
  setNewCatIcon,
  newCatName,
  setNewCatName,
  onAdd
}) => {
  const [isEditing, setIsEditing] = useState<boolean>(false);

  return (
    <SettingsCard
      title="Manage Categories"
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
          items={categories}
          onReorder={onReorder}
          itemClassName={`settings-item-row ${isEditing ? 'drag-row' : ''}`}
          disabled={!isEditing}
          renderItem={(cat) => (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                {isEditing && (
                  <div className="drag-handle" style={{ cursor: 'grab', display: 'flex', alignItems: 'center', opacity: 0.5 }}>
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '16px', height: '16px', color: 'var(--text-muted)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h.008v.008H8.25V6.75Zm.008 5.25h-.008v.008h.008V12Zm0 5.25h-.008v.008h.008v-.008ZM15.75 6.75h.008v.008H15.75V6.75Zm.008 5.25h-.008v.008h.008V12Zm0 5.25h-.008v.008h.008v-.008Z" />
                    </svg>
                  </div>
                )}
                
                {/* Category Emoji Circle */}
                <div 
                  className="cat-circle" 
                  style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%', 
                    backgroundColor: cat.bgColor, 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontSize: '16px',
                    boxShadow: `0 0 8px ${cat.bgColor}55`,
                    border: `1px solid ${cat.textColor}44`,
                    transition: 'var(--transition-smooth)'
                  }}
                >
                  {cat.icon}
                </div>

                <span className="settings-item-name" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '14px', fontWeight: 500 }}>
                  {cat.name}
                </span>
              </div>
              {isEditing && categories.length > 1 && (
                <button 
                  className="accent-icon-btn" 
                  style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                  onClick={() => onDelete(cat.id, cat.name)}
                  aria-label="Delete Category"
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
        <div className="settings-add-row" style={{ display: 'flex', gap: '8px', animation: 'popIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          <input 
            type="text" 
            placeholder="🍔" 
            className="settings-input" 
            style={{ width: '50px', textAlign: 'center' }}
            value={newCatIcon}
            onChange={(e) => setNewCatIcon(e.target.value)}
          />
          <input 
            type="text" 
            placeholder="e.g. Food" 
            className="settings-input" 
            style={{ flex: 1 }}
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
          />
          <button className="accent-icon-btn" onClick={onAdd} aria-label="Add Category">
            <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
      )}
    </SettingsCard>
  );
};
