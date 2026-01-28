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

    // Quest di uccisione multipla (esempio per scalabilità futura)
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
}
