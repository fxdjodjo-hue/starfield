import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { Transform } from '../../entities/spatial/Transform';
import { Damage } from '../../entities/combat/Damage';
import { SelectedNpc } from '../../entities/combat/SelectedNpc';
import { Npc } from '../../entities/ai/Npc';
import { Projectile } from '../../entities/combat/Projectile';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { RemotePlayer } from '../../entities/player/RemotePlayer';
import { Sprite } from '../../entities/Sprite';
import { DamageTaken } from '../../entities/combat/DamageTaken';
import { ClientNetworkSystem } from '../../multiplayer/client/ClientNetworkSystem';
import { CameraSystem } from '../rendering/CameraSystem';
import { PlayerSystem } from '../player/PlayerSystem';
import { PlayerControlSystem } from '../input/PlayerControlSystem';
import { LogSystem } from '../rendering/LogSystem';
import { DamageTextSystem } from '../rendering/DamageTextSystem';
import { DisplayManager } from '../../infrastructure/display';
import { getPlayerRangeWidth, getPlayerRangeHeight } from '../../config/PlayerConfig';
import { GAME_CONSTANTS } from '../../config/GameConstants';
import { LogType } from '../../presentation/ui/LogMessage';
import { AssetManager } from '../../core/services/AssetManager';
import { ProjectileFactory } from '../../core/domain/ProjectileFactory';
import { ProjectileVisualState } from '../../entities/combat/ProjectileVisualState';
import { CONFIG } from '../../core/utils/config/GameConfig';
import npcConfig from '../../../shared/npc-config.json';

/**
 * Sistema dedicato alla gestione dello stato del combattimento
 * Responsabilità: Inizio/fine combattimento, selezione target, logica di stato
 * Segue il principio Single Responsibility
 */
export class CombatStateSystem extends BaseSystem {
  public static override readonly Type = 'CombatStateSystem';
  private clientNetworkSystem: ClientNetworkSystem | null = null;
  private cameraSystem: CameraSystem | null = null;
  private playerSystem: PlayerSystem | null = null;
  private playerControlSystem: PlayerControlSystem | null = null;
  private assetManager: AssetManager | null = null;
  private logSystem: LogSystem | null = null;
  private damageSystem: any = null;

  // Stato del combattimento
  private currentAttackTarget: number | null = null;
  private attackStartedLogged: boolean = false;
  private lastAttackActivatedState: boolean = false; // Per edge detection
  private lastCombatLogTime: number = 0; // For throttling debug logs
  private activeBeamEntities: Set<number> = new Set(); // Traccia laser beam attivi
  private lastLaserFireTime: number = 0;
  private lastLaserSoundTime: number = 0; // Per evitare suoni duplicati // Per controllo frequenza laser
  private laserSequenceCount: number = 0; // Contatore per ritmica
  private rhythmPattern: number = 0; // Pattern ritmico corrente (0-2)
  // Sistema laser NPC
  private npcLaserFireTimes: Map<number, number> = new Map(); // entityId -> lastFireTime
  private npcLastInRange: Map<number, number> = new Map(); // entityId -> lastTimeInRange

  /**
   * Ottiene l'intervallo di fuoco laser per un NPC specifico basato sul suo tipo
   */
  private getNpcLaserInterval(npcEntity: Entity): number {
    const npcComponent = this.ecs.getComponent(npcEntity, Npc);
    if (!npcComponent || !npcComponent.npcType) {
      return GAME_CONSTANTS.COMBAT.PLAYER_LASER_VISUAL_INTERVAL; // Fallback
    }

    const npcTypeConfig = (npcConfig as any)[npcComponent.npcType];
    if (npcTypeConfig && npcTypeConfig.stats && npcTypeConfig.stats.cooldown) {
      return npcTypeConfig.stats.cooldown;
    }

    return GAME_CONSTANTS.COMBAT.PLAYER_LASER_VISUAL_INTERVAL; // Fallback
  }

