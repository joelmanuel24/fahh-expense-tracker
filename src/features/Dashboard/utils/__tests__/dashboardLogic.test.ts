import { describe, it, expect } from 'vitest';
import { calculateKKBSplit, formatKKBShare, shouldIncludeItemInAccount, calculateOweTotals, calculateOweBreakdown } from '../dashboardLogic';
import { ExpenseGroup, ExpenseItem, Credit } from '../../../../types';

describe('dashboardLogic', () => {
  describe('calculateKKBSplit', () => {
    it('should detect KKB split correctly', () => {
      const items = [
        { splitUser: 'Alice', amount: 50 },
        { splitUser: 'Me', amount: 30 }
      ];
      const result = calculateKKBSplit(items);
      expect(result.hasKKBSplit).toBe(true);
      expect(result.myShare).toBe(30);
      expect(result.total).toBe(80);
    });

    it('should identify non-KKB split groups', () => {
      const items = [
        { amount: 100 },
        { splitUser: '', amount: 50 }
      ];
      const result = calculateKKBSplit(items);
      expect(result.hasKKBSplit).toBe(false);
      expect(result.myShare).toBe(0);
      expect(result.total).toBe(150);
    });
  });

  describe('formatKKBShare', () => {
    it('should format whole number share as integer', () => {
      expect(formatKKBShare(25, 126)).toBe('PHP 25/126.00');
    });

    it('should format decimal share with two decimals', () => {
      expect(formatKKBShare(25.5, 126)).toBe('PHP 25.50/126.00');
    });
  });

  describe('shouldIncludeItemInAccount', () => {
    it('should include all items when KKB split is not active', () => {
      expect(shouldIncludeItemInAccount({ splitUser: 'Alice' }, false)).toBe(true);
      expect(shouldIncludeItemInAccount({ splitUser: 'Me' }, false)).toBe(true);
    });

    it('should include only Me assignees when KKB split is active', () => {
      expect(shouldIncludeItemInAccount({ splitUser: 'Alice' }, true)).toBe(false);
      expect(shouldIncludeItemInAccount({ splitUser: 'Me' }, true)).toBe(true);
      expect(shouldIncludeItemInAccount({ splitUser: 'ME ' }, true)).toBe(true); // case-insensitive, trimmed
    });
  });

  describe('calculateOweTotals', () => {
    it('should compute owed totals excluding paid users, me, and unassigned items, and subtract credits', () => {
      const groups: ExpenseGroup[] = [
        { id: 'g1', accountId: 'acc1', description: 'Mcdo', date: '2026-06-01', paymentMethod: 'Cash', labels: [], paidUsers: ['Bob'] },
        { id: 'g2', accountId: 'acc1', description: 'Uber', date: '2026-06-02', paymentMethod: 'Card', labels: [] }
      ];

      const items: ExpenseItem[] = [
        { id: 'i1', groupId: 'g1', description: 'Burger', amount: 70, category: 'Food', splitUser: 'Alice' }, // unpaid, owed 70
        { id: 'i2', groupId: 'g1', description: 'Fries', amount: 30, category: 'Food', splitUser: 'Bob' },   // paid, ignored
        { id: 'i3', groupId: 'g1', description: 'Drinks', amount: 20, category: 'Food', splitUser: 'Me' },  // Me, ignored
        { id: 'i4', groupId: 'g2', description: 'Ride', amount: 120, category: 'Transpo', splitUser: 'Alice' }, // unpaid, owed 120
        { id: 'i5', groupId: 'g2', description: 'Tip', amount: 30, category: 'Transpo', splitUser: 'Unassigned' } // Unassigned, ignored
      ];

      const credits: Credit[] = [
        { id: 'cr1', accountId: 'acc1', userName: 'Alice', amount: 50, description: 'GCash', date: '2026-06-03' }
      ];

      // Alice should owe 190 gross - 50 credit = 140 net.
      const oweSummaries = calculateOweTotals(groups, items, credits);

      expect(oweSummaries.length).toBe(1);
      expect(oweSummaries[0].userName).toBe('Alice');
      expect(oweSummaries[0].amount).toBe(140);
    });

    it('should filter out users who have settled their debts completely (net owed <= 0)', () => {
      const groups: ExpenseGroup[] = [
        { id: 'g1', accountId: 'acc1', description: 'Mcdo', date: '2026-06-01', paymentMethod: 'Cash', labels: [] }
      ];
      const items: ExpenseItem[] = [
        { id: 'i1', groupId: 'g1', description: 'Burger', amount: 70, category: 'Food', splitUser: 'Alice' }
      ];
      const credits: Credit[] = [
        { id: 'cr1', accountId: 'acc1', userName: 'Alice', amount: 80, description: 'GCash', date: '2026-06-03' }
      ];

      // Alice net owed is 70 - 80 = -10 (settled), so filtered out of oweTotals
      const oweSummaries = calculateOweTotals(groups, items, credits);
      expect(oweSummaries.length).toBe(0);
    });
  });

  describe('calculateOweBreakdown', () => {
    it('should compute itemized breakdowns, subtract credits, and keep debtors in list if they have gross splits', () => {
      const groups: ExpenseGroup[] = [
        { id: 'g1', accountId: 'acc1', description: 'Mcdo', date: '2026-06-01', paymentMethod: 'Cash', labels: [], paidUsers: ['Bob'] },
        { id: 'g2', accountId: 'acc1', description: 'Uber', date: '2026-06-02', paymentMethod: 'Card', labels: [] }
      ];

      const items: ExpenseItem[] = [
        { id: 'i1', groupId: 'g1', description: 'Burger', amount: 70, category: 'Food', splitUser: 'Alice' }, // unpaid, owed 70
        { id: 'i2', groupId: 'g1', description: 'Fries', amount: 30, category: 'Food', splitUser: 'Bob' },   // paid, ignored
        { id: 'i3', groupId: 'g1', description: 'Drinks', amount: 20, category: 'Food', splitUser: 'Me' },  // Me, ignored
        { id: 'i4', groupId: 'g2', description: 'Ride', amount: 120, category: 'Transpo', splitUser: 'Alice' }, // unpaid, owed 120
        { id: 'i5', groupId: 'g2', description: 'Tip', amount: 30, category: 'Transpo', splitUser: 'Unassigned' } // Unassigned, ignored
      ];

      const credits: Credit[] = [
        { id: 'cr1', accountId: 'acc1', userName: 'Alice', amount: 190, description: 'Settle All', date: '2026-06-03' }
      ];

      // Alice net total is 190 - 190 = 0 (settled).
      // But she remains in breakdown list because she has gross outstanding splits, so the user can see/manage the settle credit.
      const breakdown = calculateOweBreakdown(groups, items, credits);

      expect(breakdown.length).toBe(1);
      expect(breakdown[0].userName).toBe('Alice');
      expect(breakdown[0].totalAmount).toBe(0); // settled net total
      expect(breakdown[0].items.length).toBe(2); // gross items are still there

      // Verify item details, sorted by date descending (g2 is newer than g1)
      expect(breakdown[0].items[0].groupDescription).toBe('Uber');
      expect(breakdown[0].items[0].itemDescription).toBe('Ride');
      expect(breakdown[0].items[0].amount).toBe(120);
      expect(breakdown[0].items[0].date).toBe('2026-06-02');

      expect(breakdown[0].items[1].groupDescription).toBe('Mcdo');
      expect(breakdown[0].items[1].itemDescription).toBe('Burger');
      expect(breakdown[0].items[1].amount).toBe(70);
      expect(breakdown[0].items[1].date).toBe('2026-06-01');
    });
  });
});
