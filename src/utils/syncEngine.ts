import { db } from '../db';
import { supabase } from '../supabase';
import { Account, PaymentMethod, Category, Label, ExpenseGroup, ExpenseItem, Credit } from '../types';

export type SyncStatusListener = (isSyncing: boolean) => void;
const syncStatusListeners = new Set<SyncStatusListener>();

export const subscribeToSyncStatus = (listener: SyncStatusListener) => {
  syncStatusListeners.add(listener);
  return () => {
    syncStatusListeners.delete(listener);
  };
};

const notifySyncStatus = (isSyncing: boolean) => {
  syncStatusListeners.forEach(l => l(isSyncing));
};

export type SyncCompletionListener = () => void;
const syncCompletionListeners = new Set<SyncCompletionListener>();

export const subscribeToSyncCompletion = (listener: SyncCompletionListener) => {
  syncCompletionListeners.add(listener);
  return () => {
    syncCompletionListeners.delete(listener);
  };
};

const notifySyncCompletion = () => {
  syncCompletionListeners.forEach(l => l());
};

export interface SyncAction {
  id: string;
  table: 'accounts' | 'payment_methods' | 'categories' | 'labels' | 'settings' | 'expense_groups' | 'expense_items' | 'credits';
  action: 'upsert' | 'delete';
  recordId: string;
  payload: any;
  createdAt: number;
}

// Global flag to prevent concurrent queue processing runs
let isProcessing = false;

/**
 * Pushes a new write operation to the local offline sync queue.
 */
export const addToSyncQueue = async (
  table: 'accounts' | 'payment_methods' | 'categories' | 'labels' | 'settings' | 'expense_groups' | 'expense_items' | 'credits',
  action: 'upsert' | 'delete',
  recordId: string,
  payload: any
): Promise<void> => {
  const syncJob: SyncAction = {
    id: crypto.randomUUID(),
    table,
    action,
    recordId,
    payload,
    createdAt: Date.now(),
  };

  try {
    await db.put('sync_queue', syncJob);
    console.log(`[Sync Queue] Logged job: ${action} on ${table} (${recordId})`);
  } catch (err) {
    console.error('[Sync Queue] Failed to log write action:', err);
  }
};

/**
 * Replays all queued write actions to Supabase chronologically.
 */
export const processSyncQueue = async (): Promise<void> => {
  if (isProcessing) return;
  if (!navigator.onLine) {
    console.log('[Sync Queue] Device is offline. Postponing sync.');
    return;
  }

  try {
    isProcessing = true;
    notifySyncStatus(true);

    // Verify session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      console.log('[Sync Queue] User is not authenticated. Postponing sync.');
      isProcessing = false;
      return;
    }

    // Fetch all pending actions
    const queue = await db.getAll<SyncAction>('sync_queue');
    if (queue.length === 0) {
      isProcessing = false;
      return;
    }

    // Sort chronologically (oldest first)
    queue.sort((a, b) => a.createdAt - b.createdAt);

    console.log(`[Sync Queue] Replaying ${queue.length} pending actions...`);

    for (const job of queue) {
      let error = null;

      if (job.action === 'upsert') {
        let uploadPayload = job.payload;
        // Inject owner_id for user-associated tables
        if (job.table === 'accounts' || job.table === 'payment_methods' || job.table === 'settings') {
          uploadPayload = { ...uploadPayload, owner_id: session.user.id };
        } else if (job.table === 'categories') {
          // Map local camelCase to Supabase lowercase columns
          uploadPayload = {
            id: job.payload.id,
            accountId: job.payload.accountId,
            name: job.payload.name,
            icon: job.payload.icon,
            bgcolor: job.payload.bgColor,
            textcolor: job.payload.textColor
          };
        } else if (job.table === 'expense_groups') {
          // Map local camelCase to Supabase lowercase columns
          uploadPayload = {
            id: job.payload.id,
            accountId: job.payload.accountId,
            description: job.payload.description,
            date: job.payload.date,
            paymentmethod: job.payload.paymentMethod,
            labels: job.payload.labels,
            paidusers: job.payload.paidUsers,
            lat: job.payload.lat,
            lng: job.payload.lng,
            receiptimage: job.payload.receiptImage,
            share_token: job.payload.share_token,
            share_expires_at: job.payload.share_expires_at
          };
        } else if (job.table === 'expense_items') {
          // Map local camelCase to Supabase lowercase columns
          uploadPayload = {
            id: job.payload.id,
            groupId: job.payload.groupId,
            description: job.payload.description,
            amount: job.payload.amount,
            category: job.payload.category,
            splituser: job.payload.splitUser
          };
        } else if (job.table === 'credits') {
          // Map local camelCase to Supabase lowercase columns
          uploadPayload = {
            id: job.payload.id,
            account_id: job.payload.accountId,
            user_name: job.payload.userName,
            amount: job.payload.amount,
            description: job.payload.description,
            date: job.payload.date,
            owner_id: session.user.id
          };
        }

        const { error: upsertErr } = await supabase
          .from(job.table)
          .upsert(uploadPayload);
        error = upsertErr;

        if (!error && job.table === 'accounts') {
          try {
            const { data: existing } = await supabase
              .from('collaborators')
              .select('id')
              .eq('account_id', job.payload.id)
              .eq('user_id', session.user.id)
              .maybeSingle();

            if (!existing) {
              await supabase
                .from('collaborators')
                .insert({
                  id: crypto.randomUUID(),
                  account_id: job.payload.id,
                  user_id: session.user.id,
                  role: 'owner'
                });
            }
          } catch (colErr) {
            console.error('Failed to add owner collaborator during queue sync:', colErr);
          }
        }
      } else if (job.action === 'delete') {
        let query = supabase.from(job.table).delete();
        if (job.table === 'settings') {
          query = query.eq('owner_id', session.user.id).eq('key', job.recordId);
        } else {
          query = query.eq('id', job.recordId);
        }
        const { error: deleteErr } = await query;
        error = deleteErr;
      }

      if (error) {
        console.error(`[Sync Queue] Error replaying job ${job.id}:`, error);
        // Halt queue processing to preserve chronological dependency constraints
        break;
      } else {
        // Successfully processed. Remove from local queue.
        await db.delete('sync_queue', job.id);
        console.log(`[Sync Queue] Successfully replayed and cleared job ${job.id}`);
      }
    }
  } catch (err) {
    console.error('[Sync Queue] Error processing queue:', err);
  } finally {
    isProcessing = false;
    notifySyncStatus(false);
  }
};