  /**
   * Ottiene il range di un NPC specifico basato sul suo tipo
   */
  private getNpcRange(npcEntity: Entity): number {
    const npcComponent = this.ecs.getComponent(npcEntity, Npc);
    if (!npcComponent || !npcComponent.npcType) {
      return 800; // Fallback range
    }

    const npcTypeConfig = (npcConfig as any)[npcComponent.npcType];
    if (npcTypeConfig && npcTypeConfig.stats && npcTypeConfig.stats.range) {
      return npcTypeConfig.stats.range;
    }

    return 800; // Fallback range
  }

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

    // 🛡️ CONTINUOUS SAFE ZONE CHECK - REMOVED: Allow combat in safe zone
    /*
    const playerEntity = this.playerSystem?.getPlayerEntity();
    const playerTransform = playerEntity ? this.ecs.getComponent(playerEntity, Transform) : null;
    if (playerTransform && this.isInSafeZone(playerTransform.x, playerTransform.y)) {
      if (this.currentAttackTarget !== null || currentAttackActivated) {
        this.stopCombatImmediately();
      }
    }
    */

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

    // Crea laser periodici durante attacco attivo
    this.processPeriodicLaserFiring();

    // Gestisci laser visivi per NPC in combattimento
    this.processNpcLaserFiring();

