import React from 'react';

interface FirstSyncOverlayProps {
  status: 'idle' | 'syncing' | 'completed' | 'failed';
  error: string | null;
  onRetry: () => void;
  onCancel: () => void;
}

export const FirstSyncOverlay: React.FC<FirstSyncOverlayProps> = ({
  status,
  error,
  onRetry,
  onCancel,
}) => {
  if (status === 'idle') return null;

  return (
    <div className="first-sync-overlay">
      <div className="first-sync-container">
        {status === 'syncing' && (
          <div className="sync-state-content">
            <div className="sync-icon-wrapper pulse-glow">
              <svg className="sync-spinner-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2V6M12 18V22M4.93 4.93L7.76 7.76M16.24 16.24L19.07 19.07M2 12H6M18 12H22M4.93 19.07L7.76 16.24M16.24 7.76L19.07 4.93" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <h2 className="sync-title">Securing Your Space</h2>
            <p className="sync-description">
              Uploading your offline account settings to the cloud...
            </p>
            <div className="sync-progress-bar-track">
              <div className="sync-progress-bar-fill animate-progress"></div>
            </div>
          </div>
        )}

        {status === 'completed' && (
          <div className="sync-state-content scale-in">
            <div className="sync-icon-wrapper success-bounce">
              <svg className="sync-success-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 6L9 17L4 12" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="sync-title success-text">Sync Completed!</h2>
            <p className="sync-description">
              Your account settings are now fully backed up and ready.
            </p>
          </div>
        )}

        {status === 'failed' && (
          <div className="sync-state-content pop-in">
            <div className="sync-icon-wrapper error-shake">
              <svg className="sync-error-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 9V14M12 17.01H12.01M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="sync-title error-text">Sync Failed</h2>
            <p className="sync-description error-message">
              {error || 'Unable to upload accounts. Please check your network connection.'}
            </p>
            <div className="sync-actions">
              <button className="sync-btn primary-btn" onClick={onRetry}>
                🔄 Retry Sync
              </button>
              <button className="sync-btn secondary-btn" onClick={onCancel}>
                Skip for Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
