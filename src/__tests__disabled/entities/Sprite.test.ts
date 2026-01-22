import { describe, it, expect } from 'vitest';
import { Sprite } from '../../../entities/Sprite';

describe('Sprite', () => {
  it('should create instance with null image', () => {
    const instance = new Sprite(null, 64, 32);
    expect(instance).toBeDefined();
    expect(instance.width).toBe(64);
    expect(instance.height).toBe(32);
    expect(instance.image).toBeNull();
  });

  it('should create instance with image', () => {
    const mockImage = {
      width: 128,
      height: 64,
      complete: true,
      naturalWidth: 128
    } as HTMLImageElement;

    const instance = new Sprite(mockImage);
    expect(instance).toBeDefined();
    expect(instance.width).toBe(128);
    expect(instance.height).toBe(64);
    expect(instance.image).toBe(mockImage);
  });

  it('should have isLoaded method', () => {
    const instance = new Sprite(null, 64, 32);
    expect(typeof instance.isLoaded).toBe('function');
  });

  it('should return false for isLoaded when image is null', () => {
    const instance = new Sprite(null, 64, 32);
    expect(instance.isLoaded()).toBe(false);
  });

  it('should return true for isLoaded when image is loaded', () => {
    const mockImage = {
      width: 128,
      height: 64,
      complete: true,
      naturalWidth: 128
    } as HTMLImageElement;

    const instance = new Sprite(mockImage);
    expect(instance.isLoaded()).toBe(true);
  });

});


