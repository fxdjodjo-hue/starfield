import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import type { ProjectileFiredMessage } from '../../../config/NetworkConfig';

/**
 * Gestisce il messaggio projectile_fired quando un giocatore spara
 */
export class ProjectileFiredHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.PROJECTILE_FIRED);
  }

  handle(message: ProjectileFiredMessage, networkSystem: ClientNetworkSystem): void {
    const isLocalPlayer = networkSystem.getLocalClientId() === message.playerId;

    // Riproduci suono sparo sincronizzato
    const audioSystem = networkSystem.getAudioSystem();
    const timestamp = Date.now();

    if (audioSystem) {
      if (isLocalPlayer) {
        // Suono laser del player
        audioSystem.playSound('laser', 0.4, false, true);
      } else if (message.playerId.startsWith('npc_')) {
        // Suono laser degli NPC
        audioSystem.playSound('scouterLaser', 0.25, false, true);
      } else {
      }
    } else {
      console.warn(`🔊 [AUDIO] No audio system available for projectile ${message.projectileId} at ${timestamp}`);
    }

    const remoteProjectileSystem = networkSystem.getRemoteProjectileSystem();
    if (!remoteProjectileSystem) {
      console.error('[CLIENT] RemoteProjectileSystem not available for projectile fired');
      return;
    }

    // Per i proiettili del giocatore locale, usa posizione centrata sul player locale
    // per evitare disallineamenti dovuti alla latenza di rete
    let projectilePosition = message.position;

    if (isLocalPlayer) {
      // Usa posizione del player locale invece di quella del server
      const localPlayerPos = networkSystem.getLocalPlayerPosition();
      projectilePosition = {
        x: localPlayerPos.x,
        y: localPlayerPos.y
      };
    }

    remoteProjectileSystem.addRemoteProjectile(
      message.projectileId,
      message.playerId,
      projectilePosition,
      message.velocity,
      message.damage,
      message.projectileType,
      message.targetId,
      isLocalPlayer // Passa flag per indicare se è il player locale
    );
  }
}
