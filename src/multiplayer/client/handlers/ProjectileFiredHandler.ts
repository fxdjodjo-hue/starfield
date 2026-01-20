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
    // Identifica il giocatore locale usando controllo ibrido (authId + localClientId)
    // Per robustezza: usa entrambi gli identificatori per evitare mismatch
    const localAuthId = networkSystem.gameContext.authId;
    const localClientId = networkSystem.getLocalClientId();
    const isLocalPlayer = message.playerId === String(localAuthId) || message.playerId === String(localClientId);

    // Missile logic removed - missiles are no longer supported

    // Gestisci audio e visualizzazione per tutti i proiettili
    const audioSystem = networkSystem.getAudioSystem();
    if (audioSystem) {
      if (message.playerId.startsWith('npc_')) {
        // Suono NPC gestito quando arrivano i loro proiettili dal server
        audioSystem.playSound('scouterLaser', 0.05, false, true);
      }
      // Suono laser player gestito lato client nei laser visivi per responsività immediata
    }

    // Mostra proiettile per tutti (player locale incluso)
    // Tutti i proiettili vengono gestiti dal server e RemoteProjectileSystem
    this.showProjectile(message, networkSystem, isLocalPlayer);
  }

  private showProjectile(message: ProjectileFiredMessage, networkSystem: ClientNetworkSystem, isLocalPlayer: boolean): void {
    // ✅ UNIFICATO: Crea proiettili remoti direttamente con ProjectileFactory
    // Ora tutti i proiettili seguono lo stesso flusso del ProjectileSystem

    const ecs = networkSystem.getECS();
    if (!ecs) return;

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


    // Import dinamico per evitare dipendenze circolari
    import('../../../core/domain/ProjectileFactory').then(({ ProjectileFactory }) => {
      ProjectileFactory.createRemoteUnified(
        ecs,
        message.projectileId,
        message.playerId,
        projectilePosition,
        message.velocity,
        message.damage,
        message.projectileType,
        message.targetId
      );
    });
  }

}
