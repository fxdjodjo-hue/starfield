import { describe, it, expect } from 'vitest';
import { Camera } from '../../../entities/spatial/Camera';

describe('Camera', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new Camera();
    expect(instance).toBeDefined();
  });

  it('should have centerOn method', () => {
    const instance = new Camera();
    expect(typeof instance.centerOn).toBe('function');
  });

  it('should have translate method', () => {
    const instance = new Camera();
    expect(typeof instance.translate).toBe('function');
  });

  it('should have setZoom method', () => {
    const instance = new Camera();
    expect(typeof instance.setZoom).toBe('function');
  });

});


