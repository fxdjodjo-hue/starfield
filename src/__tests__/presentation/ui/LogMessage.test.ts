import { describe, it, expect } from 'vitest';
import { LogMessage } from '../../../presentation/ui/LogMessage';

describe('LogMessage', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new LogMessage("");
    expect(instance).toBeDefined();
  });

  it('should have isExpired method', () => {
    const instance = new LogMessage("");
    expect(typeof instance.isExpired).toBe('function');
  });

  it('should have getAlpha method', () => {
    const instance = new LogMessage("");
    expect(typeof instance.getAlpha).toBe('function');
  });

  it('should have getTextColor method', () => {
    const instance = new LogMessage("");
    expect(typeof instance.getTextColor).toBe('function');
  });

});


