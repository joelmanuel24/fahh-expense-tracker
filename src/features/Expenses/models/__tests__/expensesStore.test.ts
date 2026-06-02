import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useExpensesStore } from '../store';
import { ExpenseGroup, ExpenseItem, Category } from '../../../../types';

// Declare a mock store variable prefixed with "mock" so Vitest allows its reference in vi.mock
const mockDbStore = {
  expense_groups: [] as any[],
  expense_items: [] as any[]
};

// Mock IndexedDB driver
vi.mock('../../../../db', () => {
  return {
    db: {
      get: vi.fn(async (table, id) => {
        const list = mockDbStore[table as keyof typeof mockDbStore] || [];
        return list.find(item => item.id === id) || null;
      }),
      put: vi.fn(async (table, item) => {
        const key = table as keyof typeof mockDbStore;
        if (!mockDbStore[key]) mockDbStore[key] = [];
        const index = mockDbStore[key].findIndex((i: any) => i.id === item.id);
        if (index > -1) {
          mockDbStore[key][index] = item;
        } else {
          mockDbStore[key].push(item);
        }
      }),
      delete: vi.fn(async (table, id) => {
        const key = table as keyof typeof mockDbStore;
        if (mockDbStore[key]) {
          mockDbStore[key] = mockDbStore[key].filter((i: any) => i.id !== id);
        }
      }),
      getGroupedByIndex: vi.fn(async (table, indexName, value) => {
        const list = mockDbStore[table as keyof typeof mockDbStore] || [];
        return list.filter((item: any) => item[indexName] === value);
      }),
      getAll: vi.fn(async (table) => {
        return mockDbStore[table as keyof typeof mockDbStore] || [];
      }),
      deleteExpenseGroup: vi.fn(async (groupId) => {
        mockDbStore.expense_groups = mockDbStore.expense_groups.filter(g => g.id !== groupId);
        mockDbStore.expense_items = mockDbStore.expense_items.filter(i => i.groupId !== groupId);
      })
    }
  };
});

