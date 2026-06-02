import { StateCreator } from 'zustand';
import { SettingsStore, QrsSlice } from './types';
import { db } from '../../../db';
import { KkbQr } from '../../../types';

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
      id: `qr_${Date.now()}`,
      name: newQrName.trim(),
      base64: newQrBase64
    };

    const nextQrs = [...qrs, newQr];
    await db.put('settings', { key: 'kkbQrs', value: nextQrs });
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
      await db.put('settings', { key: 'kkbQrs', value: nextQrs });
      set({ deleteTargetQrId: null });
      window.history.back(); // Pop state and clean up search params
      await get().loadQrs(); // Reload list
    }
  }
});
