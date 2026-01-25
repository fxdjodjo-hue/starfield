import { System as BaseSystem } from '../../../infrastructure/ecs/System';
import { ECS } from '../../../infrastructure/ecs/ECS';
import { PlayerRole } from '../../../entities/player/PlayerRole';

/**
 * Sistema Rank - Questo sistema non calcola più i gradi localmente.
 * Il rank è Authoritative dal Database e viene sincronizzato tramite PlayerRole.
 */
export class RankSystem extends BaseSystem {
  private playerEntity: any = null;

  constructor(ecs: ECS) {
    super(ecs);
  }

  /**
   * Imposta l'entità player
   */
  setPlayerEntity(entity: any): void {
    this.playerEntity = entity;
  }

  /**
   * Ottiene il rank attuale. Corrisponde a playerRole.currentRank.
   * Se il server non ha ancora inviato i dati, restituisce il grado base.
   */
  calculateCurrentRank(): string {
    if (!this.playerEntity) return 'Basic Space Pilot';

    const playerRole = this.ecs.getComponent(this.playerEntity, PlayerRole);

    // Ranghi speciali hanno priorità
    if (playerRole?.isAdministrator) {
      return 'Administrator';
    }

    // IL GRADO DEVE VENIRE DAL SERVER (Database Authoritative)
    if (playerRole?.currentRank) {
      return playerRole.currentRank;
    }

    // Fallback durante il caricamento
    return 'Basic Space Pilot';
  }

  update(deltaTime: number): void {
    // Il sistema rank non ha più logica di aggiornamento periodico locale
  }
}
