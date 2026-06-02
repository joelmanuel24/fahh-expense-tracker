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
