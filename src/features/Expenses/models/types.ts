import { ExpenseGroup, ExpenseItem, Category } from '../../../types';

export interface ExpensesSlice {
  expenseGroups: ExpenseGroup[];
  expenseItems: ExpenseItem[];
  loading: boolean;
  
  loadExpensesData: (accountId: string) => Promise<void>;
  deleteExpenseGroup: (groupId: string, accountId: string) => Promise<void>;
  saveExpenseGroup: (group: ExpenseGroup, items: ExpenseItem[], editingGroupId: string | null) => Promise<void>;
  
  // Selectors
  getTotalExpensesForMonth: (activeMonth: Date) => number;
  getCategorySummariesForMonth: (activeMonth: Date, categories: Category[]) => any[];
  getOverviewCategorySums: (activeMonth: Date, categories: Category[]) => any[];
  getOverviewDayGroups: (activeMonth: Date, selectedCategory: string) => any[];
  getRecentExpensesGroups: (activeMonth: Date) => any[];
}

export type ExpensesStore = ExpensesSlice;
