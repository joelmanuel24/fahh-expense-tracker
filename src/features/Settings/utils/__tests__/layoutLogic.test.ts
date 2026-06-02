import { describe, it, expect } from 'vitest';
import { sortItemsByIds } from '../layoutLogic';

describe('sortItemsByIds', () => {
  const mockItems = [
    { id: 'cat_food', name: 'Food' },
    { id: 'cat_leisure', name: 'Leisure' },
    { id: 'cat_others', name: 'Others' }
  ];

  it('should sort items based on orderIds layout', () => {
    const order = ['cat_others', 'cat_food', 'cat_leisure'];
    const result = sortItemsByIds(mockItems, order);
    expect(result[0].id).toBe('cat_others');
    expect(result[1].id).toBe('cat_food');
    expect(result[2].id).toBe('cat_leisure');
  });

  it('should return original items if orderIds is empty or null', () => {
    expect(sortItemsByIds(mockItems, null)).toEqual(mockItems);
    expect(sortItemsByIds(mockItems, undefined)).toEqual(mockItems);
  });

  it('should append items to the end if they are not defined in layout', () => {
    const order = ['cat_leisure'];
    const result = sortItemsByIds(mockItems, order);
    expect(result[0].id).toBe('cat_leisure');
    // Non-present items should follow
    expect(result.slice(1).map(x => x.id)).toContain('cat_food');
    expect(result.slice(1).map(x => x.id)).toContain('cat_others');
  });
});
