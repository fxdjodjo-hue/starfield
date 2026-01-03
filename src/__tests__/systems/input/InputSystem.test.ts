import { describe, it, expect } from 'vitest';
import { InputSystem } from '../../../systems/input/InputSystem';

describe('InputSystem', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new InputSystem();
    expect(instance).toBeDefined();
  });

  it('should have update method', () => {
    const instance = new InputSystem();
    expect(typeof instance.update).toBe('function');
  });

  it('should have getMousePosition method', () => {
    const instance = new InputSystem();
    expect(typeof instance.getMousePosition).toBe('function');
  });

  it('should have isMousePressed method', () => {
    const instance = new InputSystem();
    expect(typeof instance.isMousePressed).toBe('function');
  });

});


