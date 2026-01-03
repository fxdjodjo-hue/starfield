import { describe, it, expect } from 'vitest';
import { EconomySystem } from '../../../systems/economy/EconomySystem';

describe('EconomySystem', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new EconomySystem(null as any);
    expect(instance).toBeDefined();
  });

  it('should have setPlayerEntity method', () => {
    const instance = new EconomySystem(null as any);
    expect(typeof instance.setPlayerEntity).toBe('function');
  });

  it('should have setRankSystem method', () => {
    const instance = new EconomySystem(null as any);
    expect(typeof instance.setRankSystem).toBe('function');
  });

  it('should have createEconomyDisplays method', () => {
    const instance = new EconomySystem(null as any);
    expect(typeof instance.createEconomyDisplays).toBe('function');
  });

});


