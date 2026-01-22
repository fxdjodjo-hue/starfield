import { describe, it, expect } from 'vitest';
import { PlayerHUD } from '../../../presentation/ui/PlayerHUD';

describe('PlayerHUD', () => {
  it('should have createHUDContainer method', () => {
    const instance = new PlayerHUD();
    expect(typeof instance.createHUDContainer).toBe('function');
  });

  it('should have attachGlassStyles method', () => {
    const instance = new PlayerHUD();
    expect(typeof instance.attachGlassStyles).toBe('function');
  });

  it('should have show method', () => {
    const instance = new PlayerHUD();
    expect(typeof instance.show).toBe('function');
  });

});


