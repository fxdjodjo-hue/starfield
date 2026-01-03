import { describe, it, expect } from 'vitest';
import { Shield } from '../../../entities/combat/Shield';

describe('Shield', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new Shield(50, 100);
    expect(instance).toBeDefined();
  });

  it('should have recharge method', () => {
    const instance = new Shield(50, 100);
    expect(typeof instance.recharge).toBe('function');
  });

  it('should have isActive method', () => {
    const instance = new Shield(50, 100);
    expect(typeof instance.isActive).toBe('function');
  });

  it('should have getShieldPercentage method', () => {
    const instance = new Shield(50, 100);
    expect(typeof instance.getShieldPercentage).toBe('function');
  });

});


