import { describe, it, expect } from 'vitest';
import { Projectile } from '../../../entities/combat/Projectile';

describe('Projectile', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new Projectile(0, 0, 0, 0);
    expect(instance).toBeDefined();
  });

});


