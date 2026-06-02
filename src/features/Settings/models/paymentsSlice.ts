import { StateCreator } from 'zustand';
import { SettingsStore, PaymentsSlice } from './types';
import { db } from '../../../db';
import { sortItemsByIds } from '../utils/layoutLogic';
import { PaymentMethod } from '../../../types';

export const createPaymentsSlice: StateCreator<
  SettingsStore,
  [],
  [],
  PaymentsSlice
> = (set, get) => ({
  payments: [],
  newPaymentName: '',
  setNewPaymentName: (name) => set({ newPaymentName: name }),

  loadPayments: async () => {
    const pmList = await db.getAll<PaymentMethod>('payment_methods');
    const paymentsOrder = await db.get<{ key: string; value: string[] }>('settings', 'payment_methods_order');
    set({ payments: sortItemsByIds(pmList, pmList && paymentsOrder ? paymentsOrder.value : null) });
  },

  handleAddPayment: async () => {
    const { newPaymentName } = get();
    if (!newPaymentName.trim()) return;
    const newPm = { id: `pm_${Date.now()}`, name: newPaymentName.trim() };
    await db.put('payment_methods', newPm);
    set({ newPaymentName: '' });
    await get().loadPayments();
  },

  confirmDeletePayment: async () => {
    const { deleteTargetPaymentId } = get();
    if (deleteTargetPaymentId) {
      await db.delete('payment_methods', deleteTargetPaymentId);
      set({ deleteTargetPaymentId: null });
      window.history.back(); // Pop state and clean up search params
      await get().loadPayments(); // Reload list
    }
  },

  handleReorderPayments: async (newPayments: PaymentMethod[]) => {
    set({ payments: newPayments });
    await db.put('settings', { key: 'payment_methods_order', value: newPayments.map(p => p.id) });
  }
});
