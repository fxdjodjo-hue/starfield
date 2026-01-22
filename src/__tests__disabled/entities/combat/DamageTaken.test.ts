import { describe, it, expect } from 'vitest';
import { DamageTaken } from '../../../entities/combat/DamageTaken';

describe('DamageTaken', () => {
  it('should have takeDamage method', () => {
    const instance = new DamageTaken(10);
    expect(typeof instance.takeDamage).toBe('function');
  });

  it('should have wasDamagedRecently method', () => {
    const instance = new DamageTaken(10);
    expect(typeof instance.wasDamagedRecently).toBe('function');
  });

  it('should have getTimeSinceLastDamage method', () => {
    const instance = new DamageTaken(10);
    expect(typeof instance.getTimeSinceLastDamage).toBe('function');
  });

});


