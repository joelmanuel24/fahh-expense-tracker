import { ExpenseGroup, ExpenseItem, Category, Credit } from '../../../types';

export interface ExpensesSlice {
  expenseGroups: ExpenseGroup[];
  expenseItems: ExpenseItem[];
  credits: Credit[];
  loading: boolean;
  
  loadExpensesData: (accountId: string) => Promise<void>;
  deleteExpenseGroup: (groupId: string, accountId: string) => Promise<void>;
  saveExpenseGroup: (group: ExpenseGroup, items: ExpenseItem[], editingGroupId: string | null) => Promise<void>;
  
  loadCreditsData: (accountId: string) => Promise<void>;
  saveCredit: (credit: Credit) => Promise<void>;
  deleteCredit: (creditId: string, accountId: string) => Promise<void>;
  
  // Selectors
  getTotalExpensesForMonth: (activeMonth: Date) => number;
  getCategorySummariesForMonth: (activeMonth: Date, categories: Category[]) => any[];
  getOverviewCategorySums: (activeMonth: Date, categories: Category[]) => any[];
  getOverviewDayGroups: (activeMonth: Date, selectedCategory: string) => any[];
  getRecentExpensesGroups: (activeMonth: Date) => any[];
}

export type ExpensesStore = ExpensesSlice;
