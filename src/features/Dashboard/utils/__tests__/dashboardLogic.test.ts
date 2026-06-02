import { describe, it, expect } from 'vitest';
import { calculateKKBSplit, formatKKBShare, shouldIncludeItemInAccount } from '../dashboardLogic';

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
});
