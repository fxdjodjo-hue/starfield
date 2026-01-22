import { describe, it, expect } from 'vitest';
import { Explosion } from '../../../entities/combat/Explosion';

describe('Explosion', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new Explosion(0, 0);
    expect(instance).toBeDefined();
  });

  it('should have update method', () => {
    const instance = new Explosion(0, 0);
    expect(typeof instance.update).toBe('function');
  });

  it('should have getCurrentFrame method', () => {
    const instance = new Explosion(0, 0);
    expect(typeof instance.getCurrentFrame).toBe('function');
  });

  it('should have isAnimationFinished method', () => {
    const instance = new Explosion(0, 0);
    expect(typeof instance.isAnimationFinished).toBe('function');
  });

});


