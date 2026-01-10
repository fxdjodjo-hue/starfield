import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { Transform } from '../../entities/spatial/Transform';
import { Damage } from '../../entities/combat/Damage';
import { SelectedNpc } from '../../entities/combat/SelectedNpc';
import { Npc } from '../../entities/ai/Npc';
import { ClientNetworkSystem } from '../../multiplayer/client/ClientNetworkSystem';
import { CameraSystem } from '../rendering/CameraSystem';
import { PlayerSystem } from '../player/PlayerSystem';
import { PlayerControlSystem } from '../input/PlayerControlSystem';
import { LogSystem } from '../rendering/LogSystem';

/**
 * Sistema dedicato alla gestione dello stato del combattimento
 * Responsabilità: Inizio/fine combattimento, selezione target, logica di stato
 * Segue il principio Single Responsibility
 */
export class CombatStateSystem extends BaseSystem {
  private clientNetworkSystem: ClientNetworkSystem | null = null;
  private cameraSystem: CameraSystem | null = null;
  private playerSystem: PlayerSystem | null = null;
  private playerControlSystem: PlayerControlSystem | null = null;
  private logSystem: LogSystem | null = null;

  // Stato del combattimento
  private currentAttackTarget: number | null = null;
  private attackStartedLogged: boolean = false;
  private lastAttackActivatedState: boolean = false; // Per edge detection

  constructor(ecs: ECS) {
    super(ecs);
  }

  /**
   * Imposta i sistemi necessari per il funzionamento
   */
  setClientNetworkSystem(clientNetworkSystem: ClientNetworkSystem): void {
    this.clientNetworkSystem = clientNetworkSystem;
  }

  setCameraSystem(cameraSystem: CameraSystem): void {
    this.cameraSystem = cameraSystem;
  }

  setPlayerSystem(playerSystem: PlayerSystem): void {
    this.playerSystem = playerSystem;
  }

  setPlayerControlSystem(playerControlSystem: PlayerControlSystem): void {
    this.playerControlSystem = playerControlSystem;
  }

  setLogSystem(logSystem: LogSystem): void {
    this.logSystem = logSystem;
  }

  /**
   * Aggiornamento periodico (implementazione dell'interfaccia System)
   * ✅ EDGE-TRIGGERED: reagisce ai cambiamenti di stato, non controlla ogni frame
   */
  update(deltaTime: number): void {
    // 🎯 EDGE DETECTION: controlla se lo stato dell'attacco è cambiato
    const currentAttackActivated = this.playerControlSystem?.isAttackActivated() || false;

    if (currentAttackActivated !== this.lastAttackActivatedState) {
      // 🔥 CAMBIAMENTO DI STATO: gestisci transizione
      if (currentAttackActivated) {
        // Attacco appena attivato - inizia combattimento
        this.handleAttackActivated();
      } else {
        // Attacco appena disattivato - ferma combattimento
        this.handleAttackDeactivated();
      }
      this.lastAttackActivatedState = currentAttackActivated;
    }

    // Mantieni selezione valida (controllo leggero, non ogni frame pesante)
    this.maintainValidSelection();
  }

  /**
   * Gestisce attivazione attacco (chiamato solo su edge up)
   */
  private handleAttackActivated(): void {
    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
    if (selectedNpcs.length === 0) {
      console.log('[CombatState] No NPC selected - cannot start combat');
      return;
    }

    const selectedNpc = selectedNpcs[0];
    console.log(`[CombatState] 🎯 Starting combat with NPC ${selectedNpc.id}`);
    this.sendStartCombat(selectedNpc);
    this.startAttackLogging(selectedNpc);
    this.currentAttackTarget = selectedNpc.id;
    this.attackStartedLogged = true;
  }

  /**
   * Gestisce disattivazione attacco (chiamato solo su edge down)
   */
  private handleAttackDeactivated(): void {
    if (this.currentAttackTarget !== null) {
      console.log(`[CombatState] 🛑 Stopping combat with target ${this.currentAttackTarget}`);
      this.sendStopCombat();
      this.endAttackLogging();
      this.currentAttackTarget = null;
      this.attackStartedLogged = false;
    }
  }

