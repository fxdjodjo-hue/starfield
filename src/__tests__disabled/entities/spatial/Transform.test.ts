import { describe, it, expect } from 'vitest';
import { Transform } from '../../../entities/spatial/Transform';

describe('Transform', () => {
  it('should create transform with default values', () => {
    const transform = new Transform();

    expect(transform.x).toBe(0);
    expect(transform.y).toBe(0);
    expect(transform.rotation).toBe(0);
    expect(transform.scaleX).toBe(1);
    expect(transform.scaleY).toBe(1);
  });

  it('should create transform with custom values', () => {
    const transform = new Transform(10, 20, Math.PI / 2, 2, 1.5);

    expect(transform.x).toBe(10);
    expect(transform.y).toBe(20);
    expect(transform.rotation).toBe(Math.PI / 2);
    expect(transform.scaleX).toBe(2);
    expect(transform.scaleY).toBe(1.5);
  });

  it('should set position', () => {
    const transform = new Transform();
    transform.setPosition(100, 200);

    expect(transform.x).toBe(100);
    expect(transform.y).toBe(200);
  });

  it('should translate position', () => {
    const transform = new Transform(10, 20);
    transform.translate(5, -3);

    expect(transform.x).toBe(15);
    expect(transform.y).toBe(17);
  });
});
