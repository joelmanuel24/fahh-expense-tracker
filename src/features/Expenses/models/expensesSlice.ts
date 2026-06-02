import { StateCreator } from 'zustand';
import { ExpensesStore, ExpensesSlice } from './types';
import { db } from '../../../db';
import { ExpenseGroup, ExpenseItem, Category } from '../../../types';
import { shouldIncludeItemInAccount } from '../../Dashboard/utils/dashboardLogic';

// Date formatter helper inside selectors
const friendlyDateFormatter = (dateStr: string) => {
  const today = new Date();
  today.setHours(0,0,0,0);
  const target = new Date(dateStr);
  target.setHours(0,0,0,0);

  const diffTime = today.getTime() - target.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) {
    const options = { weekday: 'long' } as const;
    return `Last ${target.toLocaleDateString('default', options)}`;
  }
  return target.toLocaleDateString('default', { month: 'long', day: 'numeric', year: 'numeric' });
};

export const createExpensesSlice: StateCreator<
  ExpensesStore,
  [],
  [],
  ExpensesSlice
> = (set, get) => ({
  expenseGroups: [],
  expenseItems: [],
  loading: false,

  loadExpensesData: async (accountId: string) => {
    set({ loading: true });
    try {
      const [groups, items] = await Promise.all([
        db.getGroupedByIndex<ExpenseGroup>('expense_groups', 'accountId', accountId),
        db.getAll<ExpenseItem>('expense_items')
      ]);
      set({ expenseGroups: groups, expenseItems: items });
    } catch (err) {
      console.error('Failed to load expenses data', err);
    } finally {
      set({ loading: false });
    }
  },

  deleteExpenseGroup: async (groupId: string, accountId: string) => {
    await db.deleteExpenseGroup(groupId);
    await get().loadExpensesData(accountId);
  },

  saveExpenseGroup: async (group: ExpenseGroup, items: ExpenseItem[], editingGroupId: string | null) => {
    const existingGroup = editingGroupId ? await db.get<ExpenseGroup>('expense_groups', editingGroupId) : null;
    const groupRecord: ExpenseGroup = {
      ...group,
      paidUsers: existingGroup ? existingGroup.paidUsers || [] : []
    };

    await db.put('expense_groups', groupRecord);

    if (editingGroupId) {
      const oldItems = await db.getGroupedByIndex<ExpenseItem>('expense_items', 'groupId', editingGroupId);
      for (const old of oldItems) {
        await db.delete('expense_items', old.id);
      }
    }

    for (const item of items) {
      const itemRecord: ExpenseItem = {
        ...item,
        id: item.id && !item.id.startsWith('new_') ? item.id : `item_${Math.random().toString(36).substring(2, 9)}`,
        groupId: group.id
      };
      await db.put('expense_items', itemRecord);
    }

    await get().loadExpensesData(group.accountId);
  },

  // Selectors
  getTotalExpensesForMonth: (activeMonth: Date) => {
    const { expenseGroups, expenseItems } = get();
    const targetYear = activeMonth.getFullYear();
    const targetMonth = activeMonth.getMonth();

    const monthlyGroups = expenseGroups.filter((g) => {
      const d = new Date(g.date);
      return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
    });

    const monthlyItems = expenseItems.filter(item => monthlyGroups.some(g => g.id === item.groupId));

    const kkbGroupIds = new Set<string>();
    monthlyGroups.forEach(g => {
      const groupItems = monthlyItems.filter(item => item.groupId === g.id);
      const hasSplits = groupItems.some(i => i.splitUser && i.splitUser.trim() !== '');
      if (hasSplits) {
        kkbGroupIds.add(g.id);
      }
    });

    return monthlyItems
      .filter(item => shouldIncludeItemInAccount(item, kkbGroupIds.has(item.groupId)))
      .reduce((acc, curr) => acc + curr.amount, 0);
  },

  getCategorySummariesForMonth: (activeMonth: Date, categories: Category[]) => {
    const { expenseGroups, expenseItems } = get();
    const targetYear = activeMonth.getFullYear();
    const targetMonth = activeMonth.getMonth();

    const monthlyGroups = expenseGroups.filter((g) => {
      const d = new Date(g.date);
      return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
    });

    const monthlyItems = expenseItems.filter(item => monthlyGroups.some(g => g.id === item.groupId));

    const kkbGroupIds = new Set<string>();
    monthlyGroups.forEach(g => {
      const groupItems = monthlyItems.filter(item => item.groupId === g.id);
      const hasSplits = groupItems.some(i => i.splitUser && i.splitUser.trim() !== '');
      if (hasSplits) {
        kkbGroupIds.add(g.id);
      }
    });

    return categories.map((cat) => {
      const sum = monthlyItems
        .filter(item => item.category === cat.name && shouldIncludeItemInAccount(item, kkbGroupIds.has(item.groupId)))
        .reduce((acc, curr) => acc + curr.amount, 0);
      return {
        name: cat.name,
        amount: sum,
        icon: cat.icon,
        bgColor: cat.bgColor,
        textColor: cat.textColor
      };
    });
  },

  getOverviewCategorySums: (activeMonth: Date, categories: Category[]) => {
    const { expenseGroups, expenseItems } = get();
    const targetYear = activeMonth.getFullYear();
    const targetMonth = activeMonth.getMonth();

    const monthlyGroups = expenseGroups.filter((g) => {
      const d = new Date(g.date);
      return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
    });

    const monthlyItems = expenseItems.filter(item => monthlyGroups.some(g => g.id === item.groupId));

    const kkbGroupIds = new Set<string>();
    monthlyGroups.forEach(g => {
      const groupItems = monthlyItems.filter(item => item.groupId === g.id);
      const hasSplits = groupItems.some(i => i.splitUser && i.splitUser.trim() !== '');
      if (hasSplits) {
        kkbGroupIds.add(g.id);
      }
    });

    const billSum = monthlyItems
      .filter(item => shouldIncludeItemInAccount(item, kkbGroupIds.has(item.groupId)))
      .reduce((acc, curr) => acc + curr.amount, 0);

    const sums: any[] = [];
    categories.forEach((cat) => {
      const sum = monthlyItems
        .filter(item => item.category === cat.name && shouldIncludeItemInAccount(item, kkbGroupIds.has(item.groupId)))
        .reduce((acc, curr) => acc + curr.amount, 0);
      if (sum > 0) {
        sums.push({
          name: cat.name,
          amount: sum,
          icon: cat.icon,
          bgColor: cat.bgColor,
          textColor: cat.textColor,
          percentage: billSum > 0 ? sum / billSum : 0
        });
      }
    });

    return sums.sort((a, b) => b.amount - a.amount);
  },

  getOverviewDayGroups: (activeMonth: Date, selectedCategory: string) => {
    const { expenseGroups, expenseItems } = get();
    const targetYear = activeMonth.getFullYear();
    const targetMonth = activeMonth.getMonth();

    const monthlyGroups = expenseGroups.filter((g) => {
      const d = new Date(g.date);
      return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
    });

    const monthlyItems = expenseItems.filter(item => monthlyGroups.some(g => g.id === item.groupId));

    const kkbGroupIds = new Set<string>();
    monthlyGroups.forEach(g => {
      const groupItems = monthlyItems.filter(item => item.groupId === g.id);
      const hasSplits = groupItems.some(i => i.splitUser && i.splitUser.trim() !== '');
      if (hasSplits) {
        kkbGroupIds.add(g.id);
      }
    });

    const filteredItems = monthlyItems.filter((item) => {
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      return matchesCategory && shouldIncludeItemInAccount(item, kkbGroupIds.has(item.groupId));
    });

    const filteredGroups = monthlyGroups.filter(g => filteredItems.some(item => item.groupId === g.id));

    const sortedGroups = filteredGroups.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateB !== dateA) {
        return dateB - dateA;
      }
      return b.id.localeCompare(a.id);
    });

    const dateMap = new Map<string, any[]>();
    sortedGroups.forEach((g) => {
      const header = friendlyDateFormatter(g.date);
      const groupItems = filteredItems.filter(item => item.groupId === g.id);
      const groupTotal = groupItems.reduce((acc, curr) => acc + curr.amount, 0);
      const populated = {
        ...g,
        items: groupItems,
        total: groupTotal
      };

      if (!dateMap.has(header)) {
        dateMap.set(header, []);
      }
      dateMap.get(header)!.push(populated);
    });

    const dayGroupsList: any[] = [];
    for (const [dayTitle, list] of dateMap.entries()) {
      dayGroupsList.push({ dayTitle, list });
    }
    return dayGroupsList;
  },

  getRecentExpensesGroups: (activeMonth: Date) => {
    const { expenseGroups, expenseItems } = get();
    const targetYear = activeMonth.getFullYear();
    const targetMonth = activeMonth.getMonth();

    const monthlyGroups = expenseGroups.filter((g) => {
      const d = new Date(g.date);
      return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
    });

    const monthlyItems = expenseItems.filter(item => monthlyGroups.some(g => g.id === item.groupId));

    return monthlyGroups.map((g) => {
      const groupItems = monthlyItems.filter(item => item.groupId === g.id);
      const groupTotal = groupItems.reduce((acc, curr) => acc + curr.amount, 0);
      return {
        ...g,
        items: groupItems,
        total: groupTotal
      };
    }).sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateB !== dateA) {
        return dateB - dateA;
      }
      return b.id.localeCompare(a.id);
    });
  }
});
