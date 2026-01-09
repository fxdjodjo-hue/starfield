import { describe, it, expect } from 'vitest';
import { World } from '../../../infrastructure/engine/World';

describe('World', () => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d')!;
  });

  it('should create instance', () => {
    const instance = new World(canvas);
    expect(instance).toBeDefined();
  });

  it('should have setupCanvas method', () => {
    const instance = new World(canvas);
    expect(typeof instance.setupCanvas).toBe('function');
  });

  it('should have resizeCanvas method', () => {
    const instance = new World(canvas);
    expect(typeof instance.resizeCanvas).toBe('function');
  });

  it('should have update method', () => {
    const instance = new World(canvas);
    expect(typeof instance.update).toBe('function');
  });

});


