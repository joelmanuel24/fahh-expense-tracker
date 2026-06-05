import { StateCreator } from 'zustand';
import { SettingsStore, GeneralSlice } from './types';
import { db } from '../../../db';
import { addToSyncQueue, processSyncQueue } from '../../../utils/syncEngine';

export const createGeneralSlice: StateCreator<
  SettingsStore,
  [],
  [],
  GeneralSlice
> = (set, get) => ({
  locationEnabled: false,
  widgets: [],
  isSyncing: false,
  setIsSyncing: (val) => set({ isSyncing: val }),

  deleteTargetPaymentId: null,
  deleteTargetPaymentName: '',
  deleteTargetAccountId: null,
  deleteTargetAccountName: '',
  deleteTargetCategoryId: null,
  deleteTargetCategoryName: '',
  deleteTargetQrId: null,
  deleteTargetQrName: '',

  setDeleteTargetPaymentId: (id) => set({ deleteTargetPaymentId: id }),
  setDeleteTargetAccountId: (id) => set({ deleteTargetAccountId: id }),
  setDeleteTargetCategoryId: (id) => set({ deleteTargetCategoryId: id }),
  setDeleteTargetQrId: (id) => set({ deleteTargetQrId: id }),

  loadLocationAndWidgets: async () => {
    const locEnabled = await db.get<{ key: string; value: boolean }>('settings', 'locationSuggestEnabled');
    const widgetsRecord = await db.get<{ key: string; value: any[] }>('settings', 'dashboardWidgets');
    
    const defaultWidgets = [
      { id: 'total_expenses', name: 'Total Expenses', visible: true },
      { id: 'owe_totals', name: 'Owed Balances', visible: true },
      { id: 'categories', name: 'Category List', visible: false },
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

    set({
      locationEnabled: locEnabled ? locEnabled.value : false,
      widgets: activeWidgets
    });
  },

  handleToggleLocation: async (active: boolean) => {
    set({ locationEnabled: active });
    const key = 'locationSuggestEnabled';
    await db.put('settings', { key, value: active });
    await addToSyncQueue('settings', 'upsert', key, { key, value: active });
    processSyncQueue();
  },

  handleToggleWidget: async (index: number, visible: boolean) => {
    const nextWidgets = [...get().widgets];
    nextWidgets[index] = { ...nextWidgets[index], visible };
    set({ widgets: nextWidgets });
    const key = 'dashboardWidgets';
    await db.put('settings', { key, value: nextWidgets });
    await addToSyncQueue('settings', 'upsert', key, { key, value: nextWidgets });
    processSyncQueue();
  },

  handleReorderWidgets: async (newWidgets: any[]) => {
    set({ widgets: newWidgets });
    const key = 'dashboardWidgets';
    await db.put('settings', { key, value: newWidgets });
    await addToSyncQueue('settings', 'upsert', key, { key, value: newWidgets });
    processSyncQueue();
  },

  triggerDeletePayment: (id: string, name: string) => {
    const { payments } = get();
    if (payments.length === 1) return;
    set({
      deleteTargetPaymentId: id,
      deleteTargetPaymentName: name
    });
    window.history.pushState({ modal: 'confirm-delete-payment' }, '', '?modal=confirm-delete-payment');
  },

  triggerDeleteAccount: (id: string, name: string, accountsLength: number) => {
    if (accountsLength === 1) return;
    set({
      deleteTargetAccountId: id,
      deleteTargetAccountName: name
    });
    window.history.pushState({ modal: 'confirm-delete-account' }, '', '?modal=confirm-delete-account');
  },

  triggerDeleteCategory: (id: string, name: string, categoriesLength: number) => {
    if (categoriesLength === 1) return;
    set({
      deleteTargetCategoryId: id,
      deleteTargetCategoryName: name
    });
    window.history.pushState({ modal: 'confirm-delete-category' }, '', '?modal=confirm-delete-category');
  },

  triggerDeleteQr: (id: string, name: string) => {
    set({
      deleteTargetQrId: id,
      deleteTargetQrName: name
    });
    window.history.pushState({ modal: 'confirm-delete-qr' }, '', '?modal=confirm-delete-qr');
  }
});
