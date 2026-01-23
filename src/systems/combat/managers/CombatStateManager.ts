import type { ECS } from '../../../infrastructure/ecs/ECS';
import type { Entity } from '../../../infrastructure/ecs/Entity';
import type { PlayerSystem } from '../../player/PlayerSystem';
import type { PlayerControlSystem } from '../../input/PlayerControlSystem';
import type { ClientNetworkSystem } from '../../../multiplayer/client/ClientNetworkSystem';
import type { LogSystem } from '../../rendering/LogSystem';
import type { CameraSystem } from '../../rendering/CameraSystem';
import type { GameContext } from '../../../infrastructure/engine/GameContext';
import { Transform } from '../../../entities/spatial/Transform';
import { Damage } from '../../../entities/combat/Damage';
import { SelectedNpc } from '../../../entities/combat/SelectedNpc';
import { Npc } from '../../../entities/ai/Npc';
import { DisplayManager } from '../../../infrastructure/display';
import { getPlayerRangeWidth, getPlayerRangeHeight } from '../../../config/PlayerConfig';

/**
 * Manages combat state: player combat processing, start/stop combat, logging
 */
export class CombatStateManager {
  private currentAttackTarget: number | null = null;
  private attackStartedLogged: boolean = false;
  private wasInCombat: boolean = false;
  private lastCombatLogTime: number = 0; // For throttling debug logs

  constructor(
    private readonly ecs: ECS,
    private readonly playerSystem: PlayerSystem,
    private readonly cameraSystem: CameraSystem,
    private readonly gameContext: GameContext,
    private readonly getPlayerControlSystem: () => PlayerControlSystem | null,
    private readonly getClientNetworkSystem: () => ClientNetworkSystem | null,
    private readonly getLogSystem: () => LogSystem | null
  ) {
    // Missile manager removed - missiles are no longer supported
  }

  /**
   * Gets current attack target
   */
  getCurrentAttackTarget(): number | null {
    return this.currentAttackTarget;
  }

  /**
   * Sets current attack target
   */
  setCurrentAttackTarget(targetId: number | null): void {
    this.currentAttackTarget = targetId;
  }

  /**
   * Processes player combat state and sends requests to server
   */
  processPlayerCombat(): void {
    // console.log(`[CLIENT_PROCESS_COMBAT] Processing player combat state`);

    const playerEntity = this.playerSystem.getPlayerEntity();
    const playerDamage = playerEntity ? this.ecs.getComponent(playerEntity, Damage) : null;

    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);


    // Debug log (only in dev, throttled to avoid spam)
    if (import.meta.env.DEV && selectedNpcs.length > 0) {
      const debugPlayerControlSystem = this.getPlayerControlSystem();
      const debugAttackActivated = debugPlayerControlSystem?.isAttackActivated() || false;
      const debugPlayerTransform = playerEntity ? this.ecs.getComponent(playerEntity, Transform) : null;
      const debugNpcTransform = selectedNpcs[0] ? this.ecs.getComponent(selectedNpcs[0], Transform) : null;

      if (debugPlayerTransform && debugNpcTransform && playerDamage) {
        // Controllo range rettangolare per il player
        const rangeWidth = getPlayerRangeWidth();
        const rangeHeight = getPlayerRangeHeight();
        const dx = Math.abs(debugNpcTransform.x - debugPlayerTransform.x);
        const dy = Math.abs(debugNpcTransform.y - debugPlayerTransform.y);
        const inRange = dx <= rangeWidth / 2 && dy <= rangeHeight / 2;

        if (debugAttackActivated && inRange) {
        }
      }
    }

    // Non fermare mai il combattimento se non ci sono NPC selezionati
    // Il face-up gestisce la logica di puntamento anche senza selezione attiva

    const selectedNpc = selectedNpcs[0];
    if (!selectedNpc) return;

    if (!playerEntity || !playerDamage) return;

    const playerTransform = this.ecs.getComponent(playerEntity, Transform);
    const npcTransform = this.ecs.getComponent(selectedNpc, Transform);

    if (!playerTransform || !playerDamage || !npcTransform) return;

    const canvasSize = DisplayManager.getInstance().getLogicalSize();
    const camera = this.cameraSystem.getCamera();
    const npcScreenPos = camera.worldToScreen(npcTransform.x, npcTransform.y, canvasSize.width, canvasSize.height);

    const margin = 100;
    const isOffScreen = npcScreenPos.x < -margin ||
      npcScreenPos.x > canvasSize.width + margin ||
      npcScreenPos.y < -margin ||
      npcScreenPos.y > canvasSize.height + margin;


    const rangeWidth = getPlayerRangeWidth();
    const rangeHeight = getPlayerRangeHeight();

    const dx = Math.abs(npcTransform.x - playerTransform.x);
    const dy = Math.abs(npcTransform.y - playerTransform.y);
    const inRange = dx <= rangeWidth / 2 && dy <= rangeHeight / 2;

