import { StateCreator } from 'zustand';
import { SettingsStore, AccountsSlice } from './types';
import { db } from '../../../db';
import { sortItemsByIds } from '../utils/layoutLogic';
import { Account, Category } from '../../../types';
import { addToSyncQueue, processSyncQueue } from '../../../utils/syncEngine';

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
    const newId = crypto.randomUUID();
    const newAcc: Account = { id: newId, name: newAccountName.trim() };
    await db.put('accounts', newAcc);
    await addToSyncQueue('accounts', 'upsert', newId, newAcc);
    processSyncQueue();
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
      await addToSyncQueue('accounts', 'upsert', updated.id, updated);
      processSyncQueue();
      await get().loadAccounts();
    }
  },

  confirmDeleteAccount: async (activeAccountId: string) => {
    const { deleteTargetAccountId } = get();
    if (!deleteTargetAccountId) return;
    const id = deleteTargetAccountId;
    await db.delete('accounts', id);
    await addToSyncQueue('accounts', 'delete', id, null);
    
    // Cascading deletes of groups and items
    const allGroups = await db.getGroupedByIndex<any>('expense_groups', 'accountId', id);
    for (const g of allGroups) {
      await db.deleteExpenseGroup(g.id);
    }

    // Cascading deletes of scoped categories & labels
    const cats = await db.getGroupedByIndex<Category>('categories', 'accountId', id);
    for (const c of cats) {
      await db.delete('categories', c.id);
      await addToSyncQueue('categories', 'delete', c.id, null);
    }

    const lbls = await db.getGroupedByIndex<any>('labels', 'accountId', id);
    for (const l of lbls) {
      await db.delete('labels', l.id);
      await addToSyncQueue('labels', 'delete', l.id, null);
    }

    processSyncQueue();

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
    const orderKey = 'accounts_order';
    const orderVal = newAccounts.map(a => a.id);
    await db.put('settings', { key: orderKey, value: orderVal });
    await addToSyncQueue('settings', 'upsert', orderKey, { key: orderKey, value: orderVal });
    processSyncQueue();
  }
});
