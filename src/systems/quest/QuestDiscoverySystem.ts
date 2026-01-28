import { System } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { Npc } from '../../entities/ai/Npc';
import { QuestTrackingSystem } from './QuestTrackingSystem';
import { QuestEventType } from '../../config/QuestConfig';

interface POI {
    name: string;
    x: number;
    y: number;
    radius: number;
}

/**
 * QuestDiscoverySystem - Monitors player position to trigger exploration events
 */
export class QuestDiscoverySystem extends System {
    private trackingSystem: QuestTrackingSystem;
    private discoveryPoints: POI[] = [
        { name: 'Space Station', x: 0, y: 0, radius: 500 },
        { name: 'Mining Sector', x: 15000, y: 10000, radius: 800 },
        { name: 'Nebula Outpost', x: 2000, y: 12000, radius: 600 },
        { name: 'Frontier Outpost', x: -12000, y: 8000, radius: 700 },
        { name: 'Event Horizon', x: -5000, y: -15000, radius: 1000 }
    ];
    private visitedLocations: Set<string> = new Set();
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
        const entities = this.ecs.getEntitiesWithComponents(Transform).filter(e => !this.ecs.hasComponent(e, Npc));
        if (entities.length === 0) return;

        const playerEntity = entities[0];
        const transform = this.ecs.getComponent(playerEntity, Transform);
        if (!transform) return;

        // Check distance to each POI
        for (const poi of this.discoveryPoints) {
            const dx = transform.x - poi.x;
            const dy = transform.y - poi.y;
            const distanceSq = dx * dx + dy * dy;

            if (distanceSq <= poi.radius * poi.radius) {
                // Trigger event if first time in this session (tracking system will handle actual quest persistence)
                // Note: We don't use the visitedLocations set for persistence across sessions, 
                // just to avoid spamming events in a single frame.
                // The QuestTrackingSystem and QuestManager will handle if it's actually a new discovery for the quest.
                this.trackingSystem.triggerEvent({
                    type: QuestEventType.LOCATION_VISITED,
                    targetId: poi.name,
                    amount: 1
                });
            }
        }
    }
}
