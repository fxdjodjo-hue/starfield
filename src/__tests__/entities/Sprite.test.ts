import { describe, it, expect } from 'vitest';
import { Sprite } from '../../../entities/Sprite';

describe('Sprite', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new Sprite("");
    expect(instance).toBeDefined();
  });

  it('should have isLoaded method', () => {
    const instance = new Sprite("");
    expect(typeof instance.isLoaded).toBe('function');
  });

});


