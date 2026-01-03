import { describe, it, expect } from 'vitest';
import { Quest } from '../../../entities/quest/Quest';

describe('Quest', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new Quest("test", "test", []);
    expect(instance).toBeDefined();
  });

  it('should have getProgress method', () => {
    const instance = new Quest("test", "test", []);
    expect(typeof instance.getProgress).toBe('function');
  });

  it('should have checkCompletion method', () => {
    const instance = new Quest("test", "test", []);
    expect(typeof instance.checkCompletion).toBe('function');
  });

  it('should have resetProgress method', () => {
    const instance = new Quest("test", "test", []);
    expect(typeof instance.resetProgress).toBe('function');
  });

});


