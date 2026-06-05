import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  subscribeToSyncCompletion,
  pullUpdatesFromServer,
  syncWorkspace
} from '../syncEngine';

// Local store mock representing IndexedDB
const mockDb = {
  accounts: [] as any[],
  payment_methods: [] as any[],
  categories: [] as any[],
  labels: [] as any[],
  settings: [] as any[],
  expense_groups: [] as any[],
  expense_items: [] as any[],
  sync_queue: [] as any[]
};

// Mock IndexedDB
vi.mock('../../db', () => {
  return {
    db: {
      get: vi.fn(async (table, keyOrId) => {
        const list = mockDb[table as keyof typeof mockDb] || [];
        if (table === 'settings') {
          return list.find((item: any) => item.key === keyOrId) || null;
        }
        return list.find((item: any) => item.id === keyOrId) || null;
      }),
      put: vi.fn(async (table, item) => {
        const key = table as keyof typeof mockDb;
        if (!mockDb[key]) mockDb[key] = [];
        if (table === 'settings') {
          const index = mockDb[key].findIndex((i: any) => i.key === item.key);
          if (index > -1) mockDb[key][index] = item;
          else mockDb[key].push(item);
        } else {
          const index = mockDb[key].findIndex((i: any) => i.id === item.id);
          if (index > -1) mockDb[key][index] = item;
          else mockDb[key].push(item);
        }
      }),
      delete: vi.fn(async (table, keyOrId) => {
        const key = table as keyof typeof mockDb;
        if (mockDb[key]) {
          if (table === 'settings') {
            mockDb[key] = mockDb[key].filter((i: any) => i.key !== keyOrId);
          } else {
            mockDb[key] = mockDb[key].filter((i: any) => i.id !== keyOrId);
          }
        }
      }),
      getAll: vi.fn(async (table) => {
        return mockDb[table as keyof typeof mockDb] || [];
      })
    }
  };
});

// Mock Supabase responses
let mockSupabaseResponses = {
  accounts: [] as any[],
  payment_methods: [] as any[],
  categories: [] as any[],
  labels: [] as any[],
  settings: [] as any[],
  expense_groups: [] as any[],
  expense_items: [] as any[]
};

vi.mock('../../supabase', () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn(async () => {
          return { data: { session: { user: { id: 'test_user_id' } } } };
        })
      },
      from: vi.fn((table) => {
        const selectMock = {
          select: vi.fn((fields = '*') => {
            const dataList = mockSupabaseResponses[table as keyof typeof mockSupabaseResponses] || [];
            
            // Map return values based on fields requested (e.g. ID-only audits vs full objects)
            const resultData = dataList.map(item => {
              if (fields === 'id') return { id: item.id };
              if (fields === 'key') return { key: item.key };
              return item;
            });

            const queryChain = {
              gt: vi.fn((col, val) => Promise.resolve({ data: resultData, error: null })),
              eq: vi.fn((col, val) => Promise.resolve({ data: resultData, error: null })),
              then: vi.fn((cb) => cb({ data: resultData, error: null }))
            };

            // Support direct promise returns or chained filters
            Object.assign(queryChain, Promise.resolve({ data: resultData, error: null }));
            return queryChain;
          })
        };
        return selectMock;
      })
    }
  };
});

describe('Sync Engine - Bidirectional Pull and Sync', () => {
  beforeEach(() => {
    // Reset databases
    for (const key of Object.keys(mockDb)) {
      mockDb[key as keyof typeof mockDb] = [];
    }

    for (const key of Object.keys(mockSupabaseResponses)) {
      mockSupabaseResponses[key as keyof typeof mockSupabaseResponses] = [];
    }

    vi.clearAllMocks();
  });

  describe('Sync Completion Notifications', () => {
    it('should notify subscribers when pull synchronization finishes successfully', async () => {
      let callbackTriggered = false;
      const unsubscribe = subscribeToSyncCompletion(() => {
        callbackTriggered = true;
      });

      // Set online status
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

      await pullUpdatesFromServer();
      expect(callbackTriggered).toBe(true);

      unsubscribe();
    });
  });

  describe('Delta Pull logic', () => {
    it('should query Supabase using the GT filter if last_pulled_at exists', async () => {
      // Seed last pulled setting
      mockDb.settings.push({ key: 'last_pulled_at_test_user_id', value: '2026-06-04T12:00:00.000Z' });

      // Add a server-side category
      mockSupabaseResponses.categories.push({
        id: 'cat_server_123',
        accountId: 'acc_1',
        name: 'Server Food',
        icon: '🍱',
        bgcolor: '#000',
        textcolor: '#fff',
        updated_at: '2026-06-04T13:00:00.000Z'
      });

      await pullUpdatesFromServer();

      // Verify it was saved locally in IndexedDB (and mapped from snake_case bgcolor to camelCase bgColor)
      expect(mockDb.categories.length).toBe(1);
      expect(mockDb.categories[0].id).toBe('cat_server_123');
      expect(mockDb.categories[0].bgColor).toBe('#000');
    });
  });

  describe('ID-Only Deletion Audits', () => {
    it('should delete local records that do not exist on the server when forceFullReconciliation is true', async () => {
      // Seed local label
      mockDb.labels.push({ id: 'lbl_local_deleted', accountId: 'acc_1', name: 'Deleted on Server' });
      mockDb.labels.push({ id: 'lbl_local_active', accountId: 'acc_1', name: 'Active on Server' });

      // Only one label remains on the server
      mockSupabaseResponses.labels.push({ id: 'lbl_local_active', accountId: 'acc_1', name: 'Active on Server' });

      // Pull sync with full reconciliation deletion check enabled
      await pullUpdatesFromServer(true);

      // Verify the local label deleted on the server was removed, but the active one remains
      const ids = mockDb.labels.map(l => l.id);
      expect(ids).not.toContain('lbl_local_deleted');
      expect(ids).toContain('lbl_local_active');
    });

    it('should NOT delete local records that are pending in the offline sync queue', async () => {
      // Seed local label awaiting upload in the offline queue
      mockDb.labels.push({ id: 'lbl_new_offline', accountId: 'acc_1', name: 'Awaiting Upload' });
      mockDb.sync_queue.push({
        id: 'job_123',
        table: 'labels',
        action: 'upsert',
        recordId: 'lbl_new_offline',
        payload: {},
        createdAt: Date.now()
      });

      // No labels on the server
      mockSupabaseResponses.labels = [];

      // Run full reconciliation
      await pullUpdatesFromServer(true);

      // The label should still be preserved locally since its upload is pending
      const ids = mockDb.labels.map(l => l.id);
      expect(ids).toContain('lbl_new_offline');
    });
  });
});
