import { System } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { Npc } from '../../entities/ai/Npc';
import { QuestTrackingSystem } from './QuestTrackingSystem';
import { QuestEventType, ObjectiveType } from '../../config/QuestConfig';
import { ActiveQuest } from '../../entities/quest/ActiveQuest';

/**
 * QuestDiscoverySystem - Monitors player position to trigger exploration events
 * based on active quest coordinates.
 */
export class QuestDiscoverySystem extends System {
    private trackingSystem: QuestTrackingSystem;
    private checkTimer: number = 0;
    private readonly CHECK_INTERVAL: number = 1000; // Check every 1 second

    constructor(ecs: ECS, trackingSystem: QuestTrackingSystem) {
        super(ecs);
        this.trackingSystem = trackingSystem;
    }

    update(deltaTime: number): void {
        this.checkTimer += deltaTime;
        if (this.checkTimer < this.CHECK_INTERVAL) return;
        this.checkTimer = 0;

        // Find player entity
        const entities = this.ecs.getEntitiesWithComponents(Transform, ActiveQuest).filter(e => !this.ecs.hasComponent(e, Npc));
        if (entities.length === 0) return;

        const playerEntity = entities[0];
        const transform = this.ecs.getComponent(playerEntity, Transform);
        const activeQuestComponent = this.ecs.getComponent(playerEntity, ActiveQuest);

        if (!transform || !activeQuestComponent) return;

        // Check active quest objectives for exploration targets with coordinates
        const activeQuests = activeQuestComponent.getActiveQuests();

        for (const quest of activeQuests) {
            for (const objective of quest.objectives) {
                // Only check EXPLORE objectives that have coordinates defined
                if (objective.type === ObjectiveType.EXPLORE && objective.x !== undefined && objective.y !== undefined) {
                    const radius = objective.radius || 500;
                    const dx = transform.x - objective.x;
                    const dy = transform.y - objective.y;
                    const distanceSq = dx * dx + dy * dy;

                    if (distanceSq <= radius * radius) {
                        // Trigger event using the objective's targetName or description as the identifier
                        // QuestTrackingSystem handles if this objective is already progressed/completed
                        this.trackingSystem.triggerEvent({
                            type: QuestEventType.LOCATION_VISITED,
                            targetId: objective.targetName || objective.id,
                            amount: 1
                        });
                    }
                }
            }
        }
    }
}
