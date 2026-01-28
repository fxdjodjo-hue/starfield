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
            targetName: 'Space Station',
            x: 0,
            y: 0,
            radius: 500
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
        title: 'Mining Sector',
        description: 'The Mining Sector is located at (9000, 4500). Go there and check its status.',
        type: 'exploration',
        objectives: [{
            id: 'explore_mining_obj',
            type: ObjectiveType.EXPLORE,
            description: 'Visit the Mining Sector (Coord 9000, 4500)',
            target: 1,
            targetName: 'Mining Sector',
            x: 9000,
            y: 4500,
            radius: 500
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
        title: 'Nebula Outpost',
        description: 'An outpost is located at (3000, 5500) within the Purple Nebula.',
        type: 'exploration',
        objectives: [{
            id: 'explore_nebula_obj',
            type: ObjectiveType.EXPLORE,
            description: 'Visit the Nebula Outpost (Coord 3000, 5500)',
            target: 1,
            targetName: 'Nebula Outpost',
            x: 3000,
            y: 5500,
            radius: 500
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
        title: 'Frontier Outpost',
        description: 'Explore the Frontier Outpost at (-10000, 3000) in the western quadrant.',
        type: 'exploration',
        objectives: [{
            id: 'explore_frontier_obj',
            type: ObjectiveType.EXPLORE,
            description: 'Visit the Frontier Outpost (Coord -10000, 3000)',
            target: 1,
            targetName: 'Frontier Outpost',
            x: -10000,
            y: 3000,
            radius: 500
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
        title: 'Event Horizon',
        description: 'Scientific sensors report strange readings from the Event Horizon at (-4000, -6000).',
        type: 'exploration',
        objectives: [{
            id: 'explore_blackhole_obj',
            type: ObjectiveType.EXPLORE,
            description: 'Navigate to the Event Horizon (Coord -4000, -6000)',
            target: 1,
            targetName: 'Event Horizon',
            x: -4000,
            y: -6000,
            radius: 500
        }],
        rewards: [
            { type: RewardType.CREDITS, amount: 2500 },
            { type: RewardType.COSMOS, amount: 1000 },
            { type: RewardType.HONOR, amount: 10 }
        ],
        prerequisites: ['explore_frontier'],
        levelRequirement: 12
    });

    // --- Inner Rim (Level 1-10) ---
    const sites = [
        { id: 'comms_relay', title: 'Comms Relay', desc: 'A communications relay is drifting at (500, -800).', x: 500, y: -800, lvl: 2 },
        { id: 'cargo_wreck', title: 'Wreckage', desc: 'A derelict ship has been spotted at (-1200, 400).', x: -1200, y: 400, lvl: 4 },
        { id: 'asteroid_base', title: 'Asteroid Field', desc: 'A suspicious asteroid at (800, 1500) might hold supplies.', x: 800, y: 1500, lvl: 6 },
        { id: 'signal_buoy', title: 'Signal Buoy', desc: 'A navigational buoy is offline at (-500, -2000).', x: -500, y: -2000, lvl: 7 },
        { id: 'ancient_pod', title: 'Escape Pod', desc: 'An unidentified pod is floating at (2200, -100).', x: 2200, y: -100, lvl: 9 }
    ];

    sites.forEach((s, i) => {
        QuestRegistry.register({
            id: `explore_inner_${s.id}`,
            title: s.title,
            description: s.desc,
            type: 'exploration',
            objectives: [{
                id: `obj_inner_${s.id}`,
                type: ObjectiveType.EXPLORE,
                description: `Locate ${s.title}`,
                target: 1,
                targetName: s.title,
                x: s.x,
                y: s.y,
                radius: 500
            }],
            rewards: [
                { type: RewardType.CREDITS, amount: 300 + (i * 100) },
                { type: RewardType.EXPERIENCE, amount: 100 + (i * 50) }
            ],
            levelRequirement: s.lvl
        });
    });

    // --- Mid-Rim (Level 11-25) ---
    const midSites = [
        { id: 'ice_fortress', title: 'Fortress', desc: 'A large structure detected at (5400, 3200).', x: 5400, y: 3200, lvl: 15 },
        { id: 'energy_cloud', title: 'Energy Anomaly', desc: 'Strong energy readings at (-4500, -1200).', x: -4500, y: -1200, lvl: 18 },
        { id: 'derelict_frigate', title: 'Derelict Ship', desc: 'A decommissioned ship is located at (6000, -2500).', x: 6000, y: -2500, lvl: 20 },
        { id: 'mining_outpost', title: 'Outpost', desc: 'A mining facility at (-3000, 5000).', x: -3000, y: 5000, lvl: 22 },
        { id: 'nebula_shrine', title: 'Shrine', desc: 'A mysterious object hidden in the fog at (4000, -4500).', x: 4000, y: -4500, lvl: 25 }
    ];

    midSites.forEach((s, i) => {
        QuestRegistry.register({
            id: `explore_mid_${s.id}`,
            title: s.title,
            description: s.desc,
            type: 'exploration',
            objectives: [{
                id: `obj_mid_${s.id}`,
                type: ObjectiveType.EXPLORE,
                description: `Visit ${s.title}`,
                target: 1,
                targetName: s.title,
                x: s.x,
                y: s.y,
                radius: 500
            }],
            rewards: [
                { type: RewardType.CREDITS, amount: 2000 + (i * 500) },
                { type: RewardType.COSMOS, amount: 500 + (i * 200) },
                { type: RewardType.EXPERIENCE, amount: 1500 + (i * 500) }
            ],
            levelRequirement: s.lvl
        });
    });

    // Special End-game anomalies
    const anomalies = [
        { id: 'singularity_alpha', title: 'Anomaly Alpha', x: -10000, y: 6000, lvl: 45 },
        { id: 'singularity_beta', title: 'Anomaly Beta', x: 10000, y: -6000, lvl: 48 },
        { id: 'singularity_omega', title: 'Anomaly Omega', x: -10000, y: -6000, lvl: 50 }
    ];

    anomalies.forEach(a => {
        QuestRegistry.register({
            id: `explore_anomaly_${a.id}`,
            title: a.title,
            description: `An energy spike detected at (${a.x}, ${a.y}). Investigate immediately.`,
            type: 'exploration',
            objectives: [{
                id: `obj_anomaly_${a.id}`,
                type: ObjectiveType.EXPLORE,
                description: `Investigate: ${a.title}`,
                target: 1,
                targetName: a.title,
                x: a.x,
                y: a.y,
                radius: 500
            }],
            rewards: [
                { type: RewardType.CREDITS, amount: 100000 },
                { type: RewardType.COSMOS, amount: 50000 },
                { type: RewardType.EXPERIENCE, amount: 200000 },
                { type: RewardType.HONOR, amount: 500 }
            ],
            levelRequirement: a.lvl
        });
    });
}
