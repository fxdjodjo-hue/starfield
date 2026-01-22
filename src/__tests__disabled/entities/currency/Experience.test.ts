import { describe, it, expect } from 'vitest';
import { Experience } from '../../../entities/currency/Experience';

describe('Experience', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new Experience(0);
    expect(instance).toBeDefined();
  });

  it('should have getLevelProgress method', () => {
    const instance = new Experience(0);
    expect(typeof instance.getLevelProgress).toBe('function');
  });

  it('should have addExp method', () => {
    const instance = new Experience(0);
    expect(typeof instance.addExp).toBe('function');
  });

  it('should have levelUp method', () => {
    const instance = new Experience(0);
    expect(typeof instance.levelUp).toBe('function');
  });

});


