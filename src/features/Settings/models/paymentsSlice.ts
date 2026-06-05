import { StateCreator } from 'zustand';
import { SettingsStore, PaymentsSlice } from './types';
import { db } from '../../../db';
import { sortItemsByIds } from '../utils/layoutLogic';
import { PaymentMethod } from '../../../types';
import { addToSyncQueue, processSyncQueue } from '../../../utils/syncEngine';

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
    const newPm = { id: crypto.randomUUID(), name: newPaymentName.trim() };
    await db.put('payment_methods', newPm);
    await addToSyncQueue('payment_methods', 'upsert', newPm.id, newPm);
    processSyncQueue();
    set({ newPaymentName: '' });
    await get().loadPayments();
  },

  confirmDeletePayment: async () => {
    const { deleteTargetPaymentId } = get();
    if (deleteTargetPaymentId) {
      await db.delete('payment_methods', deleteTargetPaymentId);
      await addToSyncQueue('payment_methods', 'delete', deleteTargetPaymentId, null);
      processSyncQueue();
      set({ deleteTargetPaymentId: null });
      window.history.back(); // Pop state and clean up search params
      await get().loadPayments(); // Reload list
    }
  },

  handleReorderPayments: async (newPayments: PaymentMethod[]) => {
    set({ payments: newPayments });
    const orderKey = 'payment_methods_order';
    const orderVal = newPayments.map(p => p.id);
    await db.put('settings', { key: orderKey, value: orderVal });
    await addToSyncQueue('settings', 'upsert', orderKey, { key: orderKey, value: orderVal });
    processSyncQueue();
  }
});
