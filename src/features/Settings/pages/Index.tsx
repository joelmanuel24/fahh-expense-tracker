import React, { useEffect, useState } from 'react';
import { db } from '../../../db';
import { Account, Category, PaymentMethod, KkbQr } from '../../../types';
import { ConfirmationDialog } from '../../../components/ConfirmationDialog';
import { SwitchToggle } from '../../../components/SwitchToggle';
import { ManageAccounts } from '../components/ManageAccounts';
import { PaymentMethods } from '../components/PaymentMethods';
import { ManageCategories } from '../components/ManageCategories';
import { KkbQrs } from '../components/KkbQrs';
import { ConfigureDashboard } from '../components/ConfigureDashboard';
import { SettingsCard } from '../components/SettingsCard';
import { useSettingsStore } from '../models/store';

interface SettingsProps {
  activeAccountId: string;
  onNavigate: (viewId: string) => void;
  onModalToggle?: (open: boolean) => void;
}

export const Settings: React.FC<SettingsProps> = ({ activeAccountId, onNavigate, onModalToggle }) => {
  const store = useSettingsStore();

  const loadSettingsData = async () => {
    await Promise.all([
      store.loadAccounts(),
      store.loadPayments(),
      store.loadCategories(activeAccountId),
      store.loadQrs(),
      store.loadLocationAndWidgets(),
    ]);
  };

  useEffect(() => {
    loadSettingsData();
  }, [activeAccountId]);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('modal') !== 'confirm-delete-payment') {
        store.setDeleteTargetPaymentId(null);
      }
      if (params.get('modal') !== 'confirm-delete-account') {
        store.setDeleteTargetAccountId(null);
      }
      if (params.get('modal') !== 'confirm-delete-category') {
        store.setDeleteTargetCategoryId(null);
      }
      if (params.get('modal') !== 'confirm-delete-qr') {
        store.setDeleteTargetQrId(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (onModalToggle) {
      onModalToggle(
        !!store.deleteTargetPaymentId || 
        !!store.deleteTargetAccountId || 
        !!store.deleteTargetCategoryId || 
        !!store.deleteTargetQrId
      );
    }
  }, [
    store.deleteTargetPaymentId, 
    store.deleteTargetAccountId, 
    store.deleteTargetCategoryId, 
    store.deleteTargetQrId, 
    onModalToggle
  ]);

  // Backup and Wiping Utilities
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
        <ManageAccounts
          accounts={store.accounts}
          activeAccountId={activeAccountId}
          onReorder={store.handleReorderAccounts}
          onRename={store.handleRenameAccount}
          onSwitch={store.handleSwitchAccount}
          onDelete={(id, name) => store.triggerDeleteAccount(id, name, store.accounts.length)}
          newAccountName={store.newAccountName}
          setNewAccountName={store.setNewAccountName}
          onAdd={store.handleAddAccount}
        />

        {/* Global Payment Methods */}
        <PaymentMethods
          payments={store.payments}
          onReorder={store.handleReorderPayments}
          onDelete={store.triggerDeletePayment}
          newPaymentName={store.newPaymentName}
          setNewPaymentName={store.setNewPaymentName}
          onAdd={store.handleAddPayment}
        />

        {/* Categories Manager */}
        <ManageCategories
          categories={store.categories}
          onReorder={store.handleReorderCategories}
          onDelete={(id, name) => store.triggerDeleteCategory(id, name, store.categories.length)}
          newCatIcon={store.newCatIcon}
          setNewCatIcon={store.setNewCatIcon}
          newCatName={store.newCatName}
          setNewCatName={store.setNewCatName}
          onAdd={() => store.handleAddCategory(activeAccountId)}
        />

        {/* KKB QR attachments */}
        <KkbQrs
          qrs={store.qrs}
          newQrName={store.newQrName}
          setNewQrName={store.setNewQrName}
          newQrFileName={store.newQrFileName}
          setNewQrFileName={store.setNewQrFileName}
          setNewQrBase64={store.setNewQrBase64}
          onAdd={store.handleAddQr}
          onDelete={store.triggerDeleteQr}
        />

        {/* Enable location check toggle */}
        <SettingsCard
          title="Enable Location Suggestions"
          description="Scopes autocompletes based on physical proximity"
          flexRowBetween
        >
          <SwitchToggle
            id="location-toggle-checkbox"
            checked={store.locationEnabled}
            onChange={store.handleToggleLocation}
          />
        </SettingsCard>

        {/* Dashboard Widgets Configurator */}
        <ConfigureDashboard
          widgets={store.widgets}
          onReorder={store.handleReorderWidgets}
          onToggleWidget={store.handleToggleWidget}
        />

        {/* Data Utilities reset */}
        <SettingsCard title="Data Utilities">
          <div className="settings-utilities-grid">
            <button className="utility-action-btn-tinted" onClick={handleExportJSON}>Export JSON</button>
            <button className="utility-action-btn-danger" onClick={handleResetDatabase}>Reset Database</button>
          </div>
        </SettingsCard>

      </div>

      {/* Reusable Deletion Confirmation Dialogs */}
      <ConfirmationDialog
        isOpen={!!store.deleteTargetPaymentId}
        title="Delete Payment Method?"
        description={
          <>
            Are you sure you want to delete <strong>{store.deleteTargetPaymentName}</strong>? This action cannot be undone.
          </>
        }
        onConfirm={store.confirmDeletePayment}
        onCancel={() => {
          store.setDeleteTargetPaymentId(null);
          window.history.back();
        }}
      />

      <ConfirmationDialog
        isOpen={!!store.deleteTargetAccountId}
        title="Delete Account?"
        description={
          <>
            Are you sure you want to delete <strong>{store.deleteTargetAccountName}</strong>? All associated expenses, custom categories, and labels will be deleted.
          </>
        }
        onConfirm={() => store.confirmDeleteAccount(activeAccountId)}
        onCancel={() => {
          store.setDeleteTargetAccountId(null);
          window.history.back();
        }}
      />

      <ConfirmationDialog
        isOpen={!!store.deleteTargetCategoryId}
        title="Delete Category?"
        description={
          <>
            Are you sure you want to delete <strong>{store.deleteTargetCategoryName}</strong>? Linked transaction items will remain but category card resets.
          </>
        }
        onConfirm={store.confirmDeleteCategory}
        onCancel={() => {
          store.setDeleteTargetCategoryId(null);
          window.history.back();
        }}
      />

      <ConfirmationDialog
        isOpen={!!store.deleteTargetQrId}
        title="Delete QR Code?"
        description={
          <>
            Are you sure you want to delete <strong>{store.deleteTargetQrName}</strong>? This action cannot be undone.
          </>
        }
        onConfirm={store.confirmDeleteQr}
        onCancel={() => {
          store.setDeleteTargetQrId(null);
          window.history.back();
        }}
      />
    </>
  );
};
