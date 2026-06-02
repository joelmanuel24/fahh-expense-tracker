import { StateCreator } from 'zustand';
import { SettingsStore, AccountsSlice } from './types';
import { db } from '../../../db';
import { sortItemsByIds } from '../utils/layoutLogic';
import { Account, Category } from '../../../types';

export const createAccountsSlice: StateCreator<
  SettingsStore,
  [],
  [],
  AccountsSlice
> = (set, get) => ({
  accounts: [],
  newAccountName: '',
  setNewAccountName: (name) => set({ newAccountName: name }),
  
  loadAccounts: async () => {
    const accList = await db.getAll<Account>('accounts');
    const accountsOrder = await db.get<{ key: string; value: string[] }>('settings', 'accounts_order');
    set({ accounts: sortItemsByIds(accList, accountsOrder ? accountsOrder.value : null) });
  },

  handleAddAccount: async () => {
    const { newAccountName } = get();
    if (!newAccountName.trim()) return;
    const newId = `acc_${Date.now()}`;
    const newAcc: Account = { id: newId, name: newAccountName.trim() };
    await db.put('accounts', newAcc);
    set({ newAccountName: '' });
    await get().loadAccounts();
  },

  handleSwitchAccount: async (id: string) => {
    await db.put('settings', { key: 'activeAccountId', value: id });
    window.location.reload();
  },

  handleRenameAccount: async (acc: Account) => {
    const newName = prompt('Enter new name for account:', acc.name);
    if (newName !== null && newName.trim() !== '') {
      const updated = { ...acc, name: newName.trim() };
      await db.put('accounts', updated);
      await get().loadAccounts();
    }
  },

  confirmDeleteAccount: async (activeAccountId: string) => {
    const { deleteTargetAccountId } = get();
    if (!deleteTargetAccountId) return;
    const id = deleteTargetAccountId;
    await db.delete('accounts', id);
    
    // Cascading deletes of groups and items
    const allGroups = await db.getGroupedByIndex<any>('expense_groups', 'accountId', id);
    for (const g of allGroups) {
      await db.deleteExpenseGroup(g.id);
    }

    // Cascading deletes of scoped categories & labels
    const cats = await db.getGroupedByIndex<Category>('categories', 'accountId', id);
    for (const c of cats) await db.delete('categories', c.id);

    const lbls = await db.getGroupedByIndex<any>('labels', 'accountId', id);
    for (const l of lbls) await db.delete('labels', l.id);

    set({ deleteTargetAccountId: null });
    window.history.back();

    // If active account was deleted, switch back to remaining
    if (activeAccountId === id) {
      const remaining = await db.getAll<Account>('accounts');
      await db.put('settings', { key: 'activeAccountId', value: remaining[0].id });
      window.location.reload();
    } else {
      await get().loadAccounts();
    }
  },

  handleReorderAccounts: async (newAccounts: Account[]) => {
    set({ accounts: newAccounts });
    await db.put('settings', { key: 'accounts_order', value: newAccounts.map(a => a.id) });
  }
});