  /**
   * Mantiene selezione valida (controlli leggeri, non pesanti)
   */
  private maintainValidSelection(): void {
    if (this.currentAttackTarget === null) return;

    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
    const targetStillSelected = selectedNpcs.some(npc => npc.id === this.currentAttackTarget);

    if (!targetStillSelected) {
      // Target non più selezionato - ferma combattimento
      console.log('[CombatState] Target deselected - stopping combat');
      this.handleAttackDeactivated();
    }
  }

  /**
   * [LEGACY] Elabora la logica del combattimento del player - ora usata solo per compatibilità
   * @deprecated Usare handleAttackActivated/handleAttackDeactivated
   */
  processPlayerCombat(): void {
    // Trova il player
    const playerEntity = this.playerSystem?.getPlayerEntity();
    const playerDamage = playerEntity ? this.ecs.getComponent(playerEntity, Damage) : null;

    // Trova l'NPC selezionato
    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);

    if (selectedNpcs.length === 0) {
      // Se non ci sono NPC selezionati, ferma qualsiasi combattimento attivo
      if (this.currentAttackTarget !== null) {
        this.sendStopCombat();
        this.endAttackLogging();
        this.currentAttackTarget = null;
      }
      return;
    }

    const selectedNpc = selectedNpcs[0];

    // Verifica che abbiamo il player
    if (!playerEntity || !playerDamage || !this.cameraSystem) return;

    const playerTransform = this.ecs.getComponent(playerEntity, Transform);
    const npcTransform = this.ecs.getComponent(selectedNpc, Transform);

    if (!playerTransform || !npcTransform) return;

    // Controlla se l'NPC è ancora visibile nella viewport
    const canvasSize = { width: 800, height: 600 }; // TODO: Get from actual canvas
    const camera = this.cameraSystem.getCamera();
    const npcScreenPos = camera.worldToScreen(npcTransform.x, npcTransform.y, canvasSize.width, canvasSize.height);

    // Margine di sicurezza per considerare "fuori schermo"
    const margin = 100;
    const isOffScreen = npcScreenPos.x < -margin ||
                       npcScreenPos.x > canvasSize.width + margin ||
                       npcScreenPos.y < -margin ||
                       npcScreenPos.y > canvasSize.height + margin;

    // Se l'NPC esce dallo schermo MA è in combattimento attivo, mantieni selezione
    if (isOffScreen && this.currentAttackTarget !== selectedNpc.id) {
      this.ecs.removeComponent(selectedNpc, SelectedNpc);
      return; // Non continuare con la logica di combattimento
    }

    // Calcola la distanza semplice
    const distance = Math.sqrt(
      Math.pow(playerTransform.x - npcTransform.x, 2) +
      Math.pow(playerTransform.y - npcTransform.y, 2)
    );

    const inRange = distance <= playerDamage.attackRange;
    const attackActivated = this.playerControlSystem?.isAttackActivated() || false;

    // Debug range consistency
    if (playerDamage.attackRange !== 600) {
      console.warn(`⚠️ [COMBAT] Player attackRange mismatch: expected 600, got ${playerDamage.attackRange}`);
    }

