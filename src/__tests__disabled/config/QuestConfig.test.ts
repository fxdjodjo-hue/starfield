import { describe, it, expect } from 'vitest';
import { QuestRegistry } from '../../../config/QuestConfig';
import { QuestObjectiveFactory } from '../../../config/QuestConfig';
import { QuestRewardFactory } from '../../../config/QuestConfig';

describe('QuestRegistry', () => {
  it('should have handleEvent method', () => {
    const instance = new QuestRegistry();
    expect(typeof instance.handleEvent).toBe('function');
  });

});

describe('QuestObjectiveFactory', () => {
  it('should have handleEvent method', () => {
    const instance = new QuestObjectiveFactory();
    expect(typeof instance.handleEvent).toBe('function');
  });

});

describe('QuestRewardFactory', () => {
  it('should have handleEvent method', () => {
    const instance = new QuestRewardFactory();
    expect(typeof instance.handleEvent).toBe('function');
  });

});


