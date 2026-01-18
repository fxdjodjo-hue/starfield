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
    const isLocalPlayer = message.playerId === localAuthId || message.playerId === localClientId;

    // Per missili del giocatore locale, non aggiungere a RemoteProjectileSystem
    // perché sono già creati localmente via ProjectileFactory
    if (isLocalPlayer && message.projectileType === 'missile') {
      return;
    }

    // Registra quando un missile viene sparato per evitare di riprodurre il suono di esplosione troppo presto
    if (message.projectileType === 'missile') {
      const destroyedHandler = networkSystem.getMessageRouter()?.getHandler(MESSAGE_TYPES.PROJECTILE_DESTROYED);
      if (destroyedHandler && typeof (destroyedHandler as any).registerMissileFire === 'function') {
        (destroyedHandler as any).registerMissileFire(message.projectileId, Date.now());
      }
    }

    // Per il player locale, applica pattern ritmico per animazione visiva
    // Il danno è sempre applicato ogni 800ms dal server, ma l'animazione segue il pattern
    if (isLocalPlayer) {
      if (message.projectileType === 'missile') {
        // ✅ MISSILI: già creati localmente dal MissileManager
        // Non chiamare showProjectile per evitare duplicazione e confusione con laser
        const audioSystem = networkSystem.getAudioSystem();
        if (audioSystem) {
          audioSystem.playSound('rocketStart', 0.02, false, true); // Volume molto basso per missili
        }

        // ⚠️ NON chiamare showProjectile - missile già creato localmente!
      } else {
        // ❌ LASER: continua a usare il pattern ritmico
        const rhythmicManager = networkSystem.getRhythmicAnimationManager();

        // Schedula animazione (suono + proiettile) seguendo pattern ritmico
        rhythmicManager.scheduleAnimation(() => {
          // Riproduci suono laser
          const audioSystem = networkSystem.getAudioSystem();
          if (audioSystem) {
            audioSystem.playSound('laser', 0.05, false, true);
          }

          // ✅ CHIAMA showProjectile anche per player locale!
          // Tutti i proiettili vengono gestiti dal server e RemoteProjectileSystem
          this.showProjectile(message, networkSystem, isLocalPlayer);
        });
      }
    } else {
      // Per altri player/NPC, mostra subito (no pattern ritmico)
      const audioSystem = networkSystem.getAudioSystem();
      if (audioSystem) {
        if (message.playerId.startsWith('npc_')) {
          audioSystem.playSound('scouterLaser', 0.05, false, true);
        } else if (message.projectileType === 'missile') {
          audioSystem.playSound('rocketStart', 0.02, false, true); // Volume molto basso per missili remoti
        }
      }

      this.showProjectile(message, networkSystem, isLocalPlayer);
    }
  }

  private showProjectile(message: ProjectileFiredMessage, networkSystem: ClientNetworkSystem, isLocalPlayer: boolean): void {
    // ✅ TUTTI i proiettili (incluso quelli del player) vengono gestiti dal RemoteProjectileSystem
    // Il server è autoritativo per tutti i proiettili - niente creazione locale per il player

    const remoteProjectileSystem = networkSystem.getRemoteProjectileSystem();
    if (!remoteProjectileSystem) {
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
