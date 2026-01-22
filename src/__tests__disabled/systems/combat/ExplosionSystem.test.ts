import { describe, it, expect } from 'vitest';
import { ExplosionSystem } from '../../../systems/combat/ExplosionSystem';

describe('ExplosionSystem', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new ExplosionSystem(null as any);
    expect(instance).toBeDefined();
  });

  it('should have update method', () => {
    const instance = new ExplosionSystem(null as any);
    expect(typeof instance.update).toBe('function');
  });

});


