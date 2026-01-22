import { ECS } from '../../infrastructure/ecs/ECS';
import { RemotePlayer } from '../../entities/player/RemotePlayer';
import { RemoteNpcSystem } from './RemoteNpcSystem';

/**
 * Sistema per tracciare lo stato di combattimento dei giocatori remoti
 * Gestisce quali giocatori remoti stanno combattendo contro quali NPC
 */
export class RemoteCombatTracker {
  private ecs: ECS;
  private remoteNpcSystem: RemoteNpcSystem;

  // Mappa playerId -> npcId per tracciare chi sta combattendo contro chi
  private remotePlayerCombatState: Map<string, { npcId: string, startTime: number }> = new Map();

  constructor(ecs: ECS, remoteNpcSystem: RemoteNpcSystem) {
    this.ecs = ecs;
    this.remoteNpcSystem = remoteNpcSystem;
  }

  /**
   * Aggiorna lo stato di combattimento di un giocatore remoto
   */
  updateRemotePlayerCombat(playerId: string, npcId: string | null, isAttacking: boolean): void {
    if (isAttacking && npcId) {
      // Giocatore remoto inizia combattimento
      this.remotePlayerCombatState.set(playerId, {
        npcId: npcId,
        startTime: Date.now()
      });
      // console.log(`[REMOTE_COMBAT] Player ${playerId} started combat against NPC ${npcId}`);
    } else {
      // Giocatore remoto interrompe combattimento
      if (this.remotePlayerCombatState.has(playerId)) {
        this.remotePlayerCombatState.delete(playerId);
        // console.log(`[REMOTE_COMBAT] Player ${playerId} stopped combat`);
      }
    }
  }

  /**
   * Ottiene lo stato di combattimento di un giocatore remoto
   */
  getRemotePlayerCombatState(playerId: string): { npcId: string, startTime: number } | null {
    return this.remotePlayerCombatState.get(playerId) || null;
  }

  /**
   * Verifica se un giocatore remoto è in combattimento
   */
  isRemotePlayerInCombat(playerId: string): boolean {
    return this.remotePlayerCombatState.has(playerId);
  }

  /**
   * Ottiene tutti i giocatori remoti attualmente in combattimento
   */
  getActiveRemoteCombatPlayers(): Array<{ playerId: string, npcId: string, startTime: number }> {
    const activePlayers: Array<{ playerId: string, npcId: string, startTime: number }> = [];

    for (const [playerId, combatState] of this.remotePlayerCombatState.entries()) {
      activePlayers.push({
        playerId,
        npcId: combatState.npcId,
        startTime: combatState.startTime
      });
    }

    return activePlayers;
  }

  /**
   * Ottiene l'entity ID del giocatore remoto (se esiste)
   */
  getRemotePlayerEntityId(playerId: string): number | null {
    const remotePlayerEntities = this.ecs.getEntitiesWithComponents(RemotePlayer);

    for (const entity of remotePlayerEntities) {
      const remotePlayerComponent = this.ecs.getComponent(entity, RemotePlayer);
      if (remotePlayerComponent && remotePlayerComponent.clientId === playerId) {
        return entity.id;
      }
    }

    return null;
  }

  /**
   * Ottiene l'entity ID dell'NPC target (se esiste)
   */
  getNpcEntityId(npcId: string): number | null {
    return this.remoteNpcSystem.getRemoteNpcEntity(npcId) ?? null;
  }

  /**
   * Pulisce tutti gli stati di combattimento (per riconnessione/disconnessione)
   */
  clearAllCombatStates(): void {
    this.remotePlayerCombatState.clear();
    // console.log('[REMOTE_COMBAT] Cleared all remote player combat states');
  }

  /**
   * Rimuove lo stato di combattimento per un giocatore specifico
   */
  removeRemotePlayerCombat(playerId: string): void {
    this.remotePlayerCombatState.delete(playerId);
  }

  /**
   * Aggiorna periodicamente per pulizia stati obsoleti
   */
  update(): void {
    const now = Date.now();
    const maxCombatDuration = 300000; // 5 minuti max per combattimento

    for (const [playerId, combatState] of this.remotePlayerCombatState.entries()) {
      if (now - combatState.startTime > maxCombatDuration) {
        console.warn(`[REMOTE_COMBAT] Removing stale combat state for player ${playerId} (timeout)`);
        this.remotePlayerCombatState.delete(playerId);
      }
    }
  }
}