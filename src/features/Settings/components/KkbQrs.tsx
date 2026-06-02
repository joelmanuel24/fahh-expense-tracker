import React, { useRef } from 'react';
import { KkbQr } from '../../../types';
import { SettingsCard } from './SettingsCard';

interface KkbQrsProps {
  qrs: KkbQr[];
  newQrName: string;
  setNewQrName: (name: string) => void;
  newQrFileName: string;
  setNewQrFileName: (name: string) => void;
  setNewQrBase64: (base64: string) => void;
  onAdd: () => void;
  onDelete: (id: string, name: string) => void;
}

export const KkbQrs: React.FC<KkbQrsProps> = ({
  qrs,
  newQrName,
  setNewQrName,
  newQrFileName,
  setNewQrFileName,
  setNewQrBase64,
  onAdd,
  onDelete
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setNewQrFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setNewQrBase64(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <SettingsCard
      title="KKB QR Codes"
      description="Add GCash or Bank QRs to attach on split receipts."
      descStyle={{ marginBottom: '12px' }}
    >
      <div className="settings-list-container">
        {qrs.length === 0 ? (
          <div className="empty-state-text" style={{ padding: '10px 0' }}>No QR codes uploaded.</div>
        ) : (
          qrs.map((qr) => (
            <div key={qr.id} className="qr-item-row">
              <div className="qr-item-info">
                <img src={qr.base64} className="qr-item-thumb" alt="QR Thumb" />
                <span className="qr-item-name">{qr.name}</span>
              </div>
              <button 
                className="qr-item-delete-btn" 
                onClick={() => onDelete(qr.id, qr.name)} 
                aria-label="Delete QR"
              >
                <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
      
      <div className="settings-add-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <input 
          type="text" 
          placeholder="e.g. GCash (Alice)" 
          className="settings-input" 
          style={{ width: '100%' }}
          value={newQrName}
          onChange={(e) => setNewQrName(e.target.value)}
        />
        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
          <label 
            htmlFor="new-qr-file-input" 
            className="utility-action-btn-tinted" 
            style={{ flex: 1, textAlign: 'center', cursor: 'pointer', padding: '10px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', margin: 0 }}
          >
            <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '16px', height: '16px', marginRight: '4px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            <span>{newQrFileName}</span>
          </label>
          <input 
            ref={fileInputRef}
            type="file" 
            id="new-qr-file-input" 
            accept="image/*" 
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <button 
            className="accent-icon-btn" 
            onClick={onAdd} 
            style={{ height: 'unset', minHeight: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} 
            aria-label="Add QR Code"
          >
            <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>
      </div>
    </SettingsCard>
  );
};
