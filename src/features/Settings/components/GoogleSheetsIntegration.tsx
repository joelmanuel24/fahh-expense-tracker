import React, { useEffect, useState } from 'react';
import { db } from '../../../db';
import { SettingsCard } from './SettingsCard';
import { supabase } from '../../../supabase';

interface GoogleSheetsIntegrationProps {
  onClose: () => void;
}

export const GoogleSheetsIntegration: React.FC<GoogleSheetsIntegrationProps> = ({ onClose }) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Form states
  const [spreadsheetId, setSpreadsheetId] = useState<string>('');
  const [sheetName, setSheetName] = useState<string>('Sheet1');
  const [credentialsJson, setCredentialsJson] = useState<string>('');

  // UI Status states
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error'; message: string; rowsSynced?: number } | null>(null);

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Monitor auth status
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
    });
  }, []);

  // Load configuration on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        // 1. Try loading from IndexedDB
        const localConfig = await db.get<{ key: string; value: any }>('settings', 'google_sheets_config');
        if (localConfig && localConfig.value) {
          const cfg = localConfig.value;
          setSpreadsheetId(cfg.spreadsheetId || '');
          setSheetName(cfg.sheetName || 'Sheet1');
          setCredentialsJson(cfg.credentialsJson || '');
        } else if (currentUser && isOnline) {
          // 2. Try loading from Supabase if not found locally
          const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'google_sheets_config')
            .maybeSingle();

          if (!error && data && data.value) {
            const cfg = data.value;
            setSpreadsheetId(cfg.spreadsheetId || '');
            setSheetName(cfg.sheetName || 'Sheet1');
            setCredentialsJson(cfg.credentialsJson || '');
            // Cache locally
            await db.put('settings', { key: 'google_sheets_config', value: cfg });
          }
        }
      } catch (err) {
        console.error('Failed to load Google Sheets configuration:', err);
      }
    };

    loadConfig();
  }, [currentUser, isOnline]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus(null);
    setSyncStatus(null);

    if (!spreadsheetId.trim()) {
      setSaveStatus({ type: 'error', message: 'Spreadsheet ID is required.' });
      return;
    }
    if (!sheetName.trim()) {
      setSaveStatus({ type: 'error', message: 'Sheet name is required.' });
      return;
    }
    if (!credentialsJson.trim()) {
      setSaveStatus({ type: 'error', message: 'Service Account JSON Credentials are required.' });
      return;
    }

    // Validate if credentials are valid JSON
    try {
      JSON.parse(credentialsJson);
    } catch (err) {
      setSaveStatus({ type: 'error', message: 'Credentials must be valid JSON format.' });
      return;
    }

    setIsSaving(true);
    const configObj = {
      spreadsheetId: spreadsheetId.trim(),
      sheetName: sheetName.trim(),
      credentialsJson: credentialsJson.trim(),
    };

    try {
      // 1. Save locally to IndexedDB
      await db.put('settings', { key: 'google_sheets_config', value: configObj });

      // 2. Upsert to Supabase if logged in
      if (currentUser && isOnline) {
        const { error } = await supabase
          .from('settings')
          .upsert({
            key: 'google_sheets_config',
            value: configObj,
            owner_id: currentUser.id
          });

        if (error) throw error;
      }

      setSaveStatus({ type: 'success', message: 'Configuration saved successfully!' });
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      console.error('Failed to save configuration:', err);
      setSaveStatus({ type: 'error', message: `Failed to save: ${err.message || err}` });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerSync = async () => {
    setSyncStatus(null);
    setIsSyncing(true);

    try {
      // 1. Verify credentials and settings are filled
      if (!spreadsheetId.trim() || !sheetName.trim() || !credentialsJson.trim()) {
        throw new Error('Please fill and save your Google Sheets configuration first.');
      }

      // 2. Fetch current Supabase URL, Anon Key, and Access Token
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseToken = session?.access_token;

      if (!supabaseToken) {
        throw new Error('You must be logged in to sync your data. Please check your cloud account connection.');
      }

      if (!isOnline) {
        throw new Error('You must be online to synchronize data with Google Sheets.');
      }

      // 3. Make HTTP request to ASP.NET Web API backend
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5200';
      const response = await fetch(`${backendUrl}/api/sheets/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          supabaseUrl,
          supabaseToken,
          supabaseAnonKey,
          config: {
            spreadsheetId: spreadsheetId.trim(),
            sheetName: sheetName.trim(),
            credentialsJson: credentialsJson.trim()
          }
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSyncStatus({ 
          type: 'success', 
          message: result.message || 'Synchronization completed successfully!',
          rowsSynced: result.rowsSynced
        });
      } else {
        throw new Error(result.message || 'Failed to complete synchronization.');
      }
    } catch (err: any) {
      console.error('Synchronization failed:', err);
      setSyncStatus({ type: 'error', message: err.message || 'An error occurred during synchronization.' });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <header className="view-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button 
          className="back-btn" 
          onClick={onClose} 
          aria-label="Back"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '20px', height: '20px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
          </svg>
        </button>
        <h1 
          className="view-title" 
          style={{ 
            fontSize: '18px', 
            fontWeight: 700, 
            fontFamily: 'Outfit, sans-serif',
            margin: 0
          }}
        >
          Google Sheets Integration
        </h1>
      </header>

      <div className="scroll-content padding-bottom-large" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px' }}>
        
        {/* Setup Instructions */}
        <SettingsCard title="Setup Instructions">
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p>To connect your expense tracker to Google Sheets:</p>
            <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li>Go to the <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>Google Cloud Console</a> and create a project.</li>
              <li>Enable the <strong>Google Sheets API</strong> for your project.</li>
              <li>Create a <strong>Service Account</strong> under "Credentials" and download the private key in <strong>JSON</strong> format.</li>
              <li>Open your Google Spreadsheet, copy its URL/ID, and share the sheet with the Service Account's email address (assigning it as an <strong>Editor</strong>).</li>
              <li>Paste the Spreadsheet ID, Sheet Name (e.g. <code>Sheet1</code>), and the content of the downloaded credentials JSON file below.</li>
            </ol>
          </div>
        </SettingsCard>

        {/* Configuration Form */}
        <SettingsCard title="Configuration Settings">
          <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label 
                htmlFor="spreadsheet-id-input" 
                style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'Outfit, sans-serif' }}
              >
                Google Spreadsheet ID
              </label>
              <input
                id="spreadsheet-id-input"
                type="text"
                className="input-field"
                placeholder="e.g. 1a2b3c4d5e6f7g8h9i0j..."
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label 
                htmlFor="sheet-name-input" 
                style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'Outfit, sans-serif' }}
              >
                Sheet Tab Name
              </label>
              <input
                id="sheet-name-input"
                type="text"
                className="input-field"
                placeholder="e.g. Sheet1"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label 
                htmlFor="credentials-json-input" 
                style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'Outfit, sans-serif' }}
              >
                Service Account Credentials (JSON)
              </label>
              <textarea
                id="credentials-json-input"
                rows={5}
                className="input-field"
                placeholder='{ "type": "service_account", "project_id": ... }'
                value={credentialsJson}
                onChange={(e) => setCredentialsJson(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  backgroundColor: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-primary)',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  resize: 'vertical'
                }}
              />
            </div>

            {saveStatus && (
              <div 
                style={{ 
                  padding: '10px', 
                  borderRadius: 'var(--radius-sm)', 
                  fontSize: '13px',
                  backgroundColor: saveStatus.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'var(--color-danger-tinted)',
                  color: saveStatus.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
                  border: `1px solid ${saveStatus.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                }}
              >
                {saveStatus.message}
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="utility-action-btn-tinted"
              style={{
                width: '100%',
                padding: '12px 0',
                fontSize: '14px',
                fontWeight: 600,
                marginTop: '4px',
                borderRadius: 'var(--radius-sm)',
                height: 'auto',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {isSaving ? 'Saving Configuration... 🔄' : 'Save Configuration ✓'}
            </button>
          </form>
        </SettingsCard>

        {/* Sync Trigger Card */}
        <SettingsCard title="Synchronization Action">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              This will retrieve all expense groups and items from Supabase and synchronize them directly to your Google Sheet. It will format amounts as currency, highlight paid splits, and color-code general expenses.
            </p>

            {syncStatus && (
              <div 
                style={{ 
                  padding: '12px', 
                  borderRadius: 'var(--radius-sm)', 
                  fontSize: '13px',
                  lineHeight: '1.4',
                  backgroundColor: syncStatus.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'var(--color-danger-tinted)',
                  color: syncStatus.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
                  border: `1px solid ${syncStatus.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: '2px' }}>
                  {syncStatus.type === 'success' ? 'Sync Successful' : 'Sync Failed'}
                </div>
                <div>{syncStatus.message}</div>
                {syncStatus.rowsSynced !== undefined && (
                  <div style={{ fontSize: '11px', marginTop: '4px', opacity: 0.8 }}>
                    Rows Sync count: {syncStatus.rowsSynced} records
                  </div>
                )}
              </div>
            )}

            {!currentUser ? (
              <div 
                style={{ 
                  padding: '10px', 
                  backgroundColor: 'var(--color-danger-tinted)', 
                  color: 'var(--color-danger)', 
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  border: '1px solid rgba(239, 68, 68, 0.2)'
                }}
              >
                ⚠️ Cloud Account Required: Please log in to your account under cloud settings to synchronize.
              </div>
            ) : !isOnline ? (
              <button 
                className="utility-action-btn-tinted" 
                style={{ width: '100%', opacity: 0.5, cursor: 'not-allowed', padding: '12px 0', height: 'auto' }} 
                disabled
              >
                Offline (Sync Unavailable) 🔌
              </button>
            ) : (
              <button
                type="button"
                disabled={isSyncing}
                onClick={handleTriggerSync}
                style={{
                  width: '100%',
                  padding: '14px 0',
                  backgroundColor: 'var(--color-primary)',
                  boxShadow: 'var(--shadow-glow)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'var(--transition-smooth)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isSyncing ? 0.7 : 1
                }}
              >
                {isSyncing ? 'Synchronizing to Google Sheets... 🔄' : 'Sync to Google Sheets 🚀'}
              </button>
            )}
          </div>
        </SettingsCard>

      </div>
    </>
  );
};
