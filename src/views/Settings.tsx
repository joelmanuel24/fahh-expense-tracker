import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { Account, Category, PaymentMethod, KkbQr } from '../types';

interface SettingsProps {
  activeAccountId: string;
  onNavigate: (viewId: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({ activeAccountId, onNavigate }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [newAccountName, setNewAccountName] = useState<string>('');

  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [newPaymentName, setNewPaymentName] = useState<string>('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatIcon, setNewCatIcon] = useState<string>('');
  const [newCatName, setNewCatName] = useState<string>('');

  const [qrs, setQrs] = useState<KkbQr[]>([]);
  const [newQrName, setNewQrName] = useState<string>('');
  const [newQrBase64, setNewQrBase64] = useState<string>('');
  const [newQrFileName, setNewQrFileName] = useState<string>('Choose Image');

  const [locationEnabled, setLocationEnabled] = useState<boolean>(false);
  const [widgets, setWidgets] = useState<any[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const loadSettingsData = async () => {
    const accList = await db.getAll<Account>('accounts');
    setAccounts(accList);

    const pmList = await db.getAll<PaymentMethod>('payment_methods');
    setPayments(pmList);

    const catList = await db.getGroupedByIndex<Category>('categories', 'accountId', activeAccountId);
    setCategories(catList);

    const qrsRecord = await db.get<{ key: string; value: KkbQr[] }>('settings', 'kkbQrs');
    setQrs(qrsRecord ? qrsRecord.value : []);

    const locEnabled = await db.get<{ key: string; value: boolean }>('settings', 'locationSuggestEnabled');
    setLocationEnabled(locEnabled ? locEnabled.value : false);

    const widgetsRecord = await db.get<{ key: string; value: any[] }>('settings', 'dashboardWidgets');
    const defaultWidgets = [
      { id: 'total_expenses', name: 'Total Expenses', visible: true },
      { id: 'categories', name: 'Category List', visible: true },
      { id: 'category_grid', name: 'Category Grid', visible: true },
      { id: 'recent_expenses', name: 'Recent Expenses', visible: true }
    ];
    
    let activeWidgets = defaultWidgets;
    if (widgetsRecord && widgetsRecord.value && Array.isArray(widgetsRecord.value)) {
      const savedList = widgetsRecord.value;
      const missing = defaultWidgets.filter(dw => !savedList.some(sw => sw.id === dw.id));
      if (missing.length > 0) {
        activeWidgets = [...savedList, ...missing];
        await db.put('settings', { key: 'dashboardWidgets', value: activeWidgets });
      } else {
        activeWidgets = savedList;
      }
    } else {
      await db.put('settings', { key: 'dashboardWidgets', value: defaultWidgets });
    }
    setWidgets(activeWidgets);
  };

  useEffect(() => {
    loadSettingsData();
  }, [activeAccountId]);

  // 1. Accounts Actions
  const handleAddAccount = async () => {
    if (!newAccountName.trim()) return;
    const newId = `acc_${Date.now()}`;
    const newAcc: Account = { id: newId, name: newAccountName.trim() };
    await db.put('accounts', newAcc);
    setNewAccountName('');
    loadSettingsData();
  };

  const handleSwitchAccount = async (id: string) => {
    await db.put('settings', { key: 'activeAccountId', value: id });
    window.location.reload();
  };

  const handleRenameAccount = async (acc: Account) => {
    const newName = prompt('Enter new name for account:', acc.name);
    if (newName !== null && newName.trim() !== '') {
      const updated = { ...acc, name: newName.trim() };
      await db.put('accounts', updated);
      loadSettingsData();
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (confirm('Are you sure you want to delete this account? All associated expenses, custom categories, and labels will be deleted.')) {
      await db.delete('accounts', id);
      
      // Cascading deletes of groups and items
      const allGroups = await db.getGroupedByIndex<any>('expense_groups', 'accountId', id);
      for (const g of allGroups) {
        await db.deleteExpenseGroup(g.id);
      }

      // Cascading deletes of scoped categories & labels
      const cats = await db.getGroupedByIndex<Category>('categories', 'accountId', id);
      for (const c of cats) await db.delete('categories', c.id);

      const lbls = await db.getGroupedByIndex<any>('labels', 'accountId', id);
      for (const l of lbls) await db.delete('labels', l.id);

      // If active account was deleted, switch back to remaining
      if (activeAccountId === id) {
        const remaining = await db.getAll<Account>('accounts');
        await db.put('settings', { key: 'activeAccountId', value: remaining[0].id });
        window.location.reload();
      } else {
        loadSettingsData();
      }
    }
  };

  // 2. Global Payment Methods Actions
  const handleAddPayment = async () => {
    if (!newPaymentName.trim()) return;
    const newPm = { id: `pm_${Date.now()}`, name: newPaymentName.trim() };
    await db.put('payment_methods', newPm);
    setNewPaymentName('');
    loadSettingsData();
  };

  const handleDeletePayment = async (id: string) => {
    if (payments.length === 1) return;
    await db.delete('payment_methods', id);
    loadSettingsData();
  };

  // 3. Scoped Category Actions
  const handleAddCategory = async () => {
    if (!newCatName.trim() || !newCatIcon.trim()) {
      alert('Please fill out both Category Emoji and Title.');
      return;
    }
    
    // Pick random neon colors for the HSL highlights
    const hues = [0, 30, 140, 200, 260, 310];
    const pickedHue = hues[Math.floor(Math.random() * hues.length)];
    
    const newCat: Category = {
      id: `cat_${Date.now()}`,
      accountId: activeAccountId,
      name: newCatName.trim(),
      icon: newCatIcon.trim(),
      bgColor: `hsl(${pickedHue}, 90%, 94%)`,
      textColor: `hsl(${pickedHue}, 80%, 40%)`
    };

    await db.put('categories', newCat);
    setNewCatName('');
    setNewCatIcon('');
    loadSettingsData();
  };

  const handleDeleteCategory = async (id: string) => {
    if (categories.length === 1) return;
    if (confirm('Delete this category? Linked transaction items will remain but category card resets.')) {
      await db.delete('categories', id);
      loadSettingsData();
    }
  };

  // 4. KKB Payment QR Actions (Upload file and convert to Base64)
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

  const handleAddQr = async () => {
    if (!newQrName.trim() || !newQrBase64) {
      alert('Please enter a QR nickname and choose an image file.');
      return;
    }

    const newQr: KkbQr = {
      id: `qr_${Date.now()}`,
      name: newQrName.trim(),
      base64: newQrBase64
    };

    const nextQrs = [...qrs, newQr];
    await db.put('settings', { key: 'kkbQrs', value: nextQrs });
    setNewQrName('');
    setNewQrBase64('');
    setNewQrFileName('Choose Image');
    loadSettingsData();
  };

  const handleDeleteQr = async (id: string) => {
    const nextQrs = qrs.filter(q => q.id !== id);
    await db.put('settings', { key: 'kkbQrs', value: nextQrs });
    loadSettingsData();
  };

  // 5. Geolocation Switch Toggle
  const handleToggleLocation = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const active = e.target.checked;
    setLocationEnabled(active);
    await db.put('settings', { key: 'locationSuggestEnabled', value: active });
  };

  // 5b. Dashboard Widgets Config Actions
  const handleToggleWidget = async (index: number, visible: boolean) => {
    const nextWidgets = [...widgets];
    nextWidgets[index] = { ...nextWidgets[index], visible };
    setWidgets(nextWidgets);
    await db.put('settings', { key: 'dashboardWidgets', value: nextWidgets });
  };

  // Desktop HTML5 Drag Handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragEnter = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return;
    
    const nextWidgets = [...widgets];
    const temp = nextWidgets[draggedIndex];
    nextWidgets[draggedIndex] = nextWidgets[index];
    nextWidgets[index] = temp;
    
    setWidgets(nextWidgets);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    setDraggedIndex(null);
    await db.put('settings', { key: 'dashboardWidgets', value: widgets });
  };

  // Mobile Touch Gestures Handlers
  const handleTouchStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleTouchMove = (e: React.TouchEvent, index: number) => {
    if (draggedIndex === null) return;
    
    const touch = e.touches[0];
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!targetEl) return;
    
    const rowEl = targetEl.closest('[data-index]');
    if (!rowEl) return;
    
    const targetIndex = parseInt(rowEl.getAttribute('data-index') || '', 10);
    if (isNaN(targetIndex) || targetIndex === draggedIndex) return;
    
    const nextWidgets = [...widgets];
    const temp = nextWidgets[draggedIndex];
    nextWidgets[draggedIndex] = nextWidgets[targetIndex];
    nextWidgets[targetIndex] = temp;
    
    setWidgets(nextWidgets);
    setDraggedIndex(targetIndex);
  };

  const handleTouchEnd = async () => {
    setDraggedIndex(null);
    await db.put('settings', { key: 'dashboardWidgets', value: widgets });
  };

  // 6. Backup and Wiping Utilities
  const handleExportJSON = async () => {
    const allAccounts = await db.getAll('accounts');
    const allGroups = await db.getAll('expense_groups');
    const allItems = await db.getAll('expense_items');
    const allCats = await db.getAll('categories');
    const allLbls = await db.getAll('labels');
    const allPayments = await db.getAll('payment_methods');
    const allSettings = await db.getAll('settings');

    const backupDump = {
      accounts: allAccounts,
      expense_groups: allGroups,
      expense_items: allItems,
      categories: allCats,
      labels: allLbls,
      payment_methods: allPayments,
      settings: allSettings,
      exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(backupDump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Fahh_Tracker_Backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleResetDatabase = async () => {
    if (confirm('⚠️ WARNING: Wiping the database will erase ALL expense records, accounts, and QR sheets. Proceed?')) {
      if (confirm('Are you absolutely certain? This operation CANNOT be undone!')) {
        indexedDB.deleteDatabase('FamExpenseTracker');
        alert('Database reset successful. The application will now reload to pre-seed default configurations.');
        window.location.reload();
      }
    }
  };

  return (
    <>
      <header className="view-header">
        <h1 className="view-title">Settings</h1>
      </header>

      <div className="scroll-content padding-bottom-large">
        
        {/* Account Management section */}
        <div className="settings-card">
          <h2 className="settings-card-title">Manage Accounts</h2>
          <div className="settings-list-container">
            {accounts.map((acc) => {
              const isActive = acc.id === activeAccountId;
              return (
                <div key={acc.id} className={`settings-item-row ${isActive ? 'active' : ''}`}>
                  <span className="settings-item-name">
                    {acc.name} {isActive ? '🏆' : ''}
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="accent-icon-btn" onClick={() => handleRenameAccount(acc)} title="Rename Account">✏️</button>
                    {!isActive && (
                      <button className="accent-icon-btn" onClick={() => handleSwitchAccount(acc.id)} title="Switch to Account">✓</button>
                    )}
                    {accounts.length > 1 && (
                      <button 
                        className="accent-icon-btn" 
                        style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                        onClick={() => handleDeleteAccount(acc.id)} 
                        title="Delete Account"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="settings-add-row">
            <input 
              type="text" 
              placeholder="e.g. Work Expenses" 
              className="settings-input"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
            />
            <button className="accent-icon-btn" onClick={handleAddAccount}>+</button>
          </div>
        </div>

        {/* Global Payment Methods */}
        <div className="settings-card">
          <h2 className="settings-card-title">Global Payment Methods</h2>
          <div className="settings-list-container">
            {payments.map((pm) => (
              <div key={pm.id} className="settings-item-row">
                <span className="settings-item-name">{pm.name}</span>
                {payments.length > 1 && (
                  <button 
                    className="accent-icon-btn" 
                    style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                    onClick={() => handleDeletePayment(pm.id)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="settings-add-row">
            <input 
              type="text" 
              placeholder="e.g. Credit Card" 
              className="settings-input"
              value={newPaymentName}
              onChange={(e) => setNewPaymentName(e.target.value)}
            />
            <button className="accent-icon-btn" onClick={handleAddPayment}>+</button>
          </div>
        </div>

        {/* Categories Manager */}
        <div className="settings-card">
          <h2 className="settings-card-title">Manage Categories</h2>
          <div className="settings-list-container">
            {categories.map((cat) => (
              <div key={cat.id} className="settings-item-row">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    width: '32px', 
                    height: '32px', 
                    fontSize: '16px', 
                    backgroundColor: cat.bgColor, 
                    color: cat.textColor, 
                    borderRadius: '10px', 
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)' 
                  }}>
                    {cat.icon || '💰'}
                  </span>
                  <span className="settings-item-name" style={{ marginLeft: '4px' }}>{cat.name}</span>
                </div>
                {categories.length > 1 && (
                  <button 
                    className="accent-icon-btn" 
                    style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                    onClick={() => handleDeleteCategory(cat.id)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="settings-add-row" style={{ gap: '6px' }}>
            <input 
              type="text" 
              placeholder="🍔" 
              className="settings-input" 
              style={{ maxWidth: '48px', textAlign: 'center', fontSize: '16px' }}
              value={newCatIcon}
              onChange={(e) => setNewCatIcon(e.target.value)}
            />
            <input 
              type="text" 
              placeholder="e.g. Health" 
              className="settings-input"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
            />
            <button className="accent-icon-btn" onClick={handleAddCategory}>+</button>
          </div>
        </div>

        {/* KKB QR attachments */}
        <div className="settings-card">
          <h2 className="settings-card-title">KKB QR Codes</h2>
          <p className="settings-card-desc" style={{ marginBottom: '12px' }}>
            Add GCash or Bank QRs to attach on split receipts.
          </p>
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
                  <button className="qr-item-delete-btn" onClick={() => handleDeleteQr(qr.id)} aria-label="Delete QR">
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
                type="file" 
                id="new-qr-file-input" 
                accept="image/*" 
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <button className="accent-icon-btn" onClick={handleAddQr} style={{ height: 'unset', minHeight: '38px' }}>+</button>
            </div>
          </div>
        </div>

        {/* Enable location check toggle */}
        <div className="settings-card flex-row-between">
          <div>
            <h2 className="settings-card-title" style={{ marginBottom: '4px' }}>Enable Location Suggestions</h2>
            <p className="settings-card-desc">Scopes autocompletes based on physical proximity</p>
          </div>
          <label className="switch-toggle">
            <input 
              type="checkbox" 
              id="location-toggle-checkbox"
              checked={locationEnabled}
              onChange={handleToggleLocation}
            />
            <span className="switch-slider"></span>
          </label>
        </div>

        {/* Dashboard Widgets Configurator */}
        <div className="settings-card">
          <h2 className="settings-card-title" style={{ marginBottom: '4px' }}>Configure Dashboard</h2>
          <p className="settings-card-desc" style={{ marginBottom: '16px' }}>
            Hold and drag the handles on the left to reorder, or toggle visibility.
          </p>
          <div className="settings-list-container" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {widgets.map((widget, index) => {
              const isDragging = index === draggedIndex;
              return (
                <div 
                  key={widget.id} 
                  data-index={index}
                  draggable={true}
                  onDragStart={() => handleDragStart(index)}
                  onDragEnter={() => handleDragEnter(index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  onTouchStart={() => handleTouchStart(index)}
                  onTouchMove={(e) => handleTouchMove(e, index)}
                  onTouchEnd={handleTouchEnd}
                  className={`settings-item-row drag-row ${isDragging ? 'dragging' : ''}`} 
                  style={{ 
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
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Six-dots drag handle */}
                    <div className="drag-handle" style={{ cursor: 'grab', display: 'flex', alignItems: 'center' }}>
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '18px', height: '18px', color: 'var(--text-muted)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h.008v.008H8.25V6.75Zm.008 5.25h-.008v.008h.008V12Zm0 5.25h-.008v.008h.008v-.008ZM15.75 6.75h.008v.008H15.75V6.75Zm.008 5.25h-.008v.008h.008V12Zm0 5.25h-.008v.008h.008v-.008Z" />
                      </svg>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {widget.name}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {widget.id === 'total_expenses' ? 'Balance monthly total' : widget.id === 'categories' ? 'Category summary bubbles' : widget.id === 'category_grid' ? 'Category grid quick-add shortcut' : 'Recent accordion items list'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Visibility Switch */}
                  <label className="switch-toggle" style={{ transform: 'scale(0.85)', margin: 0 }}>
                    <input 
                      type="checkbox" 
                      checked={widget.visible}
                      onChange={(e) => handleToggleWidget(index, e.target.checked)}
                    />
                    <span className="switch-slider"></span>
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        {/* Data Utilities reset */}
        <div className="settings-card">
          <h2 className="settings-card-title">Data Utilities</h2>
          <div className="settings-utilities-grid">
            <button className="utility-action-btn-tinted" onClick={handleExportJSON}>Export JSON</button>
            <button className="utility-action-btn-danger" onClick={handleResetDatabase}>Reset Database</button>
          </div>
        </div>

      </div>
    </>
  );
};
