import { StateCreator } from 'zustand';
import { SettingsStore, CategoriesSlice } from './types';
import { db } from '../../../db';
import { sortItemsByIds } from '../utils/layoutLogic';
import { Category } from '../../../types';
import { addToSyncQueue, processSyncQueue } from '../../../utils/syncEngine';

export const createCategoriesSlice: StateCreator<
  SettingsStore,
  [],
  [],
  CategoriesSlice
> = (set, get) => ({
  categories: [],
  newCatIcon: '',
  newCatName: '',
  setNewCatIcon: (icon) => set({ newCatIcon: icon }),
  setNewCatName: (name) => set({ newCatName: name }),

  loadCategories: async (activeAccountId: string) => {
    const catList = await db.getGroupedByIndex<Category>('categories', 'accountId', activeAccountId);
    const categoriesOrder = await db.get<{ key: string; value: string[] }>('settings', 'categories_order');
    set({ categories: sortItemsByIds(catList, categoriesOrder ? categoriesOrder.value : null) });
  },

  handleAddCategory: async (activeAccountId: string) => {
    const { newCatName, newCatIcon } = get();
    if (!newCatName.trim() || !newCatIcon.trim()) {
      alert('Please fill out both Category Emoji and Title.');
      return;
    }
    
    // Pick random neon colors for the HSL highlights
    const hues = [0, 30, 140, 200, 260, 310];
    const pickedHue = hues[Math.floor(Math.random() * hues.length)];
    
    const newCat: Category = {
      id: crypto.randomUUID(),
      accountId: activeAccountId,
      name: newCatName.trim(),
      icon: newCatIcon.trim(),
      bgColor: `hsl(${pickedHue}, 90%, 94%)`,
      textColor: `hsl(${pickedHue}, 80%, 40%)`
    };

    await db.put('categories', newCat);
    await addToSyncQueue('categories', 'upsert', newCat.id, newCat);
    processSyncQueue();
    set({ newCatName: '', newCatIcon: '' });
    await get().loadCategories(activeAccountId);
  },

  confirmDeleteCategory: async () => {
    const { deleteTargetCategoryId, categories } = get();
    if (deleteTargetCategoryId) {
      await db.delete('categories', deleteTargetCategoryId);
      await addToSyncQueue('categories', 'delete', deleteTargetCategoryId, null);
      processSyncQueue();
      // Retrieve activeAccountId from categories state
      const sample = categories.find(c => c.id === deleteTargetCategoryId) || categories[0];
      const activeId = sample ? sample.accountId : '';
      
      set({ deleteTargetCategoryId: null });
      window.history.back(); // Pop state and clean up search params
      if (activeId) {
        await get().loadCategories(activeId); // Reload list
      }
    }
  },

  handleReorderCategories: async (newCategories: Category[]) => {
    set({ categories: newCategories });
    const orderKey = 'categories_order';
    const orderVal = newCategories.map(c => c.id);
    await db.put('settings', { key: orderKey, value: orderVal });
    await addToSyncQueue('settings', 'upsert', orderKey, { key: orderKey, value: orderVal });
    processSyncQueue();
  }
});