    // NON deselezionare mai automaticamente l'NPC
    // Il combattimento continua sempre, il face-up gestisce la direzione
    const playerControlSystem = this.getPlayerControlSystem();
    const attackActivated = playerControlSystem?.isAttackActivated() || false;


    if (inRange && attackActivated) {
      // console.log(`[CLIENT_COMBAT_ACTIVATE] Player can attack NPC ${selectedNpc.id}, inRange=${inRange}, attackActivated=${attackActivated}`);

      // Se il target è cambiato (nuova selezione), fermiamo il vecchio e iniziamo il nuovo
      if (this.currentAttackTarget !== null && this.currentAttackTarget !== selectedNpc.id) {
        // console.log(`[CLIENT_COMBAT_SWITCH] Switching target from ${this.currentAttackTarget} to ${selectedNpc.id}`);
        this.sendStopCombat();
        this.endAttackLogging();
        this.currentAttackTarget = null;
      }

      if (this.currentAttackTarget !== selectedNpc.id) {
        // console.log(`[CLIENT_COMBAT_START] Starting combat with NPC ${selectedNpc.id}`);
        this.sendStartCombat(selectedNpc);
        this.startAttackLogging(selectedNpc);
        this.currentAttackTarget = selectedNpc.id;
        this.attackStartedLogged = true;
      }
      // Il combattimento continua sempre - non ci sono pause/riprese
    } else if (this.currentAttackTarget !== null) {
      // Se l'attacco è stato disattivato O l'NPC non è più in range (anche se attackActivated è true)
      // console.log(`[CLIENT_COMBAT_STOP] Stopping combat - state changed`);
      this.sendStopCombat();
      this.endAttackLogging();
      this.currentAttackTarget = null;
      this.attackStartedLogged = false;
      this.wasInCombat = false;
    }
  }

  /**
   * Sends start combat request to server
   */
  private sendStartCombat(npcEntity: Entity): void {
    // console.log(`[CLIENT_COMBAT_DEBUG] SENDING start_combat for NPC ${npcEntity.id} to server`);

    // Invia effettivamente il messaggio
    const networkSystem = this.getClientNetworkSystem();
    if (networkSystem) {
      const message = {
        type: 'start_combat',
        npcId: npcEntity.id,
        playerId: networkSystem.gameContext.authId || networkSystem.getLocalClientId()
      };
      // console.log(`[CLIENT_COMBAT_MESSAGE] Message:`, message);
      networkSystem.sendMessage(message);
    }
    const clientNetworkSystem = this.getClientNetworkSystem();
    if (!clientNetworkSystem) {
      return;
    }

    const npc = this.ecs.getComponent(npcEntity, Npc);
    if (!npc) {
      console.error(`📡 [CLIENT] Cannot send startCombat: NPC component not found for entity ${npcEntity.id}`);
      return;
    }

    const npcIdToSend = npc.serverId || npcEntity.id.toString();
    const playerId = clientNetworkSystem.gameContext.authId;

    try {
      clientNetworkSystem.sendStartCombat({
        npcId: npcIdToSend,
        playerId: playerId
      });
    } catch (error) {
      console.error(`❌ [CLIENT] Failed to send START_COMBAT request:`, error);
    }
  }

  /**
   * Sends stop combat request to server
   */
  sendStopCombat(): void {
    const clientNetworkSystem = this.getClientNetworkSystem();
    if (!clientNetworkSystem) return;

    clientNetworkSystem.sendStopCombat({
      playerId: clientNetworkSystem.getLocalClientId()
    });
  }

  /**
   * Starts attack logging
   */
  private startAttackLogging(targetEntity: Entity): void {
    const logSystem = this.getLogSystem();
    if (!logSystem) return;

    const npc = this.ecs.getComponent(targetEntity, Npc);
    if (npc) {
      logSystem.logAttackStart(npc.npcType);
      this.currentAttackTarget = targetEntity.id;
    }
  }

  /**
   * Ends attack logging
   */
  endAttackLogging(): void {
    const logSystem = this.getLogSystem();
    if (!logSystem || this.currentAttackTarget === null) return;

    const targetEntity = this.ecs.getEntity(this.currentAttackTarget);
    if (targetEntity) {
      const npc = this.ecs.getComponent(targetEntity, Npc);
      if (npc) {
        logSystem.logAttackEnd(npc.npcType);
      }
    }

    this.currentAttackTarget = null;
  }

  /**
   * Stops combat immediately
   */
  stopCombatImmediately(deactivateAttackCallback: () => void): void {
    deactivateAttackCallback();

    if (this.currentAttackTarget) {
      this.sendStopCombat();
      this.endAttackLogging();
      this.currentAttackTarget = null;
      this.attackStartedLogged = false;
      this.wasInCombat = false;
    }
  }

  /**
   * Resets combat state
   */
  reset(): void {
    this.currentAttackTarget = null;
    this.attackStartedLogged = false;
    this.wasInCombat = false;
  }
}
