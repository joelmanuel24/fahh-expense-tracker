import React from 'react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  description,
  confirmText = 'Yes, Delete',
  cancelText = 'No, Cancel',
  onConfirm,
  onCancel
}) => {
  return (
    <div className={`bottom-sheet-overlay ${isOpen ? '' : 'hidden'}`}>
      <div className="sheet-scrim" onClick={onCancel}></div>
      <div className="sheet-content-wrapper">
        <div className="sheet-drag-indicator" onClick={onCancel}></div>
        <h3 
          className="sheet-title" 
          style={{ 
            color: 'var(--color-danger)', 
            textAlign: 'center', 
            fontFamily: "'Plus Jakarta Sans', sans-serif" 
          }}
        >
          {title}
        </h3>
        <div 
          style={{ 
            textAlign: 'center', 
            color: 'var(--text-secondary)', 
            fontSize: '14px', 
            margin: '8px 20px 0 20px',
            lineHeight: '1.5',
            fontFamily: "'Plus Jakarta Sans', sans-serif"
          }}
        >
          {description}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '8px 20px 24px 20px' }}>
          <button 
            type="button"
            style={{
              width: '100%',
              backgroundColor: 'var(--color-danger)',
              border: 'none',
              color: '#fff',
              fontWeight: 700,
              fontSize: '15px',
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              transition: 'var(--transition-smooth)',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.2)'
            }}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
          <button 
            type="button"
            style={{
              width: '100%',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontSize: '15px',
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              transition: 'var(--transition-smooth)'
            }}
            onClick={onCancel}
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};
