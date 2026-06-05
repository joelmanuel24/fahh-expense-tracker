import { ExpenseGroup, ExpenseItem, Credit } from '../../../types';

/**
 * Pure KKB split calculation, user-share tracking, and decimal ratio formatting business logic.
 */

export interface KKBResult {
  hasKKBSplit: boolean;
  myShare: number;
  total: number;
}

/**
 * Calculates whether a transaction group contains KKB assignments, computes Me's share sum, and total amount.
 */
export const calculateKKBSplit = (
  items: { splitUser?: string; amount: number }[]
): KKBResult => {
  const hasKKBSplit = items.some(i => i.splitUser && i.splitUser.trim() !== '');
  const myShare = items
    .filter(i => i.splitUser && i.splitUser.trim().toLowerCase() === 'me')
    .reduce((sum, curr) => sum + curr.amount, 0);
  const total = items.reduce((sum, curr) => sum + curr.amount, 0);
  return { hasKKBSplit, myShare, total };
};

/**
 * Formats my share / total share ratio cleanly as whole numbers or exact two-decimal floats.
 */
export const formatKKBShare = (myShare: number, total: number): string => {
  const formattedShare = myShare % 1 === 0 ? myShare.toFixed(0) : myShare.toFixed(2);
  const formattedTotal = total.toFixed(2);
  return `PHP ${formattedShare}/${formattedTotal}`;
};

/**
 * Checks whether an item should be included in Me's total account balance calculation.
 */
export const shouldIncludeItemInAccount = (
  item: { splitUser?: string },
  hasSplits: boolean
): boolean => {
  if (!hasSplits) return true;
  return item.splitUser?.trim().toLowerCase() === 'me';
};

export interface OweSummary {
  userName: string;
  amount: number;
}

/**
 * Calculates all outstanding debts owed to Me across all expense groups and items, minus applied credits.
 */
export const calculateOweTotals = (
  groups: ExpenseGroup[],
  items: ExpenseItem[],
  credits: Credit[] = []
): OweSummary[] => {
  const map = new Map<string, number>();

  groups.forEach(g => {
    const groupItems = items.filter(i => i.groupId === g.id);
    const paidList = g.paidUsers || [];
    const paidSet = new Set(paidList.map(u => u.trim().toLowerCase()));

    groupItems.forEach(item => {
      if (!item.splitUser) return;
      const splitUserTrimmed = item.splitUser.trim();
      const splitUserLower = splitUserTrimmed.toLowerCase();

      if (splitUserLower === 'me' || splitUserLower === 'unassigned' || splitUserTrimmed === '') {
        return;
      }

      // Only add to owe amount if this user hasn't paid yet
      if (!paidSet.has(splitUserLower)) {
        map.set(splitUserTrimmed, (map.get(splitUserTrimmed) || 0) + item.amount);
      }
    });
  });

  // Subtract credits
  credits.forEach(c => {
    const userTrimmed = c.userName.trim();
    if (userTrimmed === '') return;
    map.set(userTrimmed, (map.get(userTrimmed) || 0) - c.amount);
  });

  return Array.from(map.entries())
    .map(([userName, amount]) => ({ userName, amount }))
    .filter(item => item.amount > 0)
    .sort((a, b) => b.amount - a.amount);
};

export interface OweDetailItem {
  id: string;
  groupId: string;
  groupDescription: string;
  itemDescription: string;
  amount: number;
  category: string;
  date: string;
}

export interface UserOweBreakdown {
  userName: string;
  totalAmount: number;
  items: OweDetailItem[];
}

/**
 * Calculates detailed itemized debts owed to Me grouped by debtor user, minus applied credits.
 * Keeps the debtor in the list if they have gross outstanding splits, even if their net debt is 0.
 */
export const calculateOweBreakdown = (
  groups: ExpenseGroup[],
  items: ExpenseItem[],
  credits: Credit[] = []
): UserOweBreakdown[] => {
  const map = new Map<string, { totalAmount: number; items: OweDetailItem[] }>();

  groups.forEach(g => {
    const groupItems = items.filter(i => i.groupId === g.id);
    const paidList = g.paidUsers || [];
    const paidSet = new Set(paidList.map(u => u.trim().toLowerCase()));

    groupItems.forEach(item => {
      if (!item.splitUser) return;
      const splitUserTrimmed = item.splitUser.trim();
      const splitUserLower = splitUserTrimmed.toLowerCase();

      if (splitUserLower === 'me' || splitUserLower === 'unassigned' || splitUserTrimmed === '') {
        return;
      }

      // Only add to owe details if this user hasn't paid yet
      if (!paidSet.has(splitUserLower)) {
        if (!map.has(splitUserTrimmed)) {
          map.set(splitUserTrimmed, { totalAmount: 0, items: [] });
        }
        const userObj = map.get(splitUserTrimmed)!;
        userObj.totalAmount += item.amount;
        userObj.items.push({
          id: item.id,
          groupId: g.id,
          groupDescription: g.description,
          itemDescription: item.description,
          amount: item.amount,
          category: item.category,
          date: g.date
        });
      }
    });
  });

  // Subtract credits
  credits.forEach(c => {
    const userTrimmed = c.userName.trim();
    if (userTrimmed === '') return;
    const userObj = map.get(userTrimmed);
    if (userObj) {
      userObj.totalAmount -= c.amount;
    } else {
      map.set(userTrimmed, { totalAmount: -c.amount, items: [] });
    }
  });

  return Array.from(map.entries())
    .map(([userName, data]) => ({
      userName,
      totalAmount: data.totalAmount,
      items: data.items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }))
    .filter(u => u.items.length > 0) // Debtor must have gross splits
    .sort((a, b) => b.totalAmount - a.totalAmount);
};

