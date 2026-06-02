import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { Account, Category, PaymentMethod, KkbQr } from '../types';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import { ReorderableList } from '../components/ReorderableList';

export const sortItemsByIds = <T extends { id: string }>(items: T[], orderIds: string[] | null | undefined): T[] => {
  if (!orderIds || !Array.isArray(orderIds)) return items;
  return [...items].sort((a, b) => {
    const indexA = orderIds.indexOf(a.id);
    const indexB = orderIds.indexOf(b.id);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
};

interface SettingsProps {
  activeAccountId: string;
  onNavigate: (viewId: string) => void;
  onModalToggle?: (open: boolean) => void;
}

export const Settings: React.FC<SettingsProps> = ({ activeAccountId, onNavigate, onModalToggle }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [newAccountName, setNewAccountName] = useState<string>('');

  const [payments, setPayments] = useState<PaymentMethod[]>([]);
  const [newPaymentName, setNewPaymentName] = useState<string>('');

  // Payment Delete Confirmation bottom drawer state
  const [deleteTargetPaymentId, setDeleteTargetPaymentId] = useState<string | null>(null);
  const [deleteTargetPaymentName, setDeleteTargetPaymentName] = useState<string>('');

  // Account Delete Confirmation bottom drawer state
  const [deleteTargetAccountId, setDeleteTargetAccountId] = useState<string | null>(null);
  const [deleteTargetAccountName, setDeleteTargetAccountName] = useState<string>('');

  // Category Delete Confirmation bottom drawer state
  const [deleteTargetCategoryId, setDeleteTargetCategoryId] = useState<string | null>(null);
  const [deleteTargetCategoryName, setDeleteTargetCategoryName] = useState<string>('');

  // QR Delete Confirmation bottom drawer state
  const [deleteTargetQrId, setDeleteTargetQrId] = useState<string | null>(null);
  const [deleteTargetQrName, setDeleteTargetQrName] = useState<string>('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatIcon, setNewCatIcon] = useState<string>('');
  const [newCatName, setNewCatName] = useState<string>('');

  const [qrs, setQrs] = useState<KkbQr[]>([]);
  const [newQrName, setNewQrName] = useState<string>('');
  const [newQrBase64, setNewQrBase64] = useState<string>('');
  const [newQrFileName, setNewQrFileName] = useState<string>('Choose Image');

  const [locationEnabled, setLocationEnabled] = useState<boolean>(false);
  const [widgets, setWidgets] = useState<any[]>([]);

  const loadSettingsData = async () => {
    const accList = await db.getAll<Account>('accounts');
    const accountsOrder = await db.get<{ key: string; value: string[] }>('settings', 'accounts_order');
    setAccounts(sortItemsByIds(accList, accountsOrder ? accountsOrder.value : null));

    const pmList = await db.getAll<PaymentMethod>('payment_methods');
    const paymentsOrder = await db.get<{ key: string; value: string[] }>('settings', 'payment_methods_order');
    setPayments(sortItemsByIds(pmList, paymentsOrder ? paymentsOrder.value : null));

    const catList = await db.getGroupedByIndex<Category>('categories', 'accountId', activeAccountId);
    const categoriesOrder = await db.get<{ key: string; value: string[] }>('settings', 'categories_order');
    setCategories(sortItemsByIds(catList, categoriesOrder ? categoriesOrder.value : null));

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

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('modal') !== 'confirm-delete-payment') {
        setDeleteTargetPaymentId(null);
      }
      if (params.get('modal') !== 'confirm-delete-account') {
        setDeleteTargetAccountId(null);
      }
      if (params.get('modal') !== 'confirm-delete-category') {
        setDeleteTargetCategoryId(null);
      }
      if (params.get('modal') !== 'confirm-delete-qr') {
        setDeleteTargetQrId(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (onModalToggle) {
      onModalToggle(
        !!deleteTargetPaymentId || 
        !!deleteTargetAccountId || 
        !!deleteTargetCategoryId || 
        !!deleteTargetQrId
      );
    }
  }, [
    deleteTargetPaymentId, 
    deleteTargetAccountId, 
    deleteTargetCategoryId, 
    deleteTargetQrId, 
    onModalToggle
  ]);

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

  const triggerDeleteAccount = (id: string, name: string) => {
    if (accounts.length === 1) return;
    setDeleteTargetAccountId(id);
    setDeleteTargetAccountName(name);
    window.history.pushState({ modal: 'confirm-delete-account' }, '', '?modal=confirm-delete-account');
  };

  const confirmDeleteAccount = async () => {
    if (!deleteTargetAccountId) return;
    const id = deleteTargetAccountId;
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

    setDeleteTargetAccountId(null);
    window.history.back();

    // If active account was deleted, switch back to remaining
    if (activeAccountId === id) {
      const remaining = await db.getAll<Account>('accounts');
      await db.put('settings', { key: 'activeAccountId', value: remaining[0].id });
      window.location.reload();
    } else {
      loadSettingsData();
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

  const triggerDeletePayment = (id: string, name: string) => {
    if (payments.length === 1) return;
    setDeleteTargetPaymentId(id);
    setDeleteTargetPaymentName(name);
    window.history.pushState({ modal: 'confirm-delete-payment' }, '', '?modal=confirm-delete-payment');
  };

  const confirmDeletePayment = async () => {
    if (deleteTargetPaymentId) {
      await db.delete('payment_methods', deleteTargetPaymentId);
      setDeleteTargetPaymentId(null);
      window.history.back(); // Pop state and clean up search params
      loadSettingsData(); // Reload list
    }
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

  const triggerDeleteCategory = (id: string, name: string) => {
    if (categories.length === 1) return;
    setDeleteTargetCategoryId(id);
    setDeleteTargetCategoryName(name);
    window.history.pushState({ modal: 'confirm-delete-category' }, '', '?modal=confirm-delete-category');
  };

  const confirmDeleteCategory = async () => {
    if (deleteTargetCategoryId) {
      await db.delete('categories', deleteTargetCategoryId);
      setDeleteTargetCategoryId(null);
      window.history.back(); // Pop state and clean up search params
      loadSettingsData(); // Reload list
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

  const triggerDeleteQr = (id: string, name: string) => {
    setDeleteTargetQrId(id);
    setDeleteTargetQrName(name);
    window.history.pushState({ modal: 'confirm-delete-qr' }, '', '?modal=confirm-delete-qr');
  };

  const confirmDeleteQr = async () => {
    if (deleteTargetQrId) {
      const nextQrs = qrs.filter(q => q.id !== deleteTargetQrId);
      await db.put('settings', { key: 'kkbQrs', value: nextQrs });
      setDeleteTargetQrId(null);
      window.history.back(); // Pop state and clean up search params
      loadSettingsData(); // Reload list
    }
  };

  // 5. Geolocation Switch Toggle
  const handleToggleLocation = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const active = e.target.checked;
    setLocationEnabled(active);
    await db.put('settings', { key: 'locationSuggestEnabled', value: active });
  };

  // 5b. Dashboard Widgets Config Actions
  const handleToggleWidget = (index: number, visible: boolean) => {
    setWidgets((prevWidgets) => {
      const nextWidgets = [...prevWidgets];
      nextWidgets[index] = { ...nextWidgets[index], visible };
      db.put('settings', { key: 'dashboardWidgets', value: nextWidgets });
      return nextWidgets;
    });
  };

  // Generic list reorder handlers
  const handleReorderAccounts = (newAccounts: Account[]) => {
    setAccounts(newAccounts);
    db.put('settings', { key: 'accounts_order', value: newAccounts.map(a => a.id) });
  };

  const handleReorderPayments = (newPayments: PaymentMethod[]) => {
    setPayments(newPayments);
    db.put('settings', { key: 'payment_methods_order', value: newPayments.map(p => p.id) });
  };

  const handleReorderCategories = (newCategories: Category[]) => {
    setCategories(newCategories);
    db.put('settings', { key: 'categories_order', value: newCategories.map(c => c.id) });
  };

  const handleReorderWidgets = (newWidgets: any[]) => {
    setWidgets(newWidgets);
    db.put('settings', { key: 'dashboardWidgets', value: newWidgets });
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
            <ReorderableList
              items={accounts}
              onReorder={handleReorderAccounts}
              itemClassName="settings-item-row drag-row"
              getItemClassName={(acc) => (acc.id === activeAccountId ? 'active' : '')}
              renderItem={(acc) => {
                const isActive = acc.id === activeAccountId;
                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      <div className="drag-handle" style={{ cursor: 'grab', display: 'flex', alignItems: 'center', opacity: 0.5 }}>
                        <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '16px', height: '16px', color: 'var(--text-muted)' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h.008v.008H8.25V6.75Zm.008 5.25h-.008v.008h.008V12Zm0 5.25h-.008v.008h.008v-.008ZM15.75 6.75h.008v.008H15.75V6.75Zm.008 5.25h-.008v.008h.008V12Zm0 5.25h-.008v.008h.008v-.008Z" />
                        </svg>
                      </div>
                      <span className="settings-item-name">
                        {acc.name} {isActive ? '🏆' : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="accent-icon-btn" onClick={() => handleRenameAccount(acc)} title="Rename Account">
                        <svg fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                      </button>
                      {!isActive && (
                        <button className="accent-icon-btn" onClick={() => handleSwitchAccount(acc.id)} title="Switch to Account">
                          <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        </button>
                      )}
                      {accounts.length > 1 && (
                        <button 
                          className="accent-icon-btn" 
                          style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                          onClick={() => triggerDeleteAccount(acc.id, acc.name)} 
                          title="Delete Account"
                        >
                          <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </>
                );
              }}
            />
          </div>
          <div className="settings-add-row">
            <input 
              type="text" 
              placeholder="e.g. Work Expenses" 
              className="settings-input"
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
            />
            <button className="accent-icon-btn" onClick={handleAddAccount} aria-label="Add Account">
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Global Payment Methods */}
        <div className="settings-card">
          <h2 className="settings-card-title">Payment Methods</h2>
          <div className="settings-list-container">
            <ReorderableList
              items={payments}
              onReorder={handleReorderPayments}
              itemClassName="settings-item-row drag-row"
              renderItem={(pm) => (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <div className="drag-handle" style={{ cursor: 'grab', display: 'flex', alignItems: 'center', opacity: 0.5 }}>
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '16px', height: '16px', color: 'var(--text-muted)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h.008v.008H8.25V6.75Zm.008 5.25h-.008v.008h.008V12Zm0 5.25h-.008v.008h.008v-.008ZM15.75 6.75h.008v.008H15.75V6.75Zm.008 5.25h-.008v.008h.008V12Zm0 5.25h-.008v.008h.008v-.008Z" />
                      </svg>
                    </div>
                    <span className="settings-item-name">{pm.name}</span>
                  </div>
                  {payments.length > 1 && (
                    <button 
                      className="accent-icon-btn" 
                      style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
                      onClick={() => triggerDeletePayment(pm.id, pm.name)}
                      aria-label="Delete Payment Method"
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
          <div className="settings-add-row">
            <input 
              type="text" 
              placeholder="e.g. Credit Card" 
              className="settings-input"
              value={newPaymentName}
              onChange={(e) => setNewPaymentName(e.target.value)}
            />
            <button className="accent-icon-btn" onClick={handleAddPayment} aria-label="Add Payment Method">
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Categories Manager */}
        <div className="settings-card">
          <h2 className="settings-card-title">Manage Categories</h2>
          <div className="settings-list-container">
            <ReorderableList
              items={categories}
              onReorder={handleReorderCategories}
              itemClassName="settings-item-row drag-row"
              renderItem={(cat) => (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <div className="drag-handle" style={{ cursor: 'grab', display: 'flex', alignItems: 'center', opacity: 0.5 }}>
                      <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '16px', height: '16px', color: 'var(--text-muted)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h.008v.008H8.25V6.75Zm.008 5.25h-.008v.008h.008V12Zm0 5.25h-.008v.008h.008v-.008ZM15.75 6.75h.008v.008H15.75V6.75Zm.008 5.25h-.008v.008h.008V12Zm0 5.25h-.008v.008h.008v-.008Z" />
                      </svg>
                    </div>
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
                      onClick={() => triggerDeleteCategory(cat.id, cat.name)}
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
            <button className="accent-icon-btn" onClick={handleAddCategory} aria-label="Add Category">
              <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
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
                  <button className="qr-item-delete-btn" onClick={() => triggerDeleteQr(qr.id, qr.name)} aria-label="Delete QR">
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
              <button className="accent-icon-btn" onClick={handleAddQr} style={{ height: 'unset', minHeight: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-label="Add QR Code">
                <svg fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" style={{ width: '16px', height: '16px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
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
            <ReorderableList
              items={widgets}
              onReorder={handleReorderWidgets}
              itemClassName="settings-item-row drag-row"
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
                </>
              )}
            />
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

      {/* Reusable Deletion Confirmation Dialogs */}
      <ConfirmationDialog
        isOpen={!!deleteTargetPaymentId}
        title="Delete Payment Method?"
        description={
          <>
            Are you sure you want to delete <strong>{deleteTargetPaymentName}</strong>? This action cannot be undone.
          </>
        }
        onConfirm={confirmDeletePayment}
        onCancel={() => {
          setDeleteTargetPaymentId(null);
          window.history.back();
        }}
      />

      <ConfirmationDialog
        isOpen={!!deleteTargetAccountId}
        title="Delete Account?"
        description={
          <>
            Are you sure you want to delete <strong>{deleteTargetAccountName}</strong>? All associated expenses, custom categories, and labels will be deleted.
          </>
        }
        onConfirm={confirmDeleteAccount}
        onCancel={() => {
          setDeleteTargetAccountId(null);
          window.history.back();
        }}
      />

      <ConfirmationDialog
        isOpen={!!deleteTargetCategoryId}
        title="Delete Category?"
        description={
          <>
            Are you sure you want to delete <strong>{deleteTargetCategoryName}</strong>? Linked transaction items will remain but category card resets.
          </>
        }
        onConfirm={confirmDeleteCategory}
        onCancel={() => {
          setDeleteTargetCategoryId(null);
          window.history.back();
        }}
      />

      <ConfirmationDialog
        isOpen={!!deleteTargetQrId}
        title="Delete QR Code?"
        description={
          <>
            Are you sure you want to delete <strong>{deleteTargetQrName}</strong>? This action cannot be undone.
          </>
        }
        onConfirm={confirmDeleteQr}
        onCancel={() => {
          setDeleteTargetQrId(null);
          window.history.back();
        }}
      />
    </>
  );
};
