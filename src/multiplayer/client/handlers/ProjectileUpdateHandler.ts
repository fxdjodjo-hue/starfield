import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import { InterpolationTarget } from '../../../entities/spatial/InterpolationTarget';

/**
 * Gestisce gli aggiornamenti di posizione dei proiettili - UNIFICATO
 * Ora aggiorna direttamente l'InterpolationTarget invece di usare RemoteProjectileSystem
 */
export class ProjectileUpdateHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.PROJECTILE_UPDATE);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    // Trova l'entità proiettile per projectileId
    // I proiettili ora sono gestiti dal ProjectileSystem normale
    const ecs = networkSystem.getECS();
    if (!ecs) return;

    // Cerca tra tutte le entità con InterpolationTarget (proiettili remoti)
    const entities = ecs.getEntitiesWithComponents(InterpolationTarget);
    for (const entity of entities) {
      // Controlla se questo è il proiettile giusto (usando il campo id del componente Projectile)
      const projectile = ecs.getComponent(entity, require('../../../entities/combat/Projectile').Projectile);
      if (projectile && (projectile as any).id === message.projectileId) {
        // Trovato! Aggiorna l'interpolazione
        const interpolation = ecs.getComponent(entity, InterpolationTarget);
        if (interpolation) {
          interpolation.updateTargetFromNetwork(message.position.x, message.position.y);
        }
        break;
      }
    }
  }
}
