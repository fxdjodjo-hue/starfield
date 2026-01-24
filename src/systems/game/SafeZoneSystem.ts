import { System } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { Npc } from '../../entities/ai/Npc';
import { CONFIG } from '../../core/utils/config/GameConfig';
import { UiSystem } from '../ui/UiSystem';

/**
 * SafeZoneSystem - Gestisce il rilevamento delle zone sicure lato client
 * Responsabilità: Monitorare la posizione del player e aggiornare l'interfaccia
 */
export class SafeZoneSystem extends System {
    private uiSystem: UiSystem;
    private isCurrentlySafe: boolean = false;

    constructor(ecs: ECS, uiSystem: UiSystem) {
        super(ecs);
        this.uiSystem = uiSystem;
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
    }
}
