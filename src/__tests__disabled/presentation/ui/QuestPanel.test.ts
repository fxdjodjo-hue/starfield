import { describe, it, expect } from 'vitest';
import { QuestPanel } from '../../../presentation/ui/QuestPanel';
import { PANEL_CONFIGS } from '../../../presentation/ui/PanelConfig';

describe('QuestPanel', () => {
  it('should create instance', () => {
    const instance = new QuestPanel(PANEL_CONFIGS.quest);
    expect(instance).toBeDefined();
  });

  it('should have setupQuestEventListeners method', () => {
    const instance = new QuestPanel(PANEL_CONFIGS.quest);
    expect(typeof instance.setupQuestEventListeners).toBe('function');
  });

  it('should have createPanelContent method', () => {
    const instance = new QuestPanel(PANEL_CONFIGS.quest);
    expect(typeof instance.createPanelContent).toBe('function');
  });

  it('should have createQuestSection method', () => {
    const instance = new QuestPanel(PANEL_CONFIGS.quest);
    expect(typeof instance.createQuestSection).toBe('function');
  });

});


