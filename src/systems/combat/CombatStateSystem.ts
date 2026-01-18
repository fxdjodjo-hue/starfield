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
import { MissileManager } from './managers/MissileManager';
import { DisplayManager } from '../../infrastructure/display';
import { getPlayerRangeWidth, getPlayerRangeHeight } from '../../config/PlayerConfig';
import { LogType } from '../../presentation/ui/LogMessage';

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
  private missileManager: MissileManager | null = null;

  // Stato del combattimento
  private currentAttackTarget: number | null = null;
  private attackStartedLogged: boolean = false;
  private lastAttackActivatedState: boolean = false; // Per edge detection
  private lastCombatLogTime: number = 0; // For throttling debug logs

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
   * Initializes missile manager (called after all dependencies are set)
   */
  private initializeMissileManager(): void {
    if (this.missileManager || !this.playerSystem || !this.clientNetworkSystem) {
      return;
    }

    this.missileManager = new MissileManager(
      this.ecs,
      this.playerSystem,
      () => this.clientNetworkSystem
    );
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
    
    // Process player combat (includes missile firing logic)
    this.processPlayerCombat();
  }

  /**
   * Gestisce attivazione attacco (chiamato solo su edge up)
   */
  private handleAttackActivated(): void {
    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
    if (selectedNpcs.length === 0) {
      return;
    }

    const selectedNpc = selectedNpcs[0];

    // 🔥 CONTROLLO RANGE RETTANGOLARE PRIMA DI INIZIARE COMBATTIMENTO 🔥
    const playerEntity = this.playerSystem?.getPlayerEntity();
    const playerTransform = playerEntity ? this.ecs.getComponent(playerEntity, Transform) : null;
    const npcTransform = this.ecs.getComponent(selectedNpc, Transform);

    if (!playerTransform || !npcTransform) {
      console.warn('⚠️ [COMBAT] Missing components for range check');
      return;
    }

    // Controllo range rettangolare
    const rangeWidth = getPlayerRangeWidth();
    const rangeHeight = getPlayerRangeHeight();
    const dx = Math.abs(npcTransform.x - playerTransform.x);
    const dy = Math.abs(npcTransform.y - playerTransform.y);
    const inRange = dx <= rangeWidth / 2 && dy <= rangeHeight / 2;

    // Debug range check

    if (!inRange) {
      // Mostra messaggio fuori range
      if (this.logSystem) {
        this.logSystem.addLogMessage('Target out of range! Move closer to attack.', LogType.ATTACK_FAILED, 2000);
      }
      return; // Non iniziare combattimento se fuori range
    }

    // NPC nel range - inizia combattimento solo se non già attivo con questo NPC
    if (this.currentAttackTarget !== selectedNpc.id) {
      this.sendStartCombat(selectedNpc);
      this.startAttackLogging(selectedNpc);
      this.currentAttackTarget = selectedNpc.id;
      this.attackStartedLogged = true;
    }
  }

  /**
   * Gestisce disattivazione attacco (chiamato solo su edge down)
   */
  private handleAttackDeactivated(): void {
    if (this.currentAttackTarget !== null) {
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
    const canvasSize = DisplayManager.getInstance().getLogicalSize();
    const camera = this.cameraSystem.getCamera();
    const npcScreenPos = camera.worldToScreen(npcTransform.x, npcTransform.y, canvasSize.width, canvasSize.height);

    // Margine di sicurezza per considerare "fuori schermo"
    const margin = 100;
    const isOffScreen = npcScreenPos.x < -margin ||
                       npcScreenPos.x > canvasSize.width + margin ||
                       npcScreenPos.y < -margin ||
                       npcScreenPos.y > canvasSize.height + margin;

    // Calcola se l'NPC è nel rettangolo di range
    const rangeWidth = getPlayerRangeWidth();
    const rangeHeight = getPlayerRangeHeight();

    const dx = Math.abs(npcTransform.x - playerTransform.x);
    const dy = Math.abs(npcTransform.y - playerTransform.y);
    const inRange = dx <= rangeWidth / 2 && dy <= rangeHeight / 2;

    const attackActivated = this.playerControlSystem?.isAttackActivated() || false;


    // Permetti combattimento anche se NPC fuori schermo, purché entro range
    // Deseleziona solo se fuori schermo E fuori range E non target corrente
    if (isOffScreen && !inRange && this.currentAttackTarget !== selectedNpc.id) {
      this.ecs.removeComponent(selectedNpc, SelectedNpc);
      return; // Non continuare con la logica di combattimento
    }

    if (inRange && attackActivated && this.currentAttackTarget !== selectedNpc.id) {
      // Player in range E (attacco attivato O eravamo in combattimento) - inizia/riprendi combattimento
      const reason = attackActivated ? "attack activated" : "unknown reason";
      this.sendStartCombat(selectedNpc);
      this.startAttackLogging(selectedNpc);
      this.currentAttackTarget = selectedNpc.id;
      this.attackStartedLogged = true;
      
      // Initialize missile manager and set cooldown to full (so first missile fires after 1.5s)
      this.initializeMissileManager();
      if (this.missileManager) {
        // Set cooldown to full so first missile fires after 1.5 seconds
        this.missileManager.setCooldownToFull();
        if (import.meta.env.DEV) {
        }
      }
    } else if (inRange && attackActivated && this.currentAttackTarget === selectedNpc.id) {
      // Already in combat - try to fire missile automatically
      this.initializeMissileManager();
      if (this.missileManager && playerEntity && playerTransform && playerDamage && npcTransform) {
        const missileFired = this.missileManager.fireMissile(
          playerEntity,
          playerTransform,
          playerDamage,
          npcTransform,
          selectedNpc
        );
        
        if (import.meta.env.DEV && missileFired) {
        }
      }
    } else if (!inRange && this.currentAttackTarget === selectedNpc.id) {
      // Player uscito dal range - ferma combattimento
      this.sendStopCombat();
      this.endAttackLogging();
      this.currentAttackTarget = null;
      this.attackStartedLogged = false;
    } else if (!attackActivated && this.currentAttackTarget !== null) {
      // Attacco disattivato - ferma qualsiasi combattimento in corso
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

    // Evita doppi log: se è già stato loggato per questo target, non loggare di nuovo
    if (this.attackStartedLogged && this.currentAttackTarget === targetEntity.id) {
      return;
    }

    const npc = this.ecs.getComponent(targetEntity, Npc);
    if (npc) {
      this.logSystem.logAttackStart(npc.npcType);
      this.currentAttackTarget = targetEntity.id;
      this.attackStartedLogged = true;
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

    this.deactivateAttackAfterCombatEnd();

    // Reset stato combattimento
    this.handleAttackDeactivated();
  }

  /**
   * Disattiva l'attacco nel PlayerControlSystem quando finisce il combattimento
   */
  private deactivateAttackAfterCombatEnd(): void {
    if (this.playerControlSystem) {
      (this.playerControlSystem as any).deactivateAttack();
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