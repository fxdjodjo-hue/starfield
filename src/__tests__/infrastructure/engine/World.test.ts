import { describe, it, expect } from 'vitest';
import { World } from '../../../infrastructure/engine/World';

describe('World', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new World();
    expect(instance).toBeDefined();
  });

  it('should have setupCanvas method', () => {
    const instance = new World();
    expect(typeof instance.setupCanvas).toBe('function');
  });

  it('should have resizeCanvas method', () => {
    const instance = new World();
    expect(typeof instance.resizeCanvas).toBe('function');
  });

  it('should have update method', () => {
    const instance = new World();
    expect(typeof instance.update).toBe('function');
  });

});


