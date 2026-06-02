import { create } from 'zustand';
import { ExpensesStore } from './types';
import { createExpensesSlice } from './expensesSlice';

export const useExpensesStore = create<ExpensesStore>((...a) => ({
  ...createExpensesSlice(...a)
}));