    if (inRange && attackActivated && this.currentAttackTarget !== selectedNpc.id) {
      // Player in range E (attacco attivato O eravamo in combattimento) - inizia/riprendi combattimento
      const reason = attackActivated ? "attack activated" : "unknown reason";
      console.log(`🎯 [COMBAT] STARTING combat (${distance.toFixed(1)}px) - ${reason} with NPC ${selectedNpc.id}`);
      this.sendStartCombat(selectedNpc);
      this.startAttackLogging(selectedNpc);
      this.currentAttackTarget = selectedNpc.id;
      this.attackStartedLogged = true;
    } else if (!inRange && this.currentAttackTarget === selectedNpc.id) {
      // Player uscito dal range - ferma combattimento
      this.sendStopCombat();
      this.endAttackLogging();
      this.currentAttackTarget = null;
      this.attackStartedLogged = false;
    } else if (!attackActivated && this.currentAttackTarget !== null) {
      // Attacco disattivato - ferma qualsiasi combattimento in corso
      console.log(`🛑 [COMBAT] ATTACK DEACTIVATED - stopping combat with target ${this.currentAttackTarget}`);
      this.sendStopCombat();
      this.endAttackLogging();
      this.currentAttackTarget = null;
      this.attackStartedLogged = false;
    }
  }

  /**
   * Invia richiesta di inizio combattimento al server
   */
  private sendStartCombat(npcEntity: Entity): void {
    if (!this.clientNetworkSystem) {
      return; // Non fare niente se non connesso
    }

    const npc = this.ecs.getComponent(npcEntity, Npc);
    if (!npc) {
      console.error(`📡 [CLIENT] Cannot send startCombat: NPC component not found for entity ${npcEntity.id}`);
      return;
    }

    // Usa l'ID server se disponibile, altrimenti l'ID entità locale
    const npcIdToSend = npc.serverId || npcEntity.id.toString();
    const playerId = this.clientNetworkSystem.gameContext.authId;

    try {
      this.clientNetworkSystem.sendStartCombat({
        npcId: npcIdToSend,
        playerId: playerId
      });
    } catch (error) {
      console.error(`❌ [CLIENT] Failed to send START_COMBAT request:`, error);
    }
  }

  /**
   * Invia richiesta di fine combattimento al server
   */
  private sendStopCombat(): void {
    if (!this.clientNetworkSystem) return;

    this.clientNetworkSystem.sendStopCombat({
      playerId: this.clientNetworkSystem.getLocalClientId()
    });
  }

  /**
   * Inizia il logging di un attacco contro un NPC
   */
  private startAttackLogging(targetEntity: Entity): void {
    if (!this.logSystem) return;

    const npc = this.ecs.getComponent(targetEntity, Npc);
    if (npc) {
      this.logSystem.logAttackStart(npc.npcType);
      this.currentAttackTarget = targetEntity.id;
    }
  }

  /**
   * Termina il logging di un attacco
   */
  private endAttackLogging(): void {
    if (!this.logSystem || this.currentAttackTarget === null) return;

    // Trova il nome dell'NPC che stavamo attaccando
    const targetEntity = this.ecs.getEntity(this.currentAttackTarget);
    if (targetEntity) {
      const npc = this.ecs.getComponent(targetEntity, Npc);
      if (npc) {
        this.logSystem.logAttackEnd(npc.npcType);
      }
    }

    this.currentAttackTarget = null;
  }

  /**
   * Ferma immediatamente il combattimento (chiamato quando disattivi manualmente l'attacco)
   */
  public stopCombatImmediately(): void {
    console.log(`🛑 [CombatState] Combat stopped immediately`);

    this.deactivateAttackAfterCombatEnd();

    // Reset stato combattimento
    this.handleAttackDeactivated();
  }

  /**
   * Disattiva l'attacco nel PlayerControlSystem quando finisce il combattimento
   */
  private deactivateAttackAfterCombatEnd(): void {
    const playerControlSystem = this.ecs.systems?.find((system) =>
      system instanceof PlayerControlSystem
    );

    if (playerControlSystem) {
      console.log(`🛑 [COMBAT] Deactivating attack after combat end`);
      (playerControlSystem as any).deactivateAttack();
    }
  }

  /**
   * Cleanup delle risorse
   */
  public destroy(): void {
    this.clientNetworkSystem = null;
    this.cameraSystem = null;
    this.playerSystem = null;
    this.playerControlSystem = null;
    this.logSystem = null;
    this.currentAttackTarget = null;
    this.attackStartedLogged = false;
    this.lastAttackActivatedState = false;
  }
}