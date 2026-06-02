/**
 * Pure list sorting utility to order layout lists by a stored array of user layouts.
 */
export const sortItemsByIds = <T extends { id: string }>(
  items: T[],
  orderIds: string[] | null | undefined
): T[] => {
  if (!orderIds || !Array.isArray(orderIds)) return items;
  return [...items].sort((a, b) => {
    const indexA = orderIds.indexOf(a.id);
    const indexB = orderIds.indexOf(b.id);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
};
