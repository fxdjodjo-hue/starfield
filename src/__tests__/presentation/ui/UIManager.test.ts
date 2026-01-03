import { describe, it, expect } from 'vitest';
import { FloatingIcon } from '../../../presentation/ui/UIManager';
import { UIManager } from '../../../presentation/ui/UIManager';

describe('FloatingIcon', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new FloatingIcon();
    expect(instance).toBeDefined();
  });

  it('should have createPanelContainer method', () => {
    const instance = new FloatingIcon();
    expect(typeof instance.createPanelContainer).toBe('function');
  });

  it('should have getPositionStyles method', () => {
    const instance = new FloatingIcon();
    expect(typeof instance.getPositionStyles).toBe('function');
  });

  it('should have setupEventListeners method', () => {
    const instance = new FloatingIcon();
    expect(typeof instance.setupEventListeners).toBe('function');
  });

});

describe('UIManager', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new UIManager();
    expect(instance).toBeDefined();
  });

  it('should have createPanelContainer method', () => {
    const instance = new UIManager();
    expect(typeof instance.createPanelContainer).toBe('function');
  });

  it('should have getPositionStyles method', () => {
    const instance = new UIManager();
    expect(typeof instance.getPositionStyles).toBe('function');
  });

  it('should have setupEventListeners method', () => {
    const instance = new UIManager();
    expect(typeof instance.setupEventListeners).toBe('function');
  });

});


