import { describe, it, expect } from 'vitest';
import { StartScreen } from '../../../presentation/ui/StartScreen';

describe('StartScreen', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new StartScreen();
    expect(instance).toBeDefined();
  });

  it('should have createUI method', () => {
    const instance = new StartScreen();
    expect(typeof instance.createUI).toBe('function');
  });

  it('should have handlePlay method', () => {
    const instance = new StartScreen();
    expect(typeof instance.handlePlay).toBe('function');
  });

  it('should have hide method', () => {
    const instance = new StartScreen();
    expect(typeof instance.hide).toBe('function');
  });

});


