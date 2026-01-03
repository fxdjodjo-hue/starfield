import { describe, it, expect } from 'vitest';
import { ECS } from '../../../infrastructure/ecs/ECS';

describe('ECS', () => {
  it('should have createEntity method', () => {
    const instance = new ECS();
    expect(typeof instance.createEntity).toBe('function');
  });

  it('should have removeEntity method', () => {
    const instance = new ECS();
    expect(typeof instance.removeEntity).toBe('function');
  });

  it('should have entityExists method', () => {
    const instance = new ECS();
    expect(typeof instance.entityExists).toBe('function');
  });

});


