import { describe, it, expect } from 'vitest';
import { AssetManager } from '../../../infrastructure/AssetManager';

describe('AssetManager', () => {
  it('should have getImage method', () => {
    const instance = new AssetManager();
    expect(typeof instance.getImage).toBe('function');
  });

  it('should have isImageLoaded method', () => {
    const instance = new AssetManager();
    expect(typeof instance.isImageLoaded).toBe('function');
  });

});


