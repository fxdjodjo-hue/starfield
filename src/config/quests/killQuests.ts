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
        title: 'No More Witnesses',
        description: 'Eliminate all remaining Scouters in the sector.',
        type: 'kill',
        objectives: [{
            id: 'kill_scouter_5_obj',
            type: ObjectiveType.KILL,
            description: 'Kill 25 Scouters',
            target: 25,
            targetType: 'scouter'
        }],
        rewards: [
            { type: RewardType.CREDITS, amount: 3000 },
            { type: RewardType.COSMOS, amount: 1200 },
            { type: RewardType.EXPERIENCE, amount: 1500 }
        ],
        levelRequirement: 15,
        repeatable: false
    });
}
