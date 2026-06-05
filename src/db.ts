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
  },
  3: (_db, _transaction) => {
    // Migration v3: Reconcile database version from previous session tests
    console.log('IndexedDB database schema successfully migrated to v3!');
  },
  4: (db) => {
    if (!db.objectStoreNames.contains('sync_queue')) {
      db.createObjectStore('sync_queue', { keyPath: 'id' });
    }
    console.log('IndexedDB database schema successfully migrated to v4!');
  },
  5: (db) => {
    if (!db.objectStoreNames.contains('credits')) {
      const store = db.createObjectStore('credits', { keyPath: 'id' });
      store.createIndex('accountId', 'accountId', { unique: false });
    }
    console.log('IndexedDB database schema successfully migrated to v5!');
  }
};

class StrongDB {
  private dbName = 'FahhExpenseTracker';
  private dbVersion = 5;
  private db: IDBDatabase | null = null;
  private seedPromise: Promise<string> | null = null;

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
  public seedDefaultDatabase(): Promise<string> {
    if (this.seedPromise) return this.seedPromise;

    this.seedPromise = (async () => {
      await this.init();

      // Migrator check for legacy database IDs
      const currentAccounts = await this.getAll<Account>('accounts');
      const hasLegacyIds = currentAccounts.some(acc => acc.id.startsWith('acc_'));
      if (hasLegacyIds) {
        await this.migrateLegacyIdsToUuids();
      }

      // 1. Seed default personal account if none exists
      const accounts = await this.getAll<Account>('accounts');
      let activeId = '';
      if (accounts.length === 0) {
        activeId = crypto.randomUUID();
        const defaultAccount: Account = { id: activeId, name: 'Personal' };
        await this.put('accounts', defaultAccount);
        await this.put('settings', { key: 'activeAccountId', value: activeId });

        // 2. Seed Default Global Payment Methods
        const defaultPayments: PaymentMethod[] = [
          { id: crypto.randomUUID(), name: 'Cash' },
          { id: crypto.randomUUID(), name: 'Card' },
          { id: crypto.randomUUID(), name: 'GCash' },
          { id: crypto.randomUUID(), name: 'Maya' }
        ];
        for (const pm of defaultPayments) {
          await this.put('payment_methods', pm);
        }

        // 3. Seed Scoped Categories
        const defaultCategories: Category[] = [
          { id: crypto.randomUUID(), accountId: activeId, name: 'Food', icon: '🍔', bgColor: '#ffe4e6', textColor: '#e11d48' },
          { id: crypto.randomUUID(), accountId: activeId, name: 'Transpo', icon: '🚌', bgColor: '#e0f2fe', textColor: '#0284c7' },
          { id: crypto.randomUUID(), accountId: activeId, name: 'Utilities', icon: '💡', bgColor: '#fef3c7', textColor: '#d97706' },
          { id: crypto.randomUUID(), accountId: activeId, name: 'Leisure', icon: '🎬', bgColor: '#fae8ff', textColor: '#a21caf' },
          { id: crypto.randomUUID(), accountId: activeId, name: 'Shopping', icon: '🛒', bgColor: '#dbeafe', textColor: '#1d4ed8' },
          { id: crypto.randomUUID(), accountId: activeId, name: 'Others', icon: '🧾', bgColor: '#f3e8ff', textColor: '#7c3aed' }
        ];
        for (const cat of defaultCategories) {
          await this.put('categories', cat);
        }

        // 4. Seed Scoped Labels
        const defaultLabels: Label[] = [
          { id: crypto.randomUUID(), accountId: activeId, name: 'Food' },
          { id: crypto.randomUUID(), accountId: activeId, name: 'Travel' },
          { id: crypto.randomUUID(), accountId: activeId, name: 'Bills' },
          { id: crypto.randomUUID(), accountId: activeId, name: 'Groceries' }
        ];
        for (const lbl of defaultLabels) {
          await this.put('labels', lbl);
        }

        // 5. Seed default Sample Transaction ("Mcdo Split Bill")
        const sampleGroupId = crypto.randomUUID();
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
          { id: crypto.randomUUID(), groupId: sampleGroupId, description: 'Burger', amount: 70.00, category: 'Food', splitUser: 'Alice' },
          { id: crypto.randomUUID(), groupId: sampleGroupId, description: 'Fries', amount: 31.00, category: 'Food', splitUser: 'Bob' },
          { id: crypto.randomUUID(), groupId: sampleGroupId, description: 'Soda', amount: 25.00, category: 'Food', splitUser: 'Me' }
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

      // 7. Ensure dashboardWidgets are up-to-date and have all 5 widgets (Self-Healing Migration)
      try {
        const widgetsRecord = await db.get<{ key: string; value: any[] }>('settings', 'dashboardWidgets');
        const defaultWidgets = [
          { id: 'total_expenses', name: 'Total Expenses', visible: true },
          { id: 'owe_totals', name: 'Owed Balances', visible: true },
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
    })();

    return this.seedPromise;
  }

  public async migrateLegacyIdsToUuids(): Promise<void> {
    // 1. Load all records from IndexedDB
    const accounts = await this.getAll<any>('accounts');
    const groups = await this.getAll<any>('expense_groups');
    const items = await this.getAll<any>('expense_items');
    const categories = await this.getAll<any>('categories');
    const labels = await this.getAll<any>('labels');
    const payments = await this.getAll<any>('payment_methods');
    const settings = await this.getAll<any>('settings');

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isUUID = (str: string) => uuidRegex.test(str);

    // Mappings of old IDs to new UUIDs
    const accountMap = new Map<string, string>();
    const paymentMap = new Map<string, string>();
    const groupMap = new Map<string, string>();
    const catMap = new Map<string, string>();
    const lblMap = new Map<string, string>();

    // Helper to generate UUID or return if already valid
    const getOrGenUuid = (id: string, map: Map<string, string>, fallbackUuid?: string): string => {
      if (isUUID(id)) return id;
      if (map.has(id)) return map.get(id)!;
      const newUuid = fallbackUuid || crypto.randomUUID();
      map.set(id, newUuid);
      return newUuid;
    };

    // --- 2. Build Account & Payment mappings ---
    for (const acc of accounts) {
      let fallback: string | undefined;
      if (acc.id === 'acc_personal') fallback = '00000000-0000-0000-0000-000000000001';
      getOrGenUuid(acc.id, accountMap, fallback);
    }
    for (const pm of payments) {
      let fallback: string | undefined;
      if (pm.id === 'pm_cash') fallback = '10000000-0000-0000-0000-000000000001';
      else if (pm.id === 'pm_card') fallback = '10000000-0000-0000-0000-000000000002';
      else if (pm.id === 'pm_gcash') fallback = '10000000-0000-0000-0000-000000000003';
      else if (pm.id === 'pm_maya') fallback = '10000000-0000-0000-0000-000000000004';
      getOrGenUuid(pm.id, paymentMap, fallback);
    }

    // --- 3. Migrate Accounts ---
    for (const acc of accounts) {
      const oldId = acc.id;
      if (!isUUID(oldId)) {
        const newId = accountMap.get(oldId)!;
        await this.delete('accounts', oldId);
        await this.put('accounts', { ...acc, id: newId });
      }
    }

    // --- 4. Migrate Payments ---
    for (const pm of payments) {
      const oldId = pm.id;
      if (!isUUID(oldId)) {
        const newId = paymentMap.get(oldId)!;
        await this.delete('payment_methods', oldId);
        await this.put('payment_methods', { ...pm, id: newId });
      }
    }

    // --- 5. Migrate Categories ---
    for (const cat of categories) {
      const oldId = cat.id;
      const oldAccountId = cat.accountId;
      const newAccountId = getOrGenUuid(oldAccountId, accountMap);
      
      let fallback: string | undefined;
      if (oldId === 'cat_food') fallback = '20000000-0000-0000-0000-000000000001';
      else if (oldId === 'cat_transpo') fallback = '20000000-0000-0000-0000-000000000002';
      else if (oldId === 'cat_utilities') fallback = '20000000-0000-0000-0000-000000000003';
      else if (oldId === 'cat_leisure') fallback = '20000000-0000-0000-0000-000000000004';
      else if (oldId === 'cat_shopping') fallback = '20000000-0000-0000-0000-000000000005';
      else if (oldId === 'cat_others') fallback = '20000000-0000-0000-0000-000000000006';
      
      const newId = getOrGenUuid(oldId, catMap, fallback);
      
      if (!isUUID(oldId) || oldAccountId !== newAccountId) {
        await this.delete('categories', oldId);
        await this.put('categories', { ...cat, id: newId, accountId: newAccountId });
      }
    }

    // --- 6. Migrate Labels ---
    for (const lbl of labels) {
      const oldId = lbl.id;
      const oldAccountId = lbl.accountId;
      const newAccountId = getOrGenUuid(oldAccountId, accountMap);
      
      let fallback: string | undefined;
      if (oldId === 'lbl_food') fallback = '30000000-0000-0000-0000-000000000001';
      else if (oldId === 'lbl_travel') fallback = '30000000-0000-0000-0000-000000000002';
      else if (oldId === 'lbl_bills') fallback = '30000000-0000-0000-0000-000000000003';
      else if (oldId === 'lbl_groceries') fallback = '30000000-0000-0000-0000-000000000004';
      
      const newId = getOrGenUuid(oldId, lblMap, fallback);
      
      if (!isUUID(oldId) || oldAccountId !== newAccountId) {
        await this.delete('labels', oldId);
        await this.put('labels', { ...lbl, id: newId, accountId: newAccountId });
      }
    }

    // --- 7. Migrate Groups & Items ---
    for (const g of groups) {
      const oldId = g.id;
      const oldAccountId = g.accountId;
      const newAccountId = getOrGenUuid(oldAccountId, accountMap);
      
      let fallback: string | undefined;
      if (oldId === 'grp_sample_mcdo') fallback = '40000000-0000-0000-0000-000000000001';
      const newGroupId = getOrGenUuid(oldId, groupMap, fallback);

      // Re-map paymentMethod if it was pm_cash or pm_card format
      let pmMethod = g.paymentMethod;
      if (paymentMap.has(pmMethod)) {
        pmMethod = paymentMap.get(pmMethod)!;
      }

      if (!isUUID(oldId) || oldAccountId !== newAccountId || g.paymentMethod !== pmMethod) {
        await this.delete('expense_groups', oldId);
        await this.put('expense_groups', { 
          ...g, 
          id: newGroupId, 
          accountId: newAccountId,
          paymentMethod: pmMethod
        });
      }
    }

    for (const item of items) {
      const oldId = item.id;
      const oldGroupId = item.groupId;
      const newGroupId = getOrGenUuid(oldGroupId, groupMap);
      
      let fallback: string | undefined;
      if (oldId === 'item_sample_1') fallback = '50000000-0000-0000-0000-000000000001';
      else if (oldId === 'item_sample_2') fallback = '50000000-0000-0000-0000-000000000002';
      else if (oldId === 'item_sample_3') fallback = '50000000-0000-0000-0000-000000000003';
      
      const newId = crypto.randomUUID(); // items don't need persistent mapped values as they have no children
      
      if (!isUUID(oldId) || oldGroupId !== newGroupId) {
        await this.delete('expense_items', oldId);
        await this.put('expense_items', { ...item, id: fallback || newId, groupId: newGroupId });
      }
    }

    // --- 8. Migrate Settings ---
    for (const set of settings) {
      if (set.key === 'activeAccountId') {
        const val = set.value;
        if (accountMap.has(val)) {
          await this.put('settings', { key: 'activeAccountId', value: accountMap.get(val)! });
        }
      }
      else if (set.key === 'accounts_order') {
        const order = set.value;
        if (Array.isArray(order)) {
          const newOrder = order.map(id => accountMap.get(id) || id);
          await this.put('settings', { key: 'accounts_order', value: newOrder });
        }
      }
      else if (set.key === 'categories_order') {
        const order = set.value;
        if (Array.isArray(order)) {
          const newOrder = order.map(id => catMap.get(id) || id);
          await this.put('settings', { key: 'categories_order', value: newOrder });
        }
      }
      else if (set.key === 'payment_methods_order') {
        const order = set.value;
        if (Array.isArray(order)) {
          const newOrder = order.map(id => paymentMap.get(id) || id);
          await this.put('settings', { key: 'payment_methods_order', value: newOrder });
        }
      }
      else if (set.key === 'kkbQrs') {
        const qrs = set.value;
        if (Array.isArray(qrs)) {
          const newQrs = qrs.map(qr => ({
            ...qr,
            id: isUUID(qr.id) ? qr.id : crypto.randomUUID()
          }));
          await this.put('settings', { key: 'kkbQrs', value: newQrs });
        }
      }
    }
    console.log('Legacy IndexedDB IDs successfully migrated to UUIDs.');
  }
}

export const db = new StrongDB();
