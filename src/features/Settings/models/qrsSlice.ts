import { StateCreator } from 'zustand';
import { SettingsStore, QrsSlice } from './types';
import { db } from '../../../db';
import { KkbQr } from '../../../types';
import { addToSyncQueue, processSyncQueue } from '../../../utils/syncEngine';

export const createQrsSlice: StateCreator<
  SettingsStore,
  [],
  [],
  QrsSlice
> = (set, get) => ({
  qrs: [],
  newQrName: '',
  newQrBase64: '',
  newQrFileName: 'Choose Image',
  setNewQrName: (name) => set({ newQrName: name }),
  setNewQrBase64: (base64) => set({ newQrBase64: base64 }),
  setNewQrFileName: (fileName) => set({ newQrFileName: fileName }),

  loadQrs: async () => {
    const qrsRecord = await db.get<{ key: string; value: KkbQr[] }>('settings', 'kkbQrs');
    set({ qrs: qrsRecord ? qrsRecord.value : [] });
  },

  handleAddQr: async () => {
    const { newQrName, newQrBase64, qrs } = get();
    if (!newQrName.trim() || !newQrBase64) {
      alert('Please enter a QR nickname and choose an image file.');
      return;
    }

    const newQr: KkbQr = {
      id: crypto.randomUUID(),
      name: newQrName.trim(),
      base64: newQrBase64
    };

    const nextQrs = [...qrs, newQr];
    const key = 'kkbQrs';
    await db.put('settings', { key, value: nextQrs });
    await addToSyncQueue('settings', 'upsert', key, { key, value: nextQrs });
    processSyncQueue();
    set({
      newQrName: '',
      newQrBase64: '',
      newQrFileName: 'Choose Image'
    });
    await get().loadQrs();
  },

  confirmDeleteQr: async () => {
    const { deleteTargetQrId, qrs } = get();
    if (deleteTargetQrId) {
      const nextQrs = qrs.filter(q => q.id !== deleteTargetQrId);
      const key = 'kkbQrs';
      await db.put('settings', { key, value: nextQrs });
      await addToSyncQueue('settings', 'upsert', key, { key, value: nextQrs });
      processSyncQueue();
      set({ deleteTargetQrId: null });
      window.history.back(); // Pop state and clean up search params
      await get().loadQrs(); // Reload list
    }
  }
});
