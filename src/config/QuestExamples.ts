/**
 * Esempi di come aggiungere facilmente nuove quest al sistema modulare
 *
 * Questo file mostra come estendere il sistema quest senza modificare il codice core.
 * Basta registrare nuove configurazioni nel QuestRegistry e saranno automaticamente
 * disponibili nel gioco.
 */

import { QuestRegistry, ObjectiveType, RewardType } from './QuestConfig';

/**
 * Esempio: Aggiungere una quest di raccolta risorse
 */
export function addResourceCollectionQuest(): void {
  QuestRegistry.register({
    id: 'collect_energy_crystals',
    title: 'Crystal Hunt',
    description: 'Collect 10 energy crystals scattered in the sector.',
    type: 'collect',
    objectives: [{
      id: 'collect_crystals_obj',
      type: ObjectiveType.COLLECT,
      description: 'Collect 10 Energy Crystals',
      target: 10,
      targetName: 'energy_crystal'
    }],
    rewards: [
      { type: RewardType.CREDITS, amount: 250 },
      { type: RewardType.EXPERIENCE, amount: 50 }
    ],
    levelRequirement: 2
  });
}

/**
 * Esempio: Aggiungere una quest di esplorazione
 */
export function addExplorationQuest(): void {
  QuestRegistry.register({
    id: 'explore_asteroid_field',
    title: 'Asteroid Field Exploration',
    description: 'Explore the Alpha-7 asteroid field and map available resources.',
    type: 'explore',
    objectives: [{
      id: 'explore_asteroid_obj',
      type: ObjectiveType.EXPLORE,
      description: 'Visit Asteroid Field Alpha-7',
      target: 1,
      targetName: 'asteroid_field_alpha_7'
    }],
    rewards: [
      { type: RewardType.COSMOS, amount: 75 },
      { type: RewardType.EXPERIENCE, amount: 30 }
    ],
    levelRequirement: 1,
    timeLimit: 1800 // 30 minuti
  });
}

/**
 * Esempio: Aggiungere una quest con prerequisiti e ricompense multiple
 */
export function addAdvancedCombatQuest(): void {
  QuestRegistry.register({
    id: 'kill_frigate_elite',
    title: 'Elite Hunt',
    description: 'Face and defeat an elite Frigate. Requires advanced skills.',
    type: 'kill',
    objectives: [{
      id: 'kill_frigate_elite_obj',
      type: ObjectiveType.KILL,
      description: 'Kill 1 Elite Frigate',
      target: 1,
      targetType: 'frigate_elite'
    }],
    rewards: [
      { type: RewardType.CREDITS, amount: 2000 },
      { type: RewardType.COSMOS, amount: 500 },
      { type: RewardType.EXPERIENCE, amount: 300 },
      { type: RewardType.HONOR, amount: 50 },
      { type: RewardType.ITEM, amount: 1, itemId: 'elite_weapon_blueprint' }
    ],
    prerequisites: ['kill_frigate_1', 'collect_energy_crystals'],
    levelRequirement: 8,
    repeatable: false
  });
}

/**
 * Esempio: Aggiungere una serie di quest concatenate
 */
export function addQuestChain(): void {
  // Parte 1: Introduzione
  QuestRegistry.register({
    id: 'tutorial_combat',
    title: 'Combat Lesson',
    description: 'Learn the basics of space combat.',
    type: 'tutorial',
    objectives: [{
      id: 'tutorial_combat_obj',
      type: ObjectiveType.KILL,
      description: 'Kill 3 Scouters',
      target: 3,
      targetType: 'scouter'
    }],
    rewards: [
      { type: RewardType.CREDITS, amount: 100 },
      { type: RewardType.EXPERIENCE, amount: 25 }
    ],
    levelRequirement: 1
  });

  // Parte 2: Combattimento intermedio
  QuestRegistry.register({
    id: 'intermediate_combat',
    title: 'Combat Master',
    description: 'Demonstrate your mastery against stronger enemies.',
    type: 'combat',
    objectives: [{
      id: 'intermediate_combat_obj',
      type: ObjectiveType.KILL,
      description: 'Kill 5 Frigates',
      target: 5,
      targetType: 'frigate'
    }],
    rewards: [
      { type: RewardType.CREDITS, amount: 750 },
      { type: RewardType.COSMOS, amount: 200 },
      { type: RewardType.EXPERIENCE, amount: 150 }
    ],
    prerequisites: ['tutorial_combat'],
    levelRequirement: 3
  });

  // Parte 3: Campagna finale
  QuestRegistry.register({
    id: 'campaign_finale',
    title: 'The Final Battle',
    description: 'Lead the final attack against the enemy fleet.',
    type: 'campaign',
    objectives: [
      {
        id: 'campaign_kill_obj',
        type: ObjectiveType.KILL,
        description: 'Kill 10 Elite Frigates',
        target: 10,
        targetType: 'frigate_elite'
      },
      {
        id: 'campaign_collect_obj',
        type: ObjectiveType.COLLECT,
        description: 'Collect 5 Power Crystals',
        target: 5,
        targetName: 'power_crystal'
      }
    ],
    rewards: [
      { type: RewardType.CREDITS, amount: 5000 },
      { type: RewardType.COSMOS, amount: 1000 },
      { type: RewardType.EXPERIENCE, amount: 500 },
      { type: RewardType.HONOR, amount: 100 },
      { type: RewardType.ITEM, amount: 1, itemId: 'legendary_ship_skin' }
    ],
    prerequisites: ['intermediate_combat', 'kill_frigate_elite'],
    levelRequirement: 10,
    timeLimit: 3600 // 1 ora
  });
}

/**
 * Esempio: Aggiungere quest stagionali o eventi speciali
 */
export function addSeasonalEventQuest(): void {
  QuestRegistry.register({
    id: 'holiday_invasion',
    title: 'Holiday Invasion',
    description: '🌟 Special Event: Defend the sector from holiday invaders!',
    type: 'event',
    objectives: [
      {
        id: 'holiday_kill_obj',
        type: ObjectiveType.KILL,
        description: 'Kill 25 Holiday Invaders',
        target: 25,
        targetType: 'holiday_invader'
      },
      {
        id: 'holiday_collect_obj',
        type: ObjectiveType.COLLECT,
        description: 'Collect 50 Holiday Packages',
        target: 50,
        targetName: 'holiday_package'
      }
    ],
    rewards: [
      { type: RewardType.CREDITS, amount: 10000 },
      { type: RewardType.COSMOS, amount: 2500 },
      { type: RewardType.EXPERIENCE, amount: 1000 },
      { type: RewardType.ITEM, amount: 1, itemId: 'holiday_spaceship_skin' },
      { type: RewardType.ITEM, amount: 1, itemId: 'festive_weapon_pack' }
    ],
    levelRequirement: 1,
    repeatable: true,
    timeLimit: 604800 // 1 settimana
  });
}

/**
 * Come usare questi esempi:
 *
 * Nel tuo codice di inizializzazione del gioco:
 *
 * ```typescript
 * import { addResourceCollectionQuest, addExplorationQuest, addQuestChain } from './config/QuestExamples';
 *
 * // Aggiungi le quest che vuoi
 * addResourceCollectionQuest();
 * addExplorationQuest();
 * addQuestChain();
 *
 * // Poi inizializza il sistema quest normalmente
 * initializeDefaultQuests();
 * ```
 *
 * Le quest saranno automaticamente disponibili nel gioco senza modificare il codice core!
 */

export {
  addResourceCollectionQuest,
  addExplorationQuest,
  addAdvancedCombatQuest,
  addQuestChain,
  addSeasonalEventQuest
};

