import { describe, it, expect } from 'vitest';
import { migrations } from '../../../../db';

describe('Database Migrations', () => {
  it('should have a consecutive, non-empty registry of migrations starting at version 1', () => {
    const versions = Object.keys(migrations).map(Number).sort((a, b) => a - b);
    
    expect(versions.length).toBeGreaterThan(0);
    expect(versions[0]).toBe(1);

    // Verify sequential integrity (no missing steps)
    for (let i = 0; i < versions.length; i++) {
      expect(versions[i]).toBe(i + 1);
    }
  });

  it('every entry in the migration registry should be a valid function', () => {
    Object.entries(migrations).forEach(([version, migrationFn]) => {
      expect(migrationFn).toBeTypeOf('function');
    });
  });
});
