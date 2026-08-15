import React, { useState, useEffect } from 'react';
import { db } from '../../../db';
import { Label } from '../../../types';
import { addToSyncQueue, processSyncQueue } from '../../../utils/syncEngine';

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

  // Load labels list on drawer open
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeAccountId]);

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
    const newId = crypto.randomUUID();
    const newRecord: Label = {
      id: newId,
      accountId: activeAccountId,
      name: labelName
    };
    await db.put('labels', newRecord);
    await addToSyncQueue('labels', 'upsert', newId, newRecord);
    processSyncQueue();

    // Update state lists
    setAllLabels(prev => [...prev, newRecord]);
    
    // Auto-select newly created label
    const next = new Set(localSelected);
    next.add(labelName);
    setLocalSelected(next);
    
    // Clear search
    setSearch('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = search.trim();
      if (!trimmed) return;

      const match = allLabels.find(lbl => lbl.name.toLowerCase() === trimmed.toLowerCase());
      if (match) {
        const next = new Set(localSelected);
        next.add(match.name);
        setLocalSelected(next);
        setSearch('');
      } else {
        handleCreateLabelOnFly();
      }
    }
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
    <div className="bottom-sheet-overlay" style={{ height: '100%', top: 0, left: 0 }}>
      <div 
        className="sheet-content-wrapper" 
        style={{ 
          height: '100%', 
          maxHeight: '100%', 
          borderRadius: 0, 
          padding: '0 0 24px 0', 
          display: 'flex', 
          flexDirection: 'column',
          backgroundColor: 'var(--bg-surface)',
          border: 'none',
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Full-screen Back Navigation Header */}
        <header className="view-header" style={{ padding: '0 20px', display: 'flex', alignItems: 'center', minHeight: '56px', borderBottom: '1px solid var(--border-light)', gap: '12px' }}>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Back" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
            <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '20px', height: '20px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
          </button>
          <h1 className="view-title" style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#fff', flex: 1, fontFamily: 'Outfit, sans-serif' }}>Select Labels</h1>
        </header>

        {/* 1. Search input */}
        <div className="search-bar-wrapper" style={{ margin: '16px 20px 0 20px' }}>
          <svg viewBox="0 0 24 24" className="search-icon" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z" />
          </svg>
          <input 
            type="text" 
            placeholder="Search or add new label..." 
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        {/* 2. Selected Pills Overview */}
        <div className="label-selection-block" style={{ margin: '0 20px' }}>
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

        {/* 3. Selections Checklist / Search Results */}
        <div className="label-selection-block" style={{ flex: 1, overflowY: 'auto', margin: '16px 20px 0 20px' }}>
          <div className="labels-checklist" style={{ maxHeight: 'none' }}>
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
        <div style={{ marginTop: '16px', padding: '0 20px' }}>
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
