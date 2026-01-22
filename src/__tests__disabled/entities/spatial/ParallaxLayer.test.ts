import { describe, it, expect } from 'vitest';
import { ParallaxLayer } from '../../../entities/spatial/ParallaxLayer';

describe('ParallaxLayer', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new ParallaxLayer("", 1);
    expect(instance).toBeDefined();
  });

  it('should have setSpeed method', () => {
    const instance = new ParallaxLayer("", 1);
    expect(typeof instance.setSpeed).toBe('function');
  });

  it('should have setOffset method', () => {
    const instance = new ParallaxLayer("", 1);
    expect(typeof instance.setOffset).toBe('function');
  });

});


