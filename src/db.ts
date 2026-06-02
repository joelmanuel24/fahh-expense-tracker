import { Account, ExpenseGroup, ExpenseItem, Category, Label, PaymentMethod } from './types';

export type MigrationFn = (db: IDBDatabase, transaction: IDBTransaction) => void;

export const migrations: Record<number, MigrationFn> = {
  1: (db) => {
    if (!db.objectStoreNames.contains('accounts')) {
      db.createObjectStore('accounts', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('expense_groups')) {
      const store = db.createObjectStore('expense_groups', { keyPath: 'id' });
      store.createIndex('accountId', 'accountId', { unique: false });
    }
    if (!db.objectStoreNames.contains('expense_items')) {
      const store = db.createObjectStore('expense_items', { keyPath: 'id' });
      store.createIndex('groupId', 'groupId', { unique: false });
    }
    if (!db.objectStoreNames.contains('categories')) {
      const store = db.createObjectStore('categories', { keyPath: 'id' });
      store.createIndex('accountId', 'accountId', { unique: false });
    }
    if (!db.objectStoreNames.contains('labels')) {
      const store = db.createObjectStore('labels', { keyPath: 'id' });
      store.createIndex('accountId', 'accountId', { unique: false });
    }
    if (!db.objectStoreNames.contains('payment_methods')) {
      db.createObjectStore('payment_methods', { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains('settings')) {
      db.createObjectStore('settings', { keyPath: 'key' });
    }
  },
  2: (_db, _transaction) => {
    // Migration v2: Sample schema migration logic.
    // This automatically runs for existing users upgrading to v2.
    console.log('IndexedDB database schema successfully migrated to v2!');
  }
};

class StrongDB {
  private dbName = 'FahhExpenseTracker';
  private dbVersion = 2;
  private db: IDBDatabase | null = null;

  public init(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (this.db) return resolve(this.db);

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = request.result;
        const transaction = request.transaction!;
        const oldVersion = event.oldVersion;
        const newVersion = event.newVersion || this.dbVersion;

        console.log(`IndexedDB Upgrade Needed: from v${oldVersion} to v${newVersion}`);

        for (let v = oldVersion + 1; v <= newVersion; v++) {
          if (migrations[v]) {
            console.log(`Running database migration to v${v}...`);
            migrations[v](db, transaction);
          }
        }
      };
    });
  }

  private getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    return this.init().then((db) => {
      const transaction = db.transaction(storeName, mode);
      return transaction.objectStore(storeName);
    });
  }

  public get<T>(storeName: string, key: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      this.getStore(storeName).then((store) => {
        const request = store.get(key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || null);
      }).catch(reject);
    });
  }

  public getAll<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.getStore(storeName).then((store) => {
        const request = store.getAll();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || []);
      }).catch(reject);
    });
  }

  public getGroupedByIndex<T>(storeName: string, indexName: string, value: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.getStore(storeName).then((store) => {
        const index = store.index(indexName);
        const request = index.getAll(value);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || []);
      }).catch(reject);
    });
  }

  public put<T>(storeName: string, data: T): Promise<void> {
    return new Promise((resolve, reject) => {
      this.getStore(storeName, 'readwrite').then((store) => {
        const request = store.put(data);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      }).catch(reject);
    });
  }

  public delete(storeName: string, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.getStore(storeName, 'readwrite').then((store) => {
        const request = store.delete(key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      }).catch(reject);
    });
  }

  // Cascading deletes - Deletes a group and all its corresponding items
  public async deleteExpenseGroup(groupId: string): Promise<void> {
    await this.delete('expense_groups', groupId);
    const items = await this.getGroupedByIndex<ExpenseItem>('expense_items', 'groupId', groupId);
    for (const item of items) {
      await this.delete('expense_items', item.id);
    }
  }

  // Strong helper to seed all default data if database is empty
  public async seedDefaultDatabase(): Promise<string> {
    await this.init();

    // 1. Seed default personal account if none exists
    const accounts = await this.getAll<Account>('accounts');
    let activeId = '';

    if (accounts.length === 0) {
      activeId = 'acc_personal';
      const defaultAccount: Account = { id: activeId, name: 'Personal Account' };
      await this.put('accounts', defaultAccount);
      await this.put('settings', { key: 'activeAccountId', value: activeId });

      // 2. Seed Default Global Payment Methods
      const defaultPayments: PaymentMethod[] = [
        { id: 'pm_cash', name: 'Cash' },
        { id: 'pm_card', name: 'Card' },
        { id: 'pm_gcash', name: 'GCash' },
        { id: 'pm_maya', name: 'Maya' }
      ];
      for (const pm of defaultPayments) {
        await this.put('payment_methods', pm);
      }

      // 3. Seed Scoped Categories
      const defaultCategories: Category[] = [
        { id: 'cat_food', accountId: activeId, name: 'Food', icon: '🍔', bgColor: '#ffe4e6', textColor: '#e11d48' },
        { id: 'cat_transpo', accountId: activeId, name: 'Transpo', icon: '🚌', bgColor: '#e0f2fe', textColor: '#0284c7' },
        { id: 'cat_utilities', accountId: activeId, name: 'Utilities', icon: '💡', bgColor: '#fef3c7', textColor: '#d97706' },
        { id: 'cat_leisure', accountId: activeId, name: 'Leisure', icon: '🎬', bgColor: '#fae8ff', textColor: '#a21caf' },
        { id: 'cat_shopping', accountId: activeId, name: 'Shopping', icon: '🛒', bgColor: '#dbeafe', textColor: '#1d4ed8' },
        { id: 'cat_others', accountId: activeId, name: 'Others', icon: '🧾', bgColor: '#f3e8ff', textColor: '#7c3aed' }
      ];
      for (const cat of defaultCategories) {
        await this.put('categories', cat);
      }

      // 4. Seed Scoped Labels
      const defaultLabels: Label[] = [
        { id: 'lbl_food', accountId: activeId, name: 'Food' },
        { id: 'lbl_travel', accountId: activeId, name: 'Travel' },
        { id: 'lbl_bills', accountId: activeId, name: 'Bills' },
        { id: 'lbl_groceries', accountId: activeId, name: 'Groceries' }
      ];
      for (const lbl of defaultLabels) {
        await this.put('labels', lbl);
      }

      // 5. Seed default Sample Transaction ("Mcdo Split Bill")
      const sampleGroupId = 'grp_sample_mcdo';
      const sampleGroup: ExpenseGroup = {
        id: sampleGroupId,
        accountId: activeId,
        description: 'Mcdo',
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'Cash',
        labels: ['Food'],
        paidUsers: ['Bob'], // Seed Bob as already paid his split
        lat: 14.4445,       // Seed default latitude
        lng: 121.0021       // Seed default longitude
      };
      await this.put('expense_groups', sampleGroup);

      const sampleItems: ExpenseItem[] = [
        { id: 'item_sample_1', groupId: sampleGroupId, description: 'Burger', amount: 70.00, category: 'Food', splitUser: 'Alice' },
        { id: 'item_sample_2', groupId: sampleGroupId, description: 'Fries', amount: 31.00, category: 'Food', splitUser: 'Bob' },
        { id: 'item_sample_3', groupId: sampleGroupId, description: 'Soda', amount: 25.00, category: 'Food', splitUser: 'Me' }
      ];
      for (const item of sampleItems) {
        await this.put('expense_items', item);
      }

      // 6. Set initial default settings keys
      await this.put('settings', { key: 'locationSuggestEnabled', value: false });
      await this.put('settings', { key: 'kkbQrs', value: [] });
    } else {
      const activeRecord = await this.get<{ key: string, value: string }>('settings', 'activeAccountId');
      activeId = activeRecord ? activeRecord.value : accounts[0].id;
    }

    // 7. Ensure dashboardWidgets are up-to-date and have all 4 widgets (Self-Healing Migration)
    try {
      const widgetsRecord = await this.get<{ key: string; value: any[] }>('settings', 'dashboardWidgets');
      const defaultWidgets = [
        { id: 'total_expenses', name: 'Total Expenses', visible: true },
        { id: 'categories', name: 'Category List', visible: true },
        { id: 'category_grid', name: 'Category Grid', visible: true },
        { id: 'recent_expenses', name: 'Recent Expenses', visible: true }
      ];

      if (widgetsRecord && widgetsRecord.value && Array.isArray(widgetsRecord.value)) {
        const savedList = widgetsRecord.value;
        const missing = defaultWidgets.filter(dw => !savedList.some(sw => sw.id === dw.id));
        if (missing.length > 0) {
          const updated = [...savedList, ...missing];
          await this.put('settings', { key: 'dashboardWidgets', value: updated });
        }
      } else {
        await this.put('settings', { key: 'dashboardWidgets', value: defaultWidgets });
      }
    } catch (e) {
      console.warn('Failed to migrate dashboard widgets:', e);
    }

    return activeId;
  }
}

export const db = new StrongDB();
