import { describe, it, expect } from 'vitest';
import { PlayState } from '../../../game/states/PlayState';

describe('PlayState', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new PlayState(null as any);
    expect(instance).toBeDefined();
  });

  it('should have update method', () => {
    const instance = new PlayState(null as any);
    expect(typeof instance.update).toBe('function');
  });

  it('should have render method', () => {
    const instance = new PlayState(null as any);
    expect(typeof instance.render).toBe('function');
  });

  it('should have handleInput method', () => {
    const instance = new PlayState(null as any);
    expect(typeof instance.handleInput).toBe('function');
  });

});