    // Gestisci laser visivi per giocatori remoti in combattimento
    this.processRemotePlayerLaserFiring();
  }

  /**
   * Gestisce attivazione attacco (chiamato solo su edge up)
   */
  private handleAttackActivated(): void {
    // Combat activation logging removed for production - too verbose
    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
    if (selectedNpcs.length === 0) {
      return;
    }

    const selectedNpc = selectedNpcs[0];

    const npcComponent = this.ecs.getComponent(selectedNpc, Npc);

    if (!selectedNpc) {
      return;
    }

    const playerEntity = this.playerSystem?.getPlayerEntity();
    const playerTransform = playerEntity ? this.ecs.getComponent(playerEntity, Transform) : null;
    const npcTransform = this.ecs.getComponent(selectedNpc, Transform);

    if (!playerTransform || !npcTransform) {
      return;
    }

    // 🛡️ SAFE ZONE CHECK - REMOVED: Allow attacking FROM safe zone
    /*
    if (this.isInSafeZone(playerTransform.x, playerTransform.y)) { // REMOVED check for npcTransform: Allow attacking NPCs in safe zones
      if (this.logSystem) {
        this.logSystem.addLogMessage('Combat disabled in Safe Zone!', LogType.ATTACK_FAILED, 2000);
      }
      return;
    }
    */

    // 🔥 CONTROLLO RANGE RETTANGOLARE PRIMA DI INIZIARE COMBATTIMENTO 🔥
    if (!playerTransform || !npcTransform) {
      return;
    }

    // Controllo range rettangolare
    const rangeWidth = getPlayerRangeWidth();
    const rangeHeight = getPlayerRangeHeight();
    const dx = Math.abs(npcTransform.x - playerTransform.x);
    const dy = Math.abs(npcTransform.y - playerTransform.y);
    const inRange = dx <= rangeWidth / 2 && dy <= rangeHeight / 2;

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

    // Crea effetto beam laser dal player all'NPC AD OGNI ATTACCO (anche se combattimento già attivo)
    this.createPlayerBeamEffect(selectedNpc).catch(error => {
      console.error('[ATTACK] Failed to create beam effect:', error);
    });
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

      // Rimuovi tutti i laser beam attivi
      this.removeAllActiveBeams();
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

    // Non fermare mai il combattimento se non ci sono NPC selezionati
    // Il face-up gestisce la logica di puntamento anche senza selezione attiva

    const selectedNpc = selectedNpcs[0];

    // Verifica che abbiamo il player e un NPC selezionato
    if (!playerEntity || !playerDamage || !this.cameraSystem || !selectedNpc) return;

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
    // NON deselezionare mai temporaneamente - lascia che il face-up gestisca la logica
    // Il combattimento continua sempre, il face-up si occupa di puntare verso l'ultimo target conosciuto

    // 🛡️ SAFE ZONE CHECK - REMOVED
    /*
    if (this.isInSafeZone(playerTransform.x, playerTransform.y)) { // REMOVED check for npcTransform: Allow targeting NPCs in safe zones
      this.stopCombatImmediately();
      return;
    }
    */

    if (inRange && attackActivated && this.currentAttackTarget !== selectedNpc.id) {
      // Player in range - inizia combattimento
      this.sendStartCombat(selectedNpc);
      this.startAttackLogging(selectedNpc);
      this.currentAttackTarget = selectedNpc.id;
      this.attackStartedLogged = true;

      // Missiles removed - no longer supported

      // NON fermare mai il combattimento per questioni di range
      // Il server gestisce il range, il client mantiene sempre il combattimento attivo
    } else if (!attackActivated && this.currentAttackTarget !== null) {
      // Attacco disattivato - ferma qualsiasi combattimento in corso
      this.sendStopCombat();
      this.endAttackLogging();
      this.currentAttackTarget = null;
      this.attackStartedLogged = false;
    }
  }

  /**
   * Gestisce la creazione periodica di laser durante attacco attivo
   */
  private processPeriodicLaserFiring(): void {
    const attackActivated = this.playerControlSystem?.isAttackActivated() || false;
    if (!attackActivated || this.currentAttackTarget === null) {
      return; // Non creare laser se attacco non attivo
    }

    const now = Date.now();

    // PATTERN RITMICI DIVERSI PER MENO MONOTONIA
    const sequencePosition = this.laserSequenceCount % 4;
    let interval = GAME_CONSTANTS.COMBAT.PLAYER_LASER_VISUAL_INTERVAL; // 350ms base

    switch (this.rhythmPattern) {
      case 0: // Pattern originale: 3 veloci + 1 rallentato + 1 super-veloce
        if (sequencePosition === 0) interval *= 1.43; // 4° rallentato
        else if (sequencePosition === 1) interval *= 0.6; // 1° del nuovo ciclo super-veloce
        break;

      case 1: // Pattern accelerando: 2 normali + 2 accelerati
        if (sequencePosition === 3 || sequencePosition === 0) interval *= 0.7; // 3° e 4° accelerati
        break;

      case 2: // Pattern irregolare: variazioni casuali piccole
        const variation = (Math.random() - 0.5) * 0.4; // ±20% variazione
        interval *= (1 + variation);
        break;
    }

    if (now - this.lastLaserFireTime >= interval) {
      // È tempo di creare un nuovo laser
      const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
      if (selectedNpcs.length > 0) {
        const selectedNpc = selectedNpcs[0];

        // Verifica che siamo ancora in range prima di creare il laser
        const playerEntity = this.playerSystem?.getPlayerEntity();
        if (playerEntity) {
          // Controlla se il giocatore è morto
          const playerHealth = this.ecs.getComponent(playerEntity, Health);
          if (playerHealth && playerHealth.isDead()) {
            return; // Non creare laser se il giocatore è morto
          }

          const playerTransform = this.ecs.getComponent(playerEntity, Transform);
          const npcTransform = this.ecs.getComponent(selectedNpc, Transform);

          if (playerTransform && npcTransform) {
            // 🛡️ SAFE ZONE VISUAL BLOCK - REMOVED: Allow visuals in Safe Zone
            /*
            if (this.isInSafeZone(playerTransform.x, playerTransform.y)) { // REMOVED check for npcTransform
              return;
            }
            */

            const rangeWidth = getPlayerRangeWidth();
            const rangeHeight = getPlayerRangeHeight();
            const dx = Math.abs(npcTransform.x - playerTransform.x);
            const dy = Math.abs(npcTransform.y - playerTransform.y);
            const inRange = dx <= rangeWidth / 2 && dy <= rangeHeight / 2;

            if (inRange) {
              // Crea il laser beam
              this.createPlayerBeamEffect(selectedNpc).catch(error => {
                console.error('[LASER] Failed to create periodic laser:', error);
              });
              this.lastLaserFireTime = now;

              // Incrementa contatore sequenza
              this.laserSequenceCount++;

              // CAMBIA PATTERN OGNI CICLO DI 4 LASER
              if (this.laserSequenceCount % 4 === 0) {
                this.rhythmPattern = (this.rhythmPattern + 1) % 3; // 3 pattern diversi
              }

            }
          }
        }
      }
    }
  }

  /**
   * Gestisce la creazione periodica di laser visivi per giocatori remoti in combattimento
   * Implementa la Soluzione 2: Simulazione locale basata sullo stato di combattimento
   */
  private processRemotePlayerLaserFiring(): void {
    const now = Date.now();

    // OTTIMIZZAZIONE: Recupera entità solo se necessario
    const remotePlayers = this.ecs.getEntitiesWithComponents(RemotePlayer, Transform);
    if (remotePlayers.length === 0) return;

    for (const remoteEntity of remotePlayers) {
      const remotePlayer = this.ecs.getComponent(remoteEntity, RemotePlayer);

      // Simula laser solo se il player ha un target attivo
      if (!remotePlayer || !remotePlayer.targetId) continue;

      // Verifica cooldown visivo (sincronizzato con il ritmo del player locale)
      if (now - remotePlayer.lastVisualFireTime < GAME_CONSTANTS.COMBAT.PLAYER_LASER_VISUAL_INTERVAL) {
        continue;
      }

      // Trova l'entità target (NPC) tramite il RemoteNpcSystem
      let targetEntity: Entity | null = null;
      const remoteNpcSystem = this.clientNetworkSystem?.getRemoteNpcSystem();

      if (remoteNpcSystem) {
        const npcEntityId = remoteNpcSystem.getRemoteNpcEntity(remotePlayer.targetId);
        if (npcEntityId !== undefined) {
          targetEntity = this.ecs.getEntity(npcEntityId) || null;
        }
      }

      if (targetEntity) {
        const remoteTransform = this.ecs.getComponent(remoteEntity, Transform);
        const targetTransform = this.ecs.getComponent(targetEntity, Transform);

        if (remoteTransform && targetTransform) {
          // Usa il metodo statico per creare l'effetto laser grafico (danno = 0)
          CombatStateSystem.createBeamEffectForPlayer(
            this.ecs,
            this.assetManager,
            this.clientNetworkSystem?.getAudioSystem(),
            remotePlayer.clientId,
            { x: remoteTransform.x, y: remoteTransform.y },
            { x: targetTransform.x, y: targetTransform.y },
            remotePlayer.targetId,
            this.activeBeamEntities
          ).catch(err => {
            if (import.meta.env.DEV) console.warn(`[REMOTE-LASER] Failed for player ${remotePlayer.clientId}:`, err);
          });

          // Aggiorna il timestamp per il prossimo sparo visivo
          remotePlayer.lastVisualFireTime = now;
        }
      } else {
        // Se il target non esiste più localmente, resettiamo il targetId per fermare la simulazione
        remotePlayer.targetId = null;
      }
    }
  }

  /**
   * Gestisce la creazione periodica di laser visivi per NPC in combattimento
   */
  private processNpcLaserFiring(): void {
    const now = Date.now();
    const allNpcs = this.ecs.getEntitiesWithComponents(Npc);

    for (const npcEntity of allNpcs) {
      const npc = this.ecs.getComponent(npcEntity, Npc);
      const damageTaken = this.ecs.getComponent(npcEntity, DamageTaken);

      if (!npc) continue;

      // Controlla se l'NPC ha subito danno recentemente
      const wasRecentlyDamaged = damageTaken ? damageTaken.wasDamagedRecently(now, 10000) : false;

      if (wasRecentlyDamaged) {
        // NPC in combattimento - crea laser visivi periodici
        const lastFireTime = this.npcLaserFireTimes.get(npcEntity.id) || 0;
        const laserInterval = this.getNpcLaserInterval(npcEntity);

        if (now - lastFireTime >= laserInterval) {
          // È tempo di creare un laser visivo per questo NPC
          this.createNpcBeamEffect(npcEntity).catch(error => {
            console.error('[NPC-LASER] Failed to create NPC laser:', error);
          });
          this.npcLaserFireTimes.set(npcEntity.id, now);
        }
      } else {
        // NPC non più in combattimento - rimuovi dal tracking
        this.npcLaserFireTimes.delete(npcEntity.id);
        this.npcLastInRange.delete(npcEntity.id);
      }
    }
  }

  /**
   * Crea effetto laser visivo per un NPC
   */
  private async createNpcBeamEffect(npcEntity: Entity): Promise<void> {
    if (!this.ecs) {
      console.error('[NPC-BEAM] ECS not available');
      return;
    }

    const now = Date.now();

    // Trova il player come target
    const playerEntity = this.playerSystem?.getPlayerEntity();
    if (!playerEntity) {
      console.warn('[NPC-BEAM] Player entity not found');
      return;
    }

    // Ottieni trasform dell'NPC e del player
    const npcTransform = this.ecs.getComponent(npcEntity, Transform);
    const playerTransform = this.ecs.getComponent(playerEntity, Transform);

    if (!npcTransform || !playerTransform) {
      console.warn('[NPC-BEAM] Missing transforms for NPC beam effect');
      return;
    }

    // Controlla se il player è nel range dell'NPC (o era recentemente nel range)
    const npcRange = this.getNpcRange(npcEntity);
    const dx = Math.abs(npcTransform.x - playerTransform.x);
    const dy = Math.abs(npcTransform.y - playerTransform.y);
    const distance = Math.sqrt(dx * dx + dy * dy);
    const currentlyInRange = distance <= npcRange;

    // Permetti laser visivi anche se uscito dal range da poco (2 secondi di grazia)
    const lastInRangeTime = this.npcLastInRange.get(npcEntity.id) || 0;
    const recentlyInRange = (now - lastInRangeTime) <= 2000; // 2 secondi di grazia

    if (currentlyInRange) {
      // Aggiorna il tempo dell'ultimo contatto nel range
      this.npcLastInRange.set(npcEntity.id, now);
    } else if (!recentlyInRange) {
      // Player troppo lontano e non recentemente nel range, non creare laser visivo
      return;
    }

    // Usa coordinate mondo reali: dal NPC al player
    const startX = npcTransform.x;
    const startY = npcTransform.y;
    const targetX = playerTransform.x;
    const targetY = playerTransform.y;

    // Crea proiettile visivo NPC con sprite e suono diversi
    if (!this.assetManager) {
      return;
    }

    try {
      // Suono gestito dal ProjectileFiredHandler quando arriva il proiettile dal server
      // Carica immagine laser NPC esistente
      const npcLaserImage = await this.assetManager.loadImage('assets/npc_ships/kronos/npc_frigate_projectile.png');

      // Crea il proiettile usando ProjectileFactory
      const projectileEntity = ProjectileFactory.create(this.ecs, {
        damage: 0, // Danno = 0, questo è solo visivo
        startX: startX,
        startY: startY,
        targetX: targetX,
        targetY: targetY,
        ownerId: npcEntity.id,
        targetId: playerEntity.id,
        projectileType: 'npc_laser', // Tipo diverso per distinguere dai laser player
        speed: GAME_CONSTANTS.PROJECTILE.VISUAL_SPEED, // Stessa velocità dei laser player per seguire meglio
        lifetime: 30000 // 30 secondi di vita per laser molto lenti
      });

      // Aggiungi sprite NPC diverso - rimpicciolito
      const scaleFactor = 0.5; // Riduci dimensioni del 50%
      const laserSprite = new Sprite(npcLaserImage, npcLaserImage.width * scaleFactor, npcLaserImage.height * scaleFactor);
      this.ecs.addComponent(projectileEntity, Sprite, laserSprite);

      // Aggiungi ProjectileVisualState per garantire rendering corretto
      const visualState = new ProjectileVisualState();
      this.ecs.addComponent(projectileEntity, ProjectileVisualState, visualState);

      // Traccia il proiettile attivo per pulizia
      this.activeBeamEntities.add(projectileEntity.id);

      // NPC laser projectile created

    } catch (error) {
      console.error('[NPC-BEAM] Failed to create NPC visual projectile:', error);
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
    const playerId = this.clientNetworkSystem.getLocalClientId();

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
   * Imposta il sistema per i testi di danno
   */
  public setDamageSystem(damageSystem: any): void {
    this.damageSystem = damageSystem;
  }

  public setAssetManager(assetManager: AssetManager): void {
    this.assetManager = assetManager;

    // DEBUG: Inizializza tool di debug per i laser quando tutti i sistemi sono pronti
    this.initializeDebugTools();
  }

  /**
   * Inizializza tool di debug per testare i laser
   */
  private initializeDebugTools(): void {
    if (typeof window !== 'undefined') {
      (window as any).testLaser = (startX: number = 400, startY: number = 300, targetX: number = 600, targetY: number = 400) => {
        console.log('[DEBUG] Creating test laser from', startX, startY, 'to', targetX, targetY);
        this.createTestLaser(startX, startY, targetX, targetY);
      };

      (window as any).clearLasers = () => {
        console.log('[DEBUG] Clearing all visual projectiles');
        this.removeAllActiveBeams();
      };

      // Laser test tools initialized silently
    }
  }

  /**
   * Crea un testo di danno per un'entità
   */
  public createDamageText(targetEntity: Entity, damage: number, isShieldDamage: boolean = false, isBoundsDamage: boolean = false, projectileType?: 'laser' | 'npc_laser'): void {
    if (this.damageSystem) {
      this.damageSystem.createDamageText(targetEntity, damage, isShieldDamage, isBoundsDamage, projectileType);
    }
  }

  /**
   * Verifica se una posizione è in una Safe Zone
   */
  private isInSafeZone(x: number, y: number): boolean {
    for (const zone of CONFIG.SAFE_ZONES) {
      const dx = x - zone.x;
      const dy = y - zone.y;
      if (dx * dx + dy * dy <= zone.radius * zone.radius) {
        return true;
      }
    }
    return false;
  }

  /**
   * Rimuove tutti i proiettili visivi attivi dalla scena
   */
  private removeAllActiveBeams(): void {
    // Rimuovi tutti i proiettili che hanno damage = 0 (sono visivi)
    const allProjectiles = this.ecs.getEntitiesWithComponents(Projectile);
    for (const projectileEntity of allProjectiles) {
      const projectile = this.ecs.getComponent(projectileEntity, Projectile);
      if (projectile && projectile.damage === 0) {
        // Questo è un proiettile visivo, rimuovilo
        if (this.ecs.entityExists(projectileEntity.id)) {
          this.ecs.removeEntity(projectileEntity);
        }
      }
    }
    this.activeBeamEntities.clear();
  }

  /**
   * Crea effetto proiettili visivi dal player all'NPC selezionato
   * Questi sono solo effetti visivi, il danno rimane gestito da hitscan lato server
   */
  private async createPlayerBeamEffect(targetNpc: any): Promise<void> {
    if (!this.ecs) {
      console.error('[PLAYER-BEAM] ECS not available');
      return;
    }

    // Ottieni direttamente l'entità player dal PlayerSystem
    const playerEntity = this.playerSystem?.getPlayerEntity();
    if (!playerEntity) {
      console.warn('[PLAYER-BEAM] Player entity not found');
      return;
    }

    // Usa direttamente l'entità NPC target (è già stata validata)
    const npcEntity = targetNpc;

    // Ottieni trasform dei due punti
    const playerTransform = this.ecs.getComponent(playerEntity, Transform);
    const npcTransform = this.ecs.getComponent(npcEntity, Transform);

    if (!playerTransform || !npcTransform) {
      console.warn('[PLAYER-BEAM] Missing transforms for beam effect');
      return;
    }

    // Crea proiettile visivo che viaggia dal player all'NPC
    // Questo è solo un effetto visivo, il danno è gestito da hitscan

    // Usa coordinate mondo reali: dal player all'NPC
    const startX = playerTransform.x;
    const startY = playerTransform.y;
    const targetX = npcTransform.x;
    const targetY = npcTransform.y;

    // Calcola il vettore direzione verso il target
    const dx = targetX - startX;
    const dy = targetY - startY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Normalizza la direzione
    const dirX = dx / distance;
    const dirY = dy / distance;

    // Calcola il vettore perpendicolare (ruotato di 90 gradi) per l'offset laterale
    // Perpendicolare a (x, y) è (-y, x)
    const perpX = -dirY;
    const perpY = dirX;

    // Configura l'offset laterale (distanza dal centro)
    const lateralOffset = 18; // 18px dal centro per ogni lato

    // Calcola i punti di inizio sinistro e destro
    const leftStartX = startX + (perpX * lateralOffset);
    const leftStartY = startY + (perpY * lateralOffset);

    const rightStartX = startX - (perpX * lateralOffset);
    const rightStartY = startY - (perpY * lateralOffset);

    // Usa serverId dell'NPC invece dell'entity.id per il targeting
    const npcComponent = this.ecs.getComponent(npcEntity, Npc);
    const targetId = npcComponent?.serverId || npcEntity.id.toString();

    // Crea DUE proiettili visivi (sinistro e destro)
    // Passiamo un flag per evitare il doppio suono
    await this.createVisualProjectile(leftStartX, leftStartY, targetX, targetY, playerEntity.id, targetId, true);
    await this.createVisualProjectile(rightStartX, rightStartY, targetX, targetY, playerEntity.id, targetId, false);
  }

  /**
   * Crea un proiettile visivo che viaggia dal player all'NPC
   * Questo è solo un effetto visivo, il danno rimane gestito da hitscan
   */
  public async createTestLaser(startX: number, startY: number, targetX: number, targetY: number): Promise<void> {
    const playerEntity = this.playerSystem?.getPlayerEntity();
    if (playerEntity) {
      await this.createVisualProjectile(startX, startY, targetX, targetY, playerEntity.id, -1);
    }
  }

  /**
   * Crea beam effect per qualsiasi player (locale o remoto)
   * Metodo STATICO per riutilizzo da altri sistemi senza duplicare codice
   */
  public static async createBeamEffectForPlayer(
    ecs: any,
    assetManager: any,
    audioSystem: any,
    playerId: string,
    playerPosition: { x: number; y: number },
    targetPositionOrVelocity: { x: number; y: number } | { velocity: { x: number; y: number } },
    targetId: string,
    activeBeamEntities?: Set<number> // Opzionale per tracciamento
  ): Promise<void> {
    if (!assetManager) {
      console.warn('[BEAM-EFFECT] AssetManager not available, skipping beam effect');
      return;
    }

    try {
      // Suono laser (stesso del player locale)
      if (audioSystem) {
        // 🚀 FIX SPAZIALE: Usa playSoundAt per attenuare i laser lontani
        audioSystem.playSoundAt(
          'laser',
          playerPosition.x,
          playerPosition.y,
          { volume: 0.03, allowMultiple: true, category: 'effects' }
        );
      }

      // Carica immagine laser (stessa del player locale)
      const laserImage = await assetManager.loadImage('assets/laser/laser1/laser1.png');

      // Determina se abbiamo una posizione target o una velocity
      let config: any;

      if ('velocity' in targetPositionOrVelocity) {
        // Usa velocity diretta (per laser remoti)
        // Calcola target position basato sulla velocity per permettere calcolo direzione
        const targetX = playerPosition.x + targetPositionOrVelocity.velocity.x * 1000; // Target lontano nella direzione del movimento
        const targetY = playerPosition.y + targetPositionOrVelocity.velocity.y * 1000;
        config = {
          damage: 0, // SOLO VISIVO
          startX: playerPosition.x,
          startY: playerPosition.y,
          targetX: targetX,
          targetY: targetY,
          velocity: targetPositionOrVelocity.velocity, // Usa velocity originale
          ownerId: parseInt(playerId) || 0,
          targetId: parseInt(targetId) || -1,
          projectileType: 'laser',
          lifetime: 15000 // Stessa durata
        };
      } else {
        // Usa posizione target (per laser locali o calcolati)
        config = {
          damage: 0, // SOLO VISIVO
          startX: playerPosition.x,
          startY: playerPosition.y,
          targetX: targetPositionOrVelocity.x,
          targetY: targetPositionOrVelocity.y,
          ownerId: parseInt(playerId) || 0,
          targetId: targetId || -1,
          projectileType: 'laser',
          speed: GAME_CONSTANTS.PROJECTILE.VISUAL_SPEED, // Stessa velocità lenta
          lifetime: 15000 // Stessa durata
        };
      }

      // Crea proiettile visivo
      const visualEntity = ProjectileFactory.create(ecs, config);

      // Aggiungi componenti (stessi del player locale)
      const laserSprite = new Sprite(laserImage, laserImage.width, laserImage.height);
      ecs.addComponent(visualEntity, Sprite, laserSprite);

      const visualState = new ProjectileVisualState();
      ecs.addComponent(visualEntity, ProjectileVisualState, visualState);

      // Tracciamento opzionale
      if (activeBeamEntities) {
        activeBeamEntities.add(visualEntity.id);
      }

      /*
      const velocity = ecs.getComponent(visualEntity, 'Velocity');
      console.log('[BEAM-EFFECT] Created unified beam effect for player:', {
        playerId,
        visualEntityId: visualEntity.id,
        targetId,
        usedVelocity: 'velocity' in targetPositionOrVelocity,
        hasVelocity: !!velocity,
        velocityX: velocity?.x,
        velocityY: velocity?.y,
        speed: Math.sqrt((velocity?.x || 0) ** 2 + (velocity?.y || 0) ** 2)
      });
      */

    } catch (error) {
      console.warn('[BEAM-EFFECT] Failed to create beam effect:', error);
    }
  }

  /**
   * Crea un proiettile visivo che viaggia dal player all'NPC
   * Questo è solo un effetto visivo, il danno rimane gestito da hitscan
   */
  private async createVisualProjectile(startX: number, startY: number, targetX: number, targetY: number, ownerId: number, targetId: number, playSound: boolean = true): Promise<void> {
    // ✅ RIUTILIZZA IL METODO STATICO CONDIVISO
    // Elimina duplicazione di codice - usa la stessa logica per tutti i giocatori
    const audioSystem = this.clientNetworkSystem?.getAudioSystem();

    // Gestisci throttling suono per player locale (evita spam)
    let shouldPlaySound = playSound;
    if (audioSystem && shouldPlaySound) {
      const now = Date.now();
      if ((now - this.lastLaserSoundTime) < 100) { // Minimo 100ms tra suoni
        shouldPlaySound = false;
      } else {
        this.lastLaserSoundTime = now;
      }
    }

    await CombatStateSystem.createBeamEffectForPlayer(
      this.ecs,
      this.assetManager,
      shouldPlaySound ? audioSystem : null, // Passa null se throttling attivo
      ownerId.toString(),
      { x: startX, y: startY },
      { x: targetX, y: targetY },
      targetId.toString(),
      this.activeBeamEntities // Passa il Set per tracciamento
    );
  }

  /**
   * Cleanup delle risorse
   */
  public destroy(): void {
    // Rimuovi tutti i laser beam attivi
    this.removeAllActiveBeams();

    // Pulisci il tracking dei laser NPC e suoni
    this.npcLaserFireTimes.clear();
    this.npcLastInRange.clear();
    this.lastLaserSoundTime = 0;

    this.clientNetworkSystem = null;
    this.cameraSystem = null;
    this.playerSystem = null;
    this.playerControlSystem = null;
    this.logSystem = null;
    this.damageSystem = null;
    this.currentAttackTarget = null;
    this.attackStartedLogged = false;
    this.lastAttackActivatedState = false;
  }
}