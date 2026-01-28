import { registerKillQuests } from './killQuests';
import { registerCollectionQuests } from './collectionQuests';
import { registerExplorationQuests } from './explorationQuests';
import { registerAchievementQuests } from './achievementQuests';

/**
 * Initializes all default quests by calling specific registration functions.
 */
export function initializeDefaultQuests(): void {
    registerKillQuests();
    registerCollectionQuests();
    registerExplorationQuests();
    registerAchievementQuests();
}
