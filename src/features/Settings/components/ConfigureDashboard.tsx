import React, { useState } from 'react';
import { ReorderableList } from '../../../components/ReorderableList';
import { SwitchToggle } from '../../../components/SwitchToggle';
import { SettingsCard } from './SettingsCard';

interface ConfigureDashboardProps {
  widgets: any[];
  onReorder: (newWidgets: any[]) => void;
  onToggleWidget: (index: number, visible: boolean) => void;
}

export const ConfigureDashboard: React.FC<ConfigureDashboardProps> = ({
  widgets,
  onReorder,
  onToggleWidget
}) => {
  const [isReordering, setIsReordering] = useState<boolean>(false);

  return (
    <SettingsCard
      title="Configure Dashboard"
      description={isReordering ? 'Hold and drag the handles on the left to reorder.' : 'Toggle visibility of widgets on your dashboard.'}
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
      <div className="settings-list-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <ReorderableList
          items={widgets}
          onReorder={onReorder}
          itemClassName={`settings-item-row ${isReordering ? 'drag-row' : ''}`}
          disabled={!isReordering}
          getItemStyle={(widget, idx, isDragging) => ({
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            padding: '12px 14px', 
            backgroundColor: isDragging ? 'rgba(88, 76, 244, 0.08)' : 'rgba(255, 255, 255, 0.02)', 
            borderRadius: 'var(--radius-md)', 
            border: isDragging ? '1px dashed var(--color-primary)' : '1px solid rgba(255, 255, 255, 0.04)',
            opacity: isDragging ? 0.6 : 1,
            transition: 'background-color 0.2s, opacity 0.2s, border 0.2s',
            userSelect: 'none'
          })}
          renderItem={(widget, index) => (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Six-dots drag handle */}
                {isReordering && (
                  <div className="drag-handle" style={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}>
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '18px', height: '18px', color: 'var(--text-muted)' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h.008v.008H8.25V6.75Zm.008 5.25h-.008v.008h.008V12Zm0 5.25h-.008v.008h.008v-.008ZM15.75 6.75h.008v.008H15.75V6.75Zm.008 5.25h-.008v.008h.008V12Zm0 5.25h-.008v.008h.008v-.008Z" />
                    </svg>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {widget.name}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {widget.id === 'total_expenses' 
                      ? 'Monthly spending summary & balance toggle' 
                      : widget.id === 'categories' 
                        ? 'Live spending breakdown sums per category' 
                        : widget.id === 'category_grid' 
                          ? 'Grid shortcuts to quickly log new expenses' 
                          : 'Collapsible list of recent transaction cards'}
                  </span>
                </div>
              </div>
              
              {/* Visibility Switch */}
              {!isReordering && (
                <SwitchToggle
                  checked={widget.visible}
                  onChange={(checked) => onToggleWidget(index, checked)}
                  scale={0.85}
                />
              )}
            </>
          )}
        />
      </div>
    </SettingsCard>
  );
};