describe('Expenses Zustand Store & Selectors', () => {
  beforeEach(() => {
    // Reset our mock IndexedDB store tables
    mockDbStore.expense_groups = [];
    mockDbStore.expense_items = [];

    // Reset Zustand store state before each test
    useExpensesStore.setState({
      expenseGroups: [],
      expenseItems: [],
      loading: false
    });
  });

  const mockCategories: Category[] = [
    { id: 'cat_food', accountId: 'acc_1', name: 'Food', icon: '🍔', bgColor: '#fff', textColor: '#000' },
    { id: 'cat_transport', accountId: 'acc_1', name: 'Transport', icon: '🚗', bgColor: '#fff', textColor: '#000' },
    { id: 'cat_others', accountId: 'acc_1', name: 'Others', icon: '📦', bgColor: '#fff', textColor: '#000' }
  ];

  const mockGroups: ExpenseGroup[] = [
    { id: 'g_1', accountId: 'acc_1', description: 'Grocery', date: '2025-06-01', paymentMethod: 'Cash', labels: [] },
    { id: 'g_2', accountId: 'acc_1', description: 'Gas', date: '2025-06-02', paymentMethod: 'Cash', labels: [] },
    { id: 'g_3', accountId: 'acc_1', description: 'KKB Lunch', date: '2025-06-03', paymentMethod: 'Cash', labels: [] }
  ];

  const mockItems: ExpenseItem[] = [
    // Group 1: 100 for Food, 50 for Others
    { id: 'i_1', groupId: 'g_1', description: 'Apple', amount: 100, category: 'Food' },
    { id: 'i_2', groupId: 'g_1', description: 'Sponge', amount: 50, category: 'Others' },
    // Group 2: 300 for Transport
    { id: 'i_3', groupId: 'g_2', description: 'Unleaded', amount: 300, category: 'Transport' },
    // Group 3: KKB split (Food) where Me is assigned 60, Bob is assigned 60
    { id: 'i_4', groupId: 'g_3', description: 'Pizza (Me)', amount: 60, category: 'Food', splitUser: 'Me' },
    { id: 'i_5', groupId: 'g_3', description: 'Pizza (Bob)', amount: 60, category: 'Food', splitUser: 'Bob' }
  ];

  it('should initialize with default values', () => {
    const state = useExpensesStore.getState();
    expect(state.expenseGroups).toEqual([]);
    expect(state.expenseItems).toEqual([]);
    expect(state.loading).toBe(false);
  });

  describe('getTotalExpensesForMonth Selector', () => {
    it('should aggregate only my personal share of expenses for the target month', () => {
      useExpensesStore.setState({
        expenseGroups: mockGroups,
        expenseItems: mockItems
      });

      const activeMonth = new Date('2025-06-15');
      const total = useExpensesStore.getState().getTotalExpensesForMonth(activeMonth);
      
      // Total expenses should sum:
      // Group 1 (non-KKB): 100 + 50 = 150
      // Group 2 (non-KKB): 300
      // Group 3 (KKB): Only splitUser "Me" = 60
      // Total = 150 + 300 + 60 = 510
      expect(total).toBe(510);
    });

    it('should return 0 if no groups exist in active month', () => {
      useExpensesStore.setState({
        expenseGroups: mockGroups,
        expenseItems: mockItems
      });

      const activeMonth = new Date('2025-07-15');
      const total = useExpensesStore.getState().getTotalExpensesForMonth(activeMonth);
      expect(total).toBe(0);
    });
  });

  describe('getCategorySummariesForMonth Selector', () => {
    it('should aggregate sums per category matching all provided categories (even zero sums)', () => {
      useExpensesStore.setState({
        expenseGroups: mockGroups,
        expenseItems: mockItems
      });

      const activeMonth = new Date('2025-06-15');
      const summaries = useExpensesStore.getState().getCategorySummariesForMonth(activeMonth, mockCategories);

      // Summaries should match mockCategories length
      expect(summaries.length).toBe(3);

      // Food category total: Group 1 (100) + Group 3 Me (60) = 160
      const food = summaries.find(c => c.name === 'Food');
      expect(food?.amount).toBe(160);

      // Transport category total: Group 2 (300) = 300
      const transport = summaries.find(c => c.name === 'Transport');
      expect(transport?.amount).toBe(300);

      // Others category total: Group 1 (50) = 50
      const others = summaries.find(c => c.name === 'Others');
      expect(others?.amount).toBe(50);
    });
  });

  describe('getOverviewCategorySums Selector', () => {
    it('should aggregate category sums, filter out zero sums, and sort descending by amount', () => {
      useExpensesStore.setState({
        expenseGroups: mockGroups,
        expenseItems: mockItems
      });

      const activeMonth = new Date('2025-06-15');
      const sums = useExpensesStore.getState().getOverviewCategorySums(activeMonth, mockCategories);

      // Sorted descending: Transport (300) > Food (160) > Others (50)
      expect(sums.length).toBe(3);
      expect(sums[0].name).toBe('Transport');
      expect(sums[0].amount).toBe(300);
      expect(sums[1].name).toBe('Food');
      expect(sums[1].amount).toBe(160);
      expect(sums[2].name).toBe('Others');
      expect(sums[2].amount).toBe(50);

      // Total personal balance is 510. Check percentage:
      expect(sums[0].percentage).toBeCloseTo(300 / 510);
      expect(sums[1].percentage).toBeCloseTo(160 / 510);
    });
  });

  describe('getOverviewDayGroups Selector', () => {
    it('should return date-grouped list of transaction groups ordered descending by date', () => {
      useExpensesStore.setState({
        expenseGroups: mockGroups,
        expenseItems: mockItems
      });

      const activeMonth = new Date('2025-06-15');
      const dayGroups = useExpensesStore.getState().getOverviewDayGroups(activeMonth, 'all');

      // Groups are June 3, June 2, June 1
      expect(dayGroups.length).toBe(3);
      
      expect(dayGroups[0].dayTitle).toContain('June 3, 2025');
      expect(dayGroups[0].list.length).toBe(1);
      expect(dayGroups[0].list[0].id).toBe('g_3');
      expect(dayGroups[0].list[0].total).toBe(60); // personal share total in group is 60

      expect(dayGroups[1].dayTitle).toContain('June 2, 2025');
      expect(dayGroups[1].list[0].id).toBe('g_2');

      expect(dayGroups[2].dayTitle).toContain('June 1, 2025');
      expect(dayGroups[2].list[0].id).toBe('g_1');
    });

    it('should filter groups to only those containing items from selectedCategory', () => {
      useExpensesStore.setState({
        expenseGroups: mockGroups,
        expenseItems: mockItems
      });

      const activeMonth = new Date('2025-06-15');
      const dayGroups = useExpensesStore.getState().getOverviewDayGroups(activeMonth, 'Transport');

      // Transport only exists on June 2 (g_2)
      expect(dayGroups.length).toBe(1);
      expect(dayGroups[0].list.length).toBe(1);
      expect(dayGroups[0].list[0].id).toBe('g_2');
    });
  });

  describe('getRecentExpensesGroups Selector', () => {
    it('should return chronological list of populated transaction groups flat ordered descending', () => {
      useExpensesStore.setState({
        expenseGroups: mockGroups,
        expenseItems: mockItems
      });

      const activeMonth = new Date('2025-06-15');
      const groups = useExpensesStore.getState().getRecentExpensesGroups(activeMonth);

      expect(groups.length).toBe(3);
      expect(groups[0].id).toBe('g_3');
      expect(groups[0].total).toBe(120);
      expect(groups[1].id).toBe('g_2');
      expect(groups[1].total).toBe(300);
      expect(groups[2].id).toBe('g_1');
      expect(groups[2].total).toBe(150);
    });
  });

  describe('Store Actions', () => {
    it('should save a new expense group and its breakdown items and reload state', async () => {
      const store = useExpensesStore.getState();

      const newGroup: ExpenseGroup = {
        id: 'new_g_1',
        accountId: 'acc_1',
        description: 'New Mock Vendor',
        date: '2025-06-05',
        paymentMethod: 'Cash',
        labels: []
      };

      const newItems: ExpenseItem[] = [
        { id: 'new_i_1', groupId: 'new_g_1', description: 'Mock item 1', amount: 200, category: 'Food' }
      ];

      await store.saveExpenseGroup(newGroup, newItems, null);

      // Verify that store state reloaded the newly saved items
      const updatedState = useExpensesStore.getState();
      expect(updatedState.expenseGroups.length).toBe(1);
      expect(updatedState.expenseGroups[0].description).toBe('New Mock Vendor');
      expect(updatedState.expenseItems.length).toBe(1);
      expect(updatedState.expenseItems[0].amount).toBe(200);
    });

    it('should trigger cascading deletes of old items and save new items when editing', async () => {
      const store = useExpensesStore.getState();

      // Seed initial group and items in mockIndexedDB
      const editingGroup: ExpenseGroup = {
        id: 'g_edit',
        accountId: 'acc_1',
        description: 'Old Description',
        date: '2025-06-05',
        paymentMethod: 'Cash',
        labels: []
      };

      const editingItems: ExpenseItem[] = [
        { id: 'i_old_1', groupId: 'g_edit', description: 'Old Item 1', amount: 150, category: 'Food' }
      ];

      await store.saveExpenseGroup(editingGroup, editingItems, null);

      expect(useExpensesStore.getState().expenseItems.length).toBe(1);

      // Now save edit with updated description and completely new item list
      const updatedGroup = { ...editingGroup, description: 'Updated Description' };
      const updatedItems = [
        { id: 'i_new_1', groupId: 'g_edit', description: 'New Item 1', amount: 180, category: 'Food' }
      ];

      await store.saveExpenseGroup(updatedGroup, updatedItems, 'g_edit');

      // Verify items cascaded and updated in Zustand state
      const finalState = useExpensesStore.getState();
      expect(finalState.expenseGroups[0].description).toBe('Updated Description');
      expect(finalState.expenseItems.length).toBe(1);
      expect(finalState.expenseItems[0].id).toBe('i_new_1');
      expect(finalState.expenseItems[0].description).toBe('New Item 1');
    });

    it('should delete a transaction group and its items', async () => {
      const store = useExpensesStore.getState();

      const newGroup: ExpenseGroup = {
        id: 'g_del',
        accountId: 'acc_1',
        description: 'To delete',
        date: '2025-06-05',
        paymentMethod: 'Cash',
        labels: []
      };

      const newItems: ExpenseItem[] = [
        { id: 'i_del_1', groupId: 'g_del', description: 'Item to delete', amount: 90, category: 'Others' }
      ];

      await store.saveExpenseGroup(newGroup, newItems, null);
      expect(useExpensesStore.getState().expenseGroups.length).toBe(1);

      // Trigger deletion
      await store.deleteExpenseGroup('g_del', 'acc_1');

      // Verify clean delete
      const finalState = useExpensesStore.getState();
      expect(finalState.expenseGroups.length).toBe(0);
      expect(finalState.expenseItems.length).toBe(0);
    });
  });
});
