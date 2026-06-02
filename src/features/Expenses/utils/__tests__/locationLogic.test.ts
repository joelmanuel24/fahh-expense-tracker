import { describe, it, expect } from 'vitest';
import { getHaversineDistance } from '../locationLogic';

describe('getHaversineDistance', () => {
  it('should return 0 for identical coordinates', () => {
    expect(getHaversineDistance(14.5995, 120.9842, 14.5995, 120.9842)).toBeCloseTo(0, 4);
  });

  it('should compute standard distance correctly', () => {
    // Distance between Manila (14.5995, 120.9842) and Quezon City (14.6760, 121.0437) is approx 10.5 km
    const dist = getHaversineDistance(14.5995, 120.9842, 14.6760, 121.0437);
    expect(dist).toBeGreaterThan(9.5);
    expect(dist).toBeLessThan(11.5);
  });
});
