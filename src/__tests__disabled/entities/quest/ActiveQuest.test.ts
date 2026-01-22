import { describe, it, expect } from 'vitest';
import { ActiveQuest } from '../../../entities/quest/ActiveQuest';

describe('ActiveQuest', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new ActiveQuest(null as any);
    expect(instance).toBeDefined();
  });

  it('should have addQuest method', () => {
    const instance = new ActiveQuest(null as any);
    expect(typeof instance.addQuest).toBe('function');
  });

  it('should have removeQuest method', () => {
    const instance = new ActiveQuest(null as any);
    expect(typeof instance.removeQuest).toBe('function');
  });

  it('should have getQuest method', () => {
    const instance = new ActiveQuest(null as any);
    expect(typeof instance.getQuest).toBe('function');
  });

});


