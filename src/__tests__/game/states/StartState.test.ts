import { describe, it, expect } from 'vitest';
import { StartState } from '../../../game/states/StartState';

describe('StartState', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new StartState(null as any);
    expect(instance).toBeDefined();
  });

  it('should have enter method', () => {
    const instance = new StartState(null as any);
    expect(typeof instance.enter).toBe('function');
  });

  it('should have update method', () => {
    const instance = new StartState(null as any);
    expect(typeof instance.update).toBe('function');
  });

  it('should have render method', () => {
    const instance = new StartState(null as any);
    expect(typeof instance.render).toBe('function');
  });

});


