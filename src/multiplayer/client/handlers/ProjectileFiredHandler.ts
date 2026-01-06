import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';

/**
 * Gestisce il messaggio projectile_fired quando un giocatore spara
 */
export class ProjectileFiredHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.PROJECTILE_FIRED);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    const isLocalPlayer = networkSystem.getLocalClientId() === message.playerId;
    console.log(`🔫 [CLIENT] Projectile fired: ${message.projectileId} by ${message.playerId}${isLocalPlayer ? ' (LOCAL)' : ''} - Target: ${message.targetId}`);

    // Riproduci suono sparo sincronizzato
    const audioSystem = networkSystem.getAudioSystem();
    const timestamp = Date.now();

    if (audioSystem) {
      if (isLocalPlayer) {
        // Suono laser del player
        audioSystem.playSound('laser', 0.4, false, true);
        console.log(`🔊 [AUDIO] Player laser sound played for projectile ${message.projectileId} at ${timestamp}`);
      } else if (message.playerId.startsWith('npc_')) {
        // Suono laser degli NPC - QUESTO NON DOVREBBE SUCCEDERE!
        audioSystem.playSound('scouterLaser', 0.25, false, true);
        console.log(`🚨 [ALERT] NPC ATTACKING! Laser sound played for projectile ${message.projectileId} from ${message.playerId} at ${timestamp}`);
        console.log(`🚨 [ALERT] NPC attack detected - check server code, performNpcAttack should be commented out!`);
      } else {
        console.log(`🔊 [AUDIO] Other projectile sound for ${message.playerId} - not playing audio at ${timestamp}`);
      }
    } else {
      console.warn(`🔊 [AUDIO] No audio system available for projectile ${message.projectileId} at ${timestamp}`);
    }

    const remoteProjectileSystem = networkSystem.getRemoteProjectileSystem();
    if (!remoteProjectileSystem) {
      console.error('[CLIENT] RemoteProjectileSystem not available for projectile fired');
      return;
    }

    // Aggiungi sempre il proiettile al sistema remoto per renderizzarlo
    // Anche i proiettili del giocatore locale vengono creati dal server
    remoteProjectileSystem.addRemoteProjectile(
      message.projectileId,
      message.playerId,
      message.position,
      message.velocity,
      message.damage,
      message.projectileType,
      message.targetId
    );
  }
}
