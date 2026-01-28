import { QuestRegistry, ObjectiveType, RewardType } from '../QuestConfig';

export function registerKillQuests() {
    // Quest di uccisione Scouter
    QuestRegistry.register({
        id: 'kill_scouter_1',
        title: 'Scouter Hunt',
        description: 'Scouters represent a threat. Kill 1 to prove your worth.',
        type: 'kill',
        objectives: [{
            id: 'kill_scouter_obj',
            type: ObjectiveType.KILL,
            description: 'Kill 1 Scouter',
            target: 1,
            targetType: 'scouter'
        }],
        rewards: [{
            type: RewardType.COSMOS,
            amount: 100
        }],
        levelRequirement: 1,
        repeatable: false
    });


    QuestRegistry.register({
        id: 'kill_scouter_2',
        title: 'Scouter Hunter',
        description: 'You have proven your worth. Now kill 5 to become a true hunter.',
        type: 'kill',
        objectives: [{
            id: 'kill_scouter_obj',
            type: ObjectiveType.KILL,
            description: 'Kill 5 Scouters',
            target: 5,
            targetType: 'scouter'
        }],
        rewards: [
            { type: RewardType.CREDITS, amount: 500 },
            { type: RewardType.COSMOS, amount: 200 },
            { type: RewardType.EXPERIENCE, amount: 100 }
        ],
        prerequisites: ['kill_scouter_1'],
        levelRequirement: 2,
        repeatable: false
    });

    QuestRegistry.register({
        id: 'kill_guard_1',
        title: 'Broken Patrol',
        description: 'A Guard patrol is roaming nearby. Take them out.',
        type: 'kill',
        objectives: [{
            id: 'kill_guard_1_obj',
            type: ObjectiveType.KILL,
            description: 'Kill 3 Guards',
            target: 3,
            targetType: 'guard'
        }],
        rewards: [
            { type: RewardType.CREDITS, amount: 400 },
            { type: RewardType.EXPERIENCE, amount: 150 }
        ],
        levelRequirement: 2,
        repeatable: false
    });

    QuestRegistry.register({
        id: 'kill_scouter_3',
        title: 'Eyes in the Sky',
        description: 'Too many Scouters are watching your movements.',
        type: 'kill',
        objectives: [{
            id: 'kill_scouter_3_obj',
            type: ObjectiveType.KILL,
            description: 'Kill 8 Scouters',
            target: 8,
            targetType: 'scouter'
        }],
        rewards: [
            { type: RewardType.COSMOS, amount: 250 },
            { type: RewardType.EXPERIENCE, amount: 200 }
        ],
        prerequisites: ['kill_scouter_2'],
        levelRequirement: 3,
        repeatable: false
    });

    QuestRegistry.register({
        id: 'kill_pyramid_1',
        title: 'Strange Geometry',
        description: 'Pyramid units have appeared unexpectedly.',
        type: 'kill',
        objectives: [{
            id: 'kill_pyramid_1_obj',
            type: ObjectiveType.KILL,
            description: 'Kill 2 Pyramid Units',
            target: 2,
            targetType: 'pyramid'
        }],
        rewards: [
            { type: RewardType.CREDITS, amount: 700 },
            { type: RewardType.COSMOS, amount: 400 },
            { type: RewardType.EXPERIENCE, amount: 300 }
        ],
        levelRequirement: 4,
        repeatable: false
    });

    QuestRegistry.register({
        id: 'kill_guard_2',
        title: 'Heavy Resistance',
        description: 'Guards are reinforcing their positions.',
        type: 'kill',
        objectives: [{
            id: 'kill_guard_2_obj',
            type: ObjectiveType.KILL,
            description: 'Kill 7 Guards',
            target: 7,
            targetType: 'guard'
        }],
        rewards: [
            { type: RewardType.CREDITS, amount: 900 },
            { type: RewardType.EXPERIENCE, amount: 400 }
        ],
        prerequisites: ['kill_guard_1'],
        levelRequirement: 5,
        repeatable: false
    });

    QuestRegistry.register({
        id: 'kill_scouter_4',
        title: 'Signal Interference',
        description: 'Scouter signals are overwhelming the area.',
        type: 'kill',
        objectives: [{
            id: 'kill_scouter_4_obj',
            type: ObjectiveType.KILL,
            description: 'Kill 15 Scouters',
            target: 15,
            targetType: 'scouter'
        }],
        rewards: [
            { type: RewardType.CREDITS, amount: 1200 },
            { type: RewardType.COSMOS, amount: 500 },
            { type: RewardType.EXPERIENCE, amount: 600 }
        ],
        levelRequirement: 6,
        repeatable: false
    });

    QuestRegistry.register({
        id: 'kill_pyramid_2',
        title: 'Impossible Angles',
        description: 'The Pyramid presence is growing.',
        type: 'kill',
        objectives: [{
            id: 'kill_pyramid_2_obj',
            type: ObjectiveType.KILL,
            description: 'Kill 6 Pyramid Units',
            target: 6,
            targetType: 'pyramid'
        }],
        rewards: [
            { type: RewardType.CREDITS, amount: 1800 },
            { type: RewardType.COSMOS, amount: 800 },
            { type: RewardType.EXPERIENCE, amount: 900 }
        ],
        prerequisites: ['kill_pyramid_1'],
        levelRequirement: 8,
        repeatable: false
    });

    QuestRegistry.register({
        id: 'kill_kronos_1',
        title: 'Echo of Kronos',
        description: 'A fragment of Kronos power has manifested.',
        type: 'kill',
        objectives: [{
            id: 'kill_kronos_1_obj',
            type: ObjectiveType.KILL,
            description: 'Kill 1 Kronos Entity',
            target: 1,
            targetType: 'kronos'
        }],
        rewards: [
            { type: RewardType.COSMOS, amount: 2000 },
            { type: RewardType.EXPERIENCE, amount: 1500 },
            { type: RewardType.HONOR, amount: 1 }
        ],
        levelRequirement: 12,
        repeatable: false
    });

    QuestRegistry.register({
        id: 'kill_guard_3',
        title: 'Last Line',
        description: 'The Guards are making a final stand.',
        type: 'kill',
        objectives: [{
            id: 'kill_guard_3_obj',
            type: ObjectiveType.KILL,
            description: 'Kill 15 Guards',
            target: 15,
            targetType: 'guard'
        }],
        rewards: [
            { type: RewardType.CREDITS, amount: 2200 },
            { type: RewardType.EXPERIENCE, amount: 1200 }
        ],
        levelRequirement: 14,
        repeatable: false
    });

    QuestRegistry.register({
        id: 'kill_scouter_5',
        title: 'Light Show',
        description: 'Scouters are swarming. Take down a large group to clear the path.',
        type: 'kill',
        objectives: [{
            id: 'kill_scouter_5_obj',
            type: ObjectiveType.KILL,
            description: 'Kill 20 Scouters',
            target: 20,
            targetType: 'scouter'
        }],
        rewards: [
            { type: RewardType.CREDITS, amount: 2500 },
            { type: RewardType.COSMOS, amount: 1000 },
            { type: RewardType.EXPERIENCE, amount: 1200 }
        ],
        levelRequirement: 18,
        repeatable: false
    });

    QuestRegistry.register({
        id: 'kill_scouter_6',
        title: 'Deep Space Sweeper',
        description: 'The outermost rim is infested. Clean them up.',
        type: 'kill',
        objectives: [{
            id: 'kill_scouter_6_obj',
            type: ObjectiveType.KILL,
            description: 'Kill 40 Scouters',
            target: 40,
            targetType: 'scouter'
        }],
        rewards: [
            { type: RewardType.CREDITS, amount: 5000 },
            { type: RewardType.COSMOS, amount: 2000 },
            { type: RewardType.EXPERIENCE, amount: 3000 }
        ],
        levelRequirement: 25,
        repeatable: true
    });

    // Guards Expansion
    QuestRegistry.register({
        id: 'kill_guard_4',
        title: 'Fortress Breaker',
        description: 'Guard formations are shielding sensitive areas.',
        type: 'kill',
        objectives: [{
            id: 'kill_guard_4_obj',
            type: ObjectiveType.KILL,
            description: 'Kill 10 Guards',
            target: 10,
            targetType: 'guard'
        }],
        rewards: [
            { type: RewardType.CREDITS, amount: 3000 },
            { type: RewardType.EXPERIENCE, amount: 2000 }
        ],
        levelRequirement: 20,
        repeatable: false
    });

    QuestRegistry.register({
        id: 'kill_guard_5',
        title: 'Iron Phalanx',
        description: 'Elite Guard units have taken over the sector.',
        type: 'kill',
        objectives: [{
            id: 'kill_guard_5_obj',
            type: ObjectiveType.KILL,
            description: 'Kill 25 Guards',
            target: 25,
            targetType: 'guard'
        }],
        rewards: [
            { type: RewardType.CREDITS, amount: 8000 },
            { type: RewardType.EXPERIENCE, amount: 6000 },
            { type: RewardType.HONOR, amount: 10 }
        ],
        levelRequirement: 35,
        repeatable: true
    });

    // Pyramids Expansion
    QuestRegistry.register({
        id: 'kill_pyramid_3',
        title: 'Fractal Annihilation',
        description: 'Pyramids are multiplying at an alarming rate.',
        type: 'kill',
        objectives: [{
            id: 'kill_pyramid_3_obj',
            type: ObjectiveType.KILL,
            description: 'Kill 12 Pyramids',
            target: 12,
            targetType: 'pyramid'
        }],
        rewards: [
            { type: RewardType.CREDITS, amount: 5000 },
            { type: RewardType.COSMOS, amount: 1500 },
            { type: RewardType.EXPERIENCE, amount: 4000 }
        ],
        levelRequirement: 22,
        prerequisites: ['kill_pyramid_2'],
        repeatable: false
    });

    QuestRegistry.register({
        id: 'kill_pyramid_4',
        title: 'Geometry of War',
        description: 'Master the combat against the advanced Pyramid formations.',
        type: 'kill',
        objectives: [{
            id: 'kill_pyramid_4_obj',
            type: ObjectiveType.KILL,
            description: 'Kill 30 Pyramids',
            target: 30,
            targetType: 'pyramid'
        }],
        rewards: [
            { type: RewardType.CREDITS, amount: 15000 },
            { type: RewardType.COSMOS, amount: 5000 },
            { type: RewardType.EXPERIENCE, amount: 12000 },
            { type: RewardType.HONOR, amount: 25 }
        ],
        levelRequirement: 45,
        repeatable: true
    });

    // Kronos Expansion (Bosses)
    QuestRegistry.register({
        id: 'kill_kronos_2',
        title: 'Wrath of the Giant',
        description: 'Another Kronos Warship has entered the fray.',
        type: 'kill',
        objectives: [{
            id: 'kill_kronos_2_obj',
            type: ObjectiveType.KILL,
            description: 'Kill 1 Kronos Warship',
            target: 1,
            targetType: 'kronos'
        }],
        rewards: [
            { type: RewardType.CREDITS, amount: 10000 },
            { type: RewardType.COSMOS, amount: 5000 },
            { type: RewardType.EXPERIENCE, amount: 10000 },
            { type: RewardType.HONOR, amount: 50 }
        ],
        levelRequirement: 20,
        prerequisites: ['kill_kronos_1'],
        repeatable: false
    });

    QuestRegistry.register({
        id: 'kill_kronos_3',
        title: 'Fleet Admiral Slayer',
        description: 'Take down the command Kronos units.',
        type: 'kill',
        objectives: [{
            id: 'kill_kronos_3_obj',
            type: ObjectiveType.KILL,
            description: 'Kill 5 Kronos Warships',
            target: 5,
            targetType: 'kronos'
        }],
        rewards: [
            { type: RewardType.CREDITS, amount: 50000 },
            { type: RewardType.COSMOS, amount: 20000 },
            { type: RewardType.EXPERIENCE, amount: 50000 },
            { type: RewardType.HONOR, amount: 200 }
        ],
        levelRequirement: 40,
        repeatable: true
    });

    // Mixed/Complex Operations
    QuestRegistry.register({
        id: 'kill_operation_1',
        title: 'Sector Sweep',
        description: 'Wipe out a mixed force of hostiles.',
        type: 'kill',
        objectives: [
            { id: 'op1_obj1', type: ObjectiveType.KILL, description: 'Kill Scouters', target: 10, targetType: 'scouter' },
            { id: 'op1_obj2', type: ObjectiveType.KILL, description: 'Kill Guards', target: 5, targetType: 'guard' }
        ],
        rewards: [
            { type: RewardType.CREDITS, amount: 5000 },
            { type: RewardType.EXPERIENCE, amount: 3000 }
        ],
        levelRequirement: 15
    });

    QuestRegistry.register({
        id: 'kill_operation_2',
        title: 'The Great Purge',
        description: 'A massive cleansing effort is required.',
        type: 'kill',
        objectives: [
            { id: 'op2_obj1', type: ObjectiveType.KILL, description: 'Kill Scouters', target: 50, targetType: 'scouter' },
            { id: 'op2_obj2', type: ObjectiveType.KILL, description: 'Kill Guards', target: 30, targetType: 'guard' },
            { id: 'op2_obj3', type: ObjectiveType.KILL, description: 'Kill Pyramids', target: 15, targetType: 'pyramid' }
        ],
        rewards: [
            { type: RewardType.CREDITS, amount: 25000 },
            { type: RewardType.COSMOS, amount: 10000 },
            { type: RewardType.EXPERIENCE, amount: 20000 },
            { type: RewardType.HONOR, amount: 100 }
        ],
        levelRequirement: 30
    });

    QuestRegistry.register({
        id: 'kill_omega',
        title: 'The Omega Protocol',
        description: 'Execute the final combat protocol.',
        type: 'kill',
        objectives: [
            { id: 'omega_obj1', type: ObjectiveType.KILL, description: 'Kill Scouters', target: 100, targetType: 'scouter' },
            { id: 'omega_obj2', type: ObjectiveType.KILL, description: 'Kill Guards', target: 50, targetType: 'guard' },
            { id: 'omega_obj3', type: ObjectiveType.KILL, description: 'Kill Pyramids', target: 25, targetType: 'pyramid' },
            { id: 'omega_obj4', type: ObjectiveType.KILL, description: 'Kill Kronos', target: 10, targetType: 'kronos' }
        ],
        rewards: [
            { type: RewardType.CREDITS, amount: 100000 },
            { type: RewardType.COSMOS, amount: 50000 },
            { type: RewardType.EXPERIENCE, amount: 100000 },
            { type: RewardType.HONOR, amount: 1000 }
        ],
        levelRequirement: 50
    });

    // Add many more automatically using a loop for various levels
    for (let i = 1; i <= 20; i++) {
        const difficulty = i * 2;
        const targetType = i % 2 === 0 ? 'Guard' : 'Pyramid';
        QuestRegistry.register({
            id: `kill_bounty_${i}`,
            title: `Bounty Target`,
            description: `A high-priority target has been marked for elimination.`,
            type: 'kill',
            objectives: [{
                id: `kill_bounty_${i}_obj`,
                type: ObjectiveType.KILL,
                description: `Kill ${difficulty} ${targetType}s`,
                target: difficulty,
                targetType: targetType.toLowerCase() as any
            }],
            rewards: [
                { type: RewardType.CREDITS, amount: 1000 * i },
                { type: RewardType.EXPERIENCE, amount: 500 * i }
            ],
            levelRequirement: 10 + i
        });
    }

    for (let i = 1; i <= 15; i++) {
        QuestRegistry.register({
            id: `kill_skirmish_${i}`,
            title: `Skirmish Operation`,
            description: `Engage enemy forces in the designated sector.`,
            type: 'kill',
            objectives: [
                { id: `skirmish_${i}_obj1`, type: ObjectiveType.KILL, description: 'Eliminate Scouters', target: 10 + i, targetType: 'scouter' },
                { id: `skirmish_${i}_obj2`, type: ObjectiveType.KILL, description: 'Neutralize Guards', target: 5 + i, targetType: 'guard' }
            ],
            rewards: [
                { type: RewardType.CREDITS, amount: 2000 * i },
                { type: RewardType.EXPERIENCE, amount: 1000 * i }
            ],
            levelRequirement: 5 + (i * 2)
        });
    }
}
