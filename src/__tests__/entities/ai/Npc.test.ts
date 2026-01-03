import { describe, it, expect } from 'vitest';
import { Npc } from '../../../entities/ai/Npc';

describe('Npc', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new Npc(0, 0, "test");
    expect(instance).toBeDefined();
  });

  it('should have setType method', () => {
    const instance = new Npc(0, 0, "test");
    expect(typeof instance.setType).toBe('function');
  });

  it('should have setBehavior method', () => {
    const instance = new Npc(0, 0, "test");
    expect(typeof instance.setBehavior).toBe('function');
  });

});


