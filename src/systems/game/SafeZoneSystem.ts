import { System } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { Npc } from '../../entities/ai/Npc';
import { CONFIG } from '../../core/utils/config/GameConfig';
import { UiSystem } from '../ui/UiSystem';

import AudioSystem from '../audio/AudioSystem';

/**
 * SafeZoneSystem - Gestisce il rilevamento delle zone sicure lato client
 * Responsabilità: Monitorare la posizione del player e aggiornare l'interfaccia
 */
export class SafeZoneSystem extends System {
    private uiSystem: UiSystem;
    private audioSystem: AudioSystem;
    private isCurrentlySafe: boolean = false;

    constructor(ecs: ECS, uiSystem: UiSystem, audioSystem: AudioSystem) {
        super(ecs);
        this.uiSystem = uiSystem;
        this.audioSystem = audioSystem;
    }

    update(_deltaTime: number): void {
        // Trova il player locale (entità con Transform e nessuna componente NPC)
        // Nota: in un sistema più avanzato potremmo usare una specifica componente LocalPlayer
        const playerEntities = this.ecs.getEntitiesWithComponents(Transform)
            .filter(entity => !this.ecs.hasComponent(entity, Npc));

        if (playerEntities.length === 0) return;

        const playerTransform = this.ecs.getComponent(playerEntities[0], Transform);
        if (!playerTransform) return;

        // Controlla se il player è in una safe zone
        let inSafeZone = false;
        for (const zone of CONFIG.SAFE_ZONES) {
            const dx = playerTransform.x - zone.x;
            const dy = playerTransform.y - zone.y;
            const distSq = dx * dx + dy * dy;

            if (distSq <= zone.radius * zone.radius) {
                inSafeZone = true;
                break;
            }
        }

        // Aggiorna UI solo se lo stato è cambiato
        if (inSafeZone !== this.isCurrentlySafe) {
            this.isCurrentlySafe = inSafeZone;
            this.uiSystem.setSafeZone(inSafeZone);
        }

        this.updateAmbience(playerTransform);
    }

    private updateAmbience(playerTransform: Transform): void {
        const spaceStationZone = CONFIG.SAFE_ZONES.find(z => z.name === 'Space Station');
        if (!spaceStationZone) return;

        // Check if map matches (prevents ghost audio in other maps like Singularity)
        // Default to true if mapId is missing (backward compatibility)
        const isCorrectMap = !(spaceStationZone as any).mapId || (spaceStationZone as any).mapId === CONFIG.CURRENT_MAP;

        if (!this.audioSystem) {
            const systems = (this.ecs as any).systems || [];
            this.audioSystem = systems.find((s: any) => s.constructor.name === 'AudioSystem');
        }

        if (this.audioSystem) {
            let volume = 0;

            if (isCorrectMap) {
                const dx = playerTransform.x - spaceStationZone.x;
                const dy = playerTransform.y - spaceStationZone.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Full volume inside radius (800)
                // Fade out until radius + 2000 (2800)
                const fadeStart = spaceStationZone.radius;
                const fadeEnd = spaceStationZone.radius + 2000;

                if (dist <= fadeStart) {
                    volume = 1.0;
                } else if (dist < fadeEnd) {
                    volume = 1.0 - ((dist - fadeStart) / (fadeEnd - fadeStart));
                }

                // Reducing volume significantly (0.2 factor) for subtlety
                volume *= 0.02;
            } else {
                // Wrong map - force silence (fade out handled by audio system smoothing)
                volume = 0;
            }

            // Play or update volume
            // key: 'spaceStation' (registered in AudioConfig), category: 'effects'
            this.audioSystem.playAmbience('spaceStation', volume, 'effects');
        }
    }
}
