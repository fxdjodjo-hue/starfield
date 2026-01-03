import { describe, it, expect } from 'vitest';
import { QuestPanel } from '../../../presentation/ui/QuestPanel';

describe('QuestPanel', () => {
  it('should create instance', () => {
    // TODO: Add constructor parameters
    const instance = new QuestPanel();
    expect(instance).toBeDefined();
  });

  it('should have setupQuestEventListeners method', () => {
    const instance = new QuestPanel();
    expect(typeof instance.setupQuestEventListeners).toBe('function');
  });

  it('should have createPanelContent method', () => {
    const instance = new QuestPanel();
    expect(typeof instance.createPanelContent).toBe('function');
  });

  it('should have createQuestSection method', () => {
    const instance = new QuestPanel();
    expect(typeof instance.createQuestSection).toBe('function');
  });

});


