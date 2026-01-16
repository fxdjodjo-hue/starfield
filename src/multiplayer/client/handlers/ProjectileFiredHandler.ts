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

    // Per il player locale, applica pattern ritmico per animazione visiva
    // Il danno è sempre applicato ogni 800ms dal server, ma l'animazione segue il pattern
    if (isLocalPlayer) {
      const rhythmicManager = networkSystem.getRhythmicAnimationManager();
      
      // Schedula animazione (suono + proiettile) seguendo pattern ritmico
      rhythmicManager.scheduleAnimation(() => {
        // Riproduci suono sparo
        const audioSystem = networkSystem.getAudioSystem();
        if (audioSystem) {
          audioSystem.playSound('laser', 0.4, false, true);
        }
        
        // Mostra proiettile (sempre mostrato, ma con timing ritmico)
        this.showProjectile(message, networkSystem, isLocalPlayer);
      });
    } else {
      // Per altri player/NPC, mostra subito (no pattern ritmico)
      const audioSystem = networkSystem.getAudioSystem();
      if (audioSystem) {
        if (message.playerId.startsWith('npc_')) {
          audioSystem.playSound('scouterLaser', 0.25, false, true);
        }
      }
      
      this.showProjectile(message, networkSystem, isLocalPlayer);
    }
  }

  private showProjectile(message: ProjectileFiredMessage, networkSystem: ClientNetworkSystem, isLocalPlayer: boolean): void {

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
