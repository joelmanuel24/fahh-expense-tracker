import { StateCreator } from 'zustand';
import { SettingsStore, GeneralSlice } from './types';
import { db } from '../../../db';

export const createGeneralSlice: StateCreator<
  SettingsStore,
  [],
  [],
  GeneralSlice
> = (set, get) => ({
  locationEnabled: false,
  widgets: [],

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

    set({
      locationEnabled: locEnabled ? locEnabled.value : false,
      widgets: activeWidgets
    });
  },

  handleToggleLocation: async (active: boolean) => {
    set({ locationEnabled: active });
    await db.put('settings', { key: 'locationSuggestEnabled', value: active });
  },

  handleToggleWidget: async (index: number, visible: boolean) => {
    const nextWidgets = [...get().widgets];
    nextWidgets[index] = { ...nextWidgets[index], visible };
    set({ widgets: nextWidgets });
    await db.put('settings', { key: 'dashboardWidgets', value: nextWidgets });
  },

  handleReorderWidgets: async (newWidgets: any[]) => {
    set({ widgets: newWidgets });
    await db.put('settings', { key: 'dashboardWidgets', value: newWidgets });
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
