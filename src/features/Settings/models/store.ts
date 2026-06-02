import { create } from 'zustand';
import { SettingsStore } from './types';
import { createAccountsSlice } from './accountsSlice';
import { createPaymentsSlice } from './paymentsSlice';
import { createCategoriesSlice } from './categoriesSlice';
import { createQrsSlice } from './qrsSlice';
import { createGeneralSlice } from './generalSlice';

export const useSettingsStore = create<SettingsStore>((...a) => ({
  ...createAccountsSlice(...a),
  ...createPaymentsSlice(...a),
  ...createCategoriesSlice(...a),
  ...createQrsSlice(...a),
  ...createGeneralSlice(...a)
}));