/**
 * Pulls all user-associated data from Supabase and merges it into the local IndexedDB.
 */
export const pullUpdatesFromServer = async (forceFullReconciliation = false): Promise<void> => {
  if (!navigator.onLine) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  notifySyncStatus(true);
  try {
    // 1. Resolve last pull timestamp
    let lastPulledAt: string | null = null;
    if (!forceFullReconciliation) {
      const lastPulledRecord = await db.get<{ key: string, value: string }>('settings', `last_pulled_at_${session.user.id}`);
      if (lastPulledRecord) {
        lastPulledAt = lastPulledRecord.value;
      }
    }

    console.log(`[Sync Engine] Pulling updates from server. last_pulled_at: ${lastPulledAt || 'NONE (Full sync)'}`);

    // Helper for incremental query filtering
    const buildQuery = (tableName: string) => {
      let q = supabase.from(tableName).select('*');
      if (lastPulledAt) {
        q = q.gt('updated_at', lastPulledAt);
      }
      return q;
    };

    // Phase 1: Ingest Delta Changes (Parallel queries)
    const [
      { data: accounts },
      { data: payments },
      { data: categories },
      { data: labels },
      { data: settings },
      { data: groups },
      { data: items },
      { data: serverCredits }
    ] = await Promise.all([
      buildQuery('accounts'),
      buildQuery('payment_methods'),
      buildQuery('categories'),
      buildQuery('labels'),
      buildQuery('settings'),
      buildQuery('expense_groups'),
      buildQuery('expense_items'),
      buildQuery('credits')
    ]);

    const syncQueue = await db.getAll<SyncAction>('sync_queue');
    const pendingIds = new Set(syncQueue.map(q => q.recordId));

    // A. Ingest accounts
    if (accounts) {
      for (const acc of accounts) {
        await db.put('accounts', { id: acc.id, name: acc.name });
      }
    }

    // B. Ingest payment methods
    if (payments) {
      for (const pm of payments) {
        await db.put('payment_methods', { id: pm.id, name: pm.name });
      }
    }

    // C. Ingest categories
    if (categories) {
      for (const cat of categories) {
        await db.put('categories', {
          id: cat.id,
          accountId: cat.accountId,
          name: cat.name,
          icon: cat.icon,
          bgColor: cat.bgcolor,
          textColor: cat.textcolor
        });
      }
    }

    // D. Ingest labels
    if (labels) {
      for (const lbl of labels) {
        await db.put('labels', {
          id: lbl.id,
          accountId: lbl.accountId,
          name: lbl.name
        });
      }
    }

    // E. Ingest settings
    if (settings) {
      for (const s of settings) {
        await db.put('settings', {
          key: s.key,
          value: s.value
        });
      }
    }

    // F. Ingest expense groups
    if (groups) {
      for (const g of groups) {
        await db.put('expense_groups', {
          id: g.id,
          accountId: g.accountId,
          description: g.description,
          date: g.date,
          paymentMethod: g.paymentmethod,
          labels: g.labels || [],
          paidUsers: g.paidusers || [],
          lat: g.lat || undefined,
          lng: g.lng || undefined,
          receiptImage: g.receiptimage || undefined,
          share_token: g.share_token || undefined,
          share_expires_at: g.share_expires_at || undefined
        });
      }
    }

    // G. Ingest expense items
    if (items) {
      for (const item of items) {
        await db.put('expense_items', {
          id: item.id,
          groupId: item.groupId,
          description: item.description,
          amount: Number(item.amount),
          category: item.category,
          splitUser: item.splituser || undefined
        });
      }
    }

    // H. Ingest credits
    if (serverCredits) {
      for (const c of serverCredits) {
        await db.put('credits', {
          id: c.id,
          accountId: c.account_id,
          userName: c.user_name,
          amount: Number(c.amount),
          description: c.description,
          date: c.date
        });
      }
    }

    // Phase 2: ID-Only Deletion Audit (only if full sync requested)
    if (forceFullReconciliation) {
      console.log('[Sync Engine] Running full deletion audit cross-referencing server IDs...');
      const [
        { data: allAccs },
        { data: allPms },
        { data: allCats },
        { data: allLbls },
        { data: allSettings },
        { data: allGroups },
        { data: allItems },
        { data: allCreditsServer }
      ] = await Promise.all([
        supabase.from('accounts').select('id'),
        supabase.from('payment_methods').select('id'),
        supabase.from('categories').select('id'),
        supabase.from('labels').select('id'),
        supabase.from('settings').select('key'),
        supabase.from('expense_groups').select('id'),
        supabase.from('expense_items').select('id'),
        supabase.from('credits').select('id')
      ]);

      // Remove deleted accounts
      if (allAccs) {
        const serverIds = new Set(allAccs.map(a => a.id));
        const local = await db.getAll<Account>('accounts');
        for (const loc of local) {
          if (!serverIds.has(loc.id) && !pendingIds.has(loc.id)) {
            await db.delete('accounts', loc.id);
          }
        }
      }

      // Remove deleted payment methods
      if (allPms) {
        const serverIds = new Set(allPms.map(p => p.id));
        const local = await db.getAll<PaymentMethod>('payment_methods');
        for (const loc of local) {
          if (!serverIds.has(loc.id) && !pendingIds.has(loc.id)) {
            await db.delete('payment_methods', loc.id);
          }
        }
      }

      // Remove deleted categories
      if (allCats) {
        const serverIds = new Set(allCats.map(c => c.id));
        const local = await db.getAll<Category>('categories');
        for (const loc of local) {
          if (!serverIds.has(loc.id) && !pendingIds.has(loc.id)) {
            await db.delete('categories', loc.id);
          }
        }
      }

      // Remove deleted labels
      if (allLbls) {
        const serverIds = new Set(allLbls.map(l => l.id));
        const local = await db.getAll<Label>('labels');
        for (const loc of local) {
          if (!serverIds.has(loc.id) && !pendingIds.has(loc.id)) {
            await db.delete('labels', loc.id);
          }
        }
      }

      // Remove deleted settings (only user-scoped keys)
      if (allSettings) {
        const serverKeys = new Set(allSettings.map(s => s.key));
        const local = await db.getAll<{ key: string, value: any }>('settings');
        const keysToSync = new Set([
          'locationSuggestEnabled',
          'dashboardWidgets',
          'kkbQrs',
          'accounts_order',
          'categories_order',
          'payment_methods_order'
        ]);
        for (const loc of local) {
          if (keysToSync.has(loc.key) && !serverKeys.has(loc.key) && !pendingIds.has(loc.key)) {
            await db.delete('settings', loc.key);
          }
        }
      }

      // Remove deleted groups
      if (allGroups) {
        const serverIds = new Set(allGroups.map(g => g.id));
        const local = await db.getAll<ExpenseGroup>('expense_groups');
        for (const loc of local) {
          if (!serverIds.has(loc.id) && !pendingIds.has(loc.id)) {
            await db.delete('expense_groups', loc.id);
          }
        }
      }

      // Remove deleted items
      if (allItems) {
        const serverIds = new Set(allItems.map(i => i.id));
        const local = await db.getAll<ExpenseItem>('expense_items');
        for (const loc of local) {
          if (!serverIds.has(loc.id) && !pendingIds.has(loc.id)) {
            await db.delete('expense_items', loc.id);
          }
        }
      }

      // Remove deleted credits
      if (allCreditsServer) {
        const serverIds = new Set(allCreditsServer.map(c => c.id));
        const local = await db.getAll<Credit>('credits');
        for (const loc of local) {
          if (!serverIds.has(loc.id) && !pendingIds.has(loc.id)) {
            await db.delete('credits', loc.id);
          }
        }
      }
    }

    // Save sync completion metadata timestamp
    const nowIso = new Date().toISOString();
    await db.put('settings', { key: `last_pulled_at_${session.user.id}`, value: nowIso });

    console.log('[Sync Engine] Pull sync successfully completed and reconciled.');
    notifySyncCompletion();
  } catch (err) {
    console.error('[Sync Engine] Pull sync failed:', err);
    throw err;
  } finally {
    notifySyncStatus(false);
  }
};

/**
 * Runs a complete sync cycle: processes pending offline changes, then pulls updates.
 */
export const syncWorkspace = async (forceFull = false): Promise<void> => {
  await processSyncQueue();
  await pullUpdatesFromServer(forceFull);
};
