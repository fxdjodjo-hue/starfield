import { describe, it, expect } from 'vitest';
import { Minimap } from '../../../presentation/ui/Minimap';

describe('Minimap', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new Minimap();
    expect(instance).toBeDefined();
  });

  it('should have worldToMinimap method', () => {
    const instance = new Minimap();
    expect(typeof instance.worldToMinimap).toBe('function');
  });

  it('should have minimapToWorld method', () => {
    const instance = new Minimap();
    expect(typeof instance.minimapToWorld).toBe('function');
  });

  it('should have isPointInside method', () => {
    const instance = new Minimap();
    expect(typeof instance.isPointInside).toBe('function');
  });

});


