import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { Label } from '../types';

interface LabelsDrawerProps {
  isOpen: boolean;
  selectedLabels: Set<string>;
  onConfirm: (labels: string[]) => void;
  onClose: () => void;
  activeAccountId: string;
}

export const LabelsDrawer: React.FC<LabelsDrawerProps> = ({
  isOpen,
  selectedLabels,
  onConfirm,
  onClose,
  activeAccountId
}) => {
  const [search, setSearch] = useState<string>('');
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set());

  // Load labels list
  useEffect(() => {
    const loadLabels = async () => {
      const list = await db.getGroupedByIndex<Label>('labels', 'accountId', activeAccountId);
      setAllLabels(list);
    };
    if (isOpen) {
      loadLabels();
      setLocalSelected(new Set(selectedLabels));
      setSearch('');
    }
  }, [isOpen, activeAccountId, selectedLabels]);

  const handleToggleLabel = (name: string) => {
    const next = new Set(localSelected);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setLocalSelected(next);
  };

  const handleCreateLabelOnFly = async () => {
    const trimmed = search.trim();
    if (!trimmed) return;

    // Capitalize nicely
    const labelName = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    
    // Save record offline in IndexedDB
    const newId = `lbl_${Date.now()}`;
    const newRecord: Label = {
      id: newId,
      accountId: activeAccountId,
      name: labelName
    };
    await db.put('labels', newRecord);

    // Update state lists
    setAllLabels(prev => [...prev, newRecord]);
    
    // Auto-select newly created label
    const next = new Set(localSelected);
    next.add(labelName);
    setLocalSelected(next);
    
    // Clear search
    setSearch('');
  };

  const handleClearAll = () => {
    setLocalSelected(new Set());
  };

  const handleConfirm = () => {
    onConfirm(Array.from(localSelected));
  };

  if (!isOpen) return null;

  const filteredLabels = allLabels.filter(lbl => 
    lbl.name.toLowerCase().includes(search.toLowerCase())
  );

  const exactMatchExists = allLabels.some(lbl => 
    lbl.name.toLowerCase() === search.trim().toLowerCase()
  );

  return (
    <div className="bottom-sheet-overlay">
      <div className="sheet-scrim" onClick={onClose}></div>
      <div className="sheet-content-wrapper" style={{ maxHeight: '90%', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        <div className="sheet-drag-indicator" onClick={onClose}></div>
        <h3 className="sheet-title">Select Labels</h3>

        {/* 1. Search input */}
        <div className="search-bar-wrapper">
          <svg viewBox="0 0 24 24" className="search-icon" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z" />
          </svg>
          <input 
            type="text" 
            placeholder="Search or add new label..." 
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* 2. Selected Pills Overview */}
        <div className="label-selection-block">
          <div className="label-block-header">
            <span className="label-block-title">Selected</span>
            <button className="text-clear-btn" onClick={handleClearAll}>Clear</button>
          </div>
          <div className="active-labels-container">
            {localSelected.size === 0 ? (
              <span className="empty-state-text">No Selected Labels</span>
            ) : (
              Array.from(localSelected).map((name) => (
                <div key={name} className="label-pill" onClick={() => handleToggleLabel(name)}>
                  <span>{name}</span>
                  <span className="close-x">×</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="dashed-divider" style={{ margin: '12px 0' }}></div>

        {/* 3. Selections Checklist */}
        <div className="label-selection-block" style={{ flex: 1, overflowY: 'auto' }}>
          <span className="label-block-title" style={{ marginBottom: '8px', display: 'block' }}>Checklist</span>
          <div className="labels-checklist" style={{ maxHeight: '200px' }}>
            {filteredLabels.map((lbl) => {
              const isChecked = localSelected.has(lbl.name);
              return (
                <div 
                  key={lbl.id} 
                  className={`label-check-row ${isChecked ? 'selected' : ''}`}
                  onClick={() => handleToggleLabel(lbl.name)}
                >
                  <span className="label-name-text">{lbl.name}</span>
                  <span className="check-indicator">{isChecked ? '✓' : '+'}</span>
                </div>
              );
            })}

            {/* Dynamic creation row */}
            {search.trim().length > 0 && !exactMatchExists && (
              <div 
                className="label-check-row"
                style={{ borderColor: 'var(--color-primary)', backgroundColor: 'rgba(88, 76, 244, 0.08)' }}
                onClick={handleCreateLabelOnFly}
              >
                <span className="label-name-text" style={{ color: 'var(--text-accent)', fontWeight: 700 }}>
                  + Add "{search.trim()}"
                </span>
                <span className="check-indicator" style={{ color: 'var(--color-primary)', fontSize: '14px' }}>⚡</span>
              </div>
            )}
          </div>
        </div>

        {/* 4. Action confirm */}
        <div style={{ marginTop: '16px' }}>
          <button 
            type="button" 
            className="primary-action-btn"
            onClick={handleConfirm}
          >
            <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="check-icon" style={{ width: '20px', height: '20px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
            <span>Confirm</span>
          </button>
        </div>
      </div>
    </div>
  );
};
