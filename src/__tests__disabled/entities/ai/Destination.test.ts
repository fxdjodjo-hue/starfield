import { describe, it, expect } from 'vitest';
import { Destination } from '../../../entities/ai/Destination';

describe('Destination', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new Destination(0, 0);
    expect(instance).toBeDefined();
  });

  it('should have setDestination method', () => {
    const instance = new Destination(0, 0);
    expect(typeof instance.setDestination).toBe('function');
  });

  it('should have getDirection method', () => {
    const instance = new Destination(0, 0);
    expect(typeof instance.getDirection).toBe('function');
  });

  it('should have getDistance method', () => {
    const instance = new Destination(0, 0);
    expect(typeof instance.getDistance).toBe('function');
  });

});


