import { QuestRegistry, ObjectiveType, RewardType } from '../QuestConfig';

export function registerExplorationQuests() {
    // 1. Visit the Space Station
    QuestRegistry.register({
        id: 'explore_station',
        title: 'The Central Hub',
        description: 'Navigate to the main Space Station at (0, 0) to register your arrival.',
        type: 'exploration',
        objectives: [{
            id: 'explore_station_obj',
            type: ObjectiveType.EXPLORE,
            description: 'Visit the Space Station (Coord 0, 0)',
            target: 1,
            targetName: 'Space Station'
        }],
        rewards: [
            { type: RewardType.CREDITS, amount: 200 },
            { type: RewardType.EXPERIENCE, amount: 50 }
        ],
        levelRequirement: 1
    });

    // 2. Mining Sector
    QuestRegistry.register({
        id: 'explore_mining',
        title: 'Industrial Frontier',
        description: 'The Mining Sector is located at (15000, 10000). Go there and check its status.',
        type: 'exploration',
        objectives: [{
            id: 'explore_mining_obj',
            type: ObjectiveType.EXPLORE,
            description: 'Visit the Mining Sector (Coord 15000, 10000)',
            target: 1,
            targetName: 'Mining Sector'
        }],
        rewards: [
            { type: RewardType.CREDITS, amount: 500 },
            { type: RewardType.COSMOS, amount: 100 }
        ],
        prerequisites: ['explore_station'],
        levelRequirement: 3
    });

    // 3. Nebula Outpost
    QuestRegistry.register({
        id: 'explore_nebula',
        title: 'Lost in the Fog',
        description: 'An old outpost is hidden at (2000, 12000) within the Purple Nebula.',
        type: 'exploration',
        objectives: [{
            id: 'explore_nebula_obj',
            type: ObjectiveType.EXPLORE,
            description: 'Visit the Nebula Outpost (Coord 2000, 12000)',
            target: 1,
            targetName: 'Nebula Outpost'
        }],
        rewards: [
            { type: RewardType.COSMOS, amount: 300 },
            { type: RewardType.EXPERIENCE, amount: 200 }
        ],
        prerequisites: ['explore_mining'],
        levelRequirement: 5
    });

    // 4. Frontier Outpost
    QuestRegistry.register({
        id: 'explore_frontier',
        title: 'The Edge of Space',
        description: 'Explore the distant Frontier Outpost at (-12000, 8000) in the western quadrant.',
        type: 'exploration',
        objectives: [{
            id: 'explore_frontier_obj',
            type: ObjectiveType.EXPLORE,
            description: 'Visit the Frontier Outpost (Coord -12000, 8000)',
            target: 1,
            targetName: 'Frontier Outpost'
        }],
        rewards: [
            { type: RewardType.CREDITS, amount: 1000 },
            { type: RewardType.HONOR, amount: 5 }
        ],
        levelRequirement: 8
    });

    // 5. Event Horizon
    QuestRegistry.register({
        id: 'explore_blackhole',
        title: 'The Great Unknown',
        description: 'Scientific sensors report strange readings from the Event Horizon at (-5000, -15000).',
        type: 'exploration',
        objectives: [{
            id: 'explore_blackhole_obj',
            type: ObjectiveType.EXPLORE,
            description: 'Navigate to the Event Horizon (Coord -5000, -15000)',
            target: 1,
            targetName: 'Event Horizon'
        }],
        rewards: [
            { type: RewardType.CREDITS, amount: 2500 },
            { type: RewardType.COSMOS, amount: 1000 },
            { type: RewardType.HONOR, amount: 10 }
        ],
        prerequisites: ['explore_frontier'],
        levelRequirement: 12
    });
}
