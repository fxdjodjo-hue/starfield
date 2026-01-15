import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import type { EntityId } from '../../infrastructure/ecs/Entity';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { Damage } from '../../entities/combat/Damage';
import { DamageTaken } from '../../entities/combat/DamageTaken';
import { DamageText } from '../../entities/combat/DamageText';
import { Explosion } from '../../entities/combat/Explosion';
import { Transform } from '../../entities/spatial/Transform';
import { Velocity } from '../../entities/spatial/Velocity';
import { SelectedNpc } from '../../entities/combat/SelectedNpc';
import { Npc } from '../../entities/ai/Npc';
import { Projectile } from '../../entities/combat/Projectile';
import { Sprite } from '../../entities/Sprite';
import { CameraSystem } from '../rendering/CameraSystem';
import { LogSystem } from '../rendering/LogSystem';
import { GameContext } from '../../infrastructure/engine/GameContext';
import { PlayerSystem } from '../player/PlayerSystem';
import { PlayerControlSystem } from '../input/PlayerControlSystem';
import { ClientNetworkSystem } from '../../multiplayer/client/ClientNetworkSystem';
import AudioSystem from '../audio/AudioSystem';
import { GAME_CONSTANTS } from '../../config/GameConstants';
import { AtlasParser } from '../../utils/AtlasParser';
import { calculateDirection } from '../../utils/MathUtils';
import { ProjectileFactory } from '../../factories/ProjectileFactory';

/**
 * Sistema di combattimento - gestisce gli scontri tra entità
 * Gestisce attacchi, danni e logica di combattimento
 */
export class CombatSystem extends BaseSystem {
  private cameraSystem: CameraSystem;
  private playerControlSystem: PlayerControlSystem | null = null;
  private logSystem: LogSystem | null = null;
  private gameContext: GameContext;
  private playerSystem: PlayerSystem;
  private clientNetworkSystem: ClientNetworkSystem | null = null; // Sistema di rete per notifiche multiplayer
  private audioSystem: AudioSystem | null = null;
  private activeDamageTexts: Map<number, number> = new Map(); // entityId -> count
  private attackStartedLogged: boolean = false; // Flag per evitare log multipli di inizio attacco
  private currentAttackTarget: number | null = null; // ID dell'NPC attualmente sotto attacco
 // Posizione dove è avvenuto l'ultimo combattimento
  private explosionFrames: HTMLImageElement[] | null = null; // Cache dei frame dell'esplosione
  private explodingEntities: Set<number> = new Set(); // Traccia entità già in esplosione

  constructor(ecs: ECS, cameraSystem: CameraSystem, gameContext: GameContext, playerSystem: PlayerSystem, clientNetworkSystem: ClientNetworkSystem | null = null) {
    super(ecs);
    this.cameraSystem = cameraSystem;
    this.gameContext = gameContext;
    this.playerSystem = playerSystem;
    this.clientNetworkSystem = clientNetworkSystem;
  }

  /**
   * Imposta il sistema di rete per notifiche multiplayer
   */
  setClientNetworkSystem(clientNetworkSystem: ClientNetworkSystem): void {
    this.clientNetworkSystem = clientNetworkSystem;
  }

  /**
   * Imposta il sistema audio per i suoni di combattimento
   */
  setAudioSystem(audioSystem: AudioSystem): void {
    this.audioSystem = audioSystem;
  }

  /**
   * Imposta il riferimento al sistema di controllo del player
   */
  setPlayerControlSystem(playerControlSystem: PlayerControlSystem): void {
    this.playerControlSystem = playerControlSystem;
  }

  /**
   * Imposta i frame dell'esplosione precaricati per evitare lag
   */
  setPreloadedExplosionFrames(frames: HTMLImageElement[]): void {
    this.explosionFrames = frames;
  }


  update(deltaTime: number): void {

    // Rimuovi tutte le entità morte
    this.removeDeadEntities();

    // Combattimento automatico per NPC selezionati
    this.processPlayerCombat();

    // NPC combat disabilitato - tutto gestito lato server automaticamente
    // const allNpcs = this.ecs.getEntitiesWithComponents(Npc, Damage, Transform);
    // for (const attackerEntity of allNpcs) {
    //   this.processNpcCombat(attackerEntity);
    // }

    // Elabora il combattimento per un NPC selezionato (player combatte automaticamente)
  }

  /**
   * Elabora il combattimento per un NPC che attacca il player quando nel range
   */
  private processNpcCombat(attackerEntity: Entity): void {
    console.warn(`⚠️ [COMBAT] NPC combat called for entity ${attackerEntity.id} - THIS SHOULD NOT HAPPEN in automatic combat!`);

    const attackerTransform = this.ecs.getComponent(attackerEntity, Transform);
    const attackerDamage = this.ecs.getComponent(attackerEntity, Damage);

    if (!attackerTransform || !attackerDamage) return;

    // Verifica se l'NPC è stato danneggiato recentemente (solo NPC danneggiati attaccano)
    // ECCEZIONE: NPC in modalità aggressive attaccano anche senza essere stati danneggiati
    const npc = this.ecs.getComponent(attackerEntity, Npc);
    const canAttackAggressively = npc && npc.behavior === 'aggressive';

    const damageTaken = this.ecs.getComponent(attackerEntity, DamageTaken);
    if (!canAttackAggressively && (!damageTaken || !damageTaken.wasDamagedRecently(Date.now(), 10000))) {
      // L'NPC non può attaccare aggressivamente e non è stato danneggiato negli ultimi 10 secondi
      return;
    }

    // NPC che attaccano devono sempre puntare verso il player (MA NON quelli in fuga!)
    if (npc && (canAttackAggressively || (damageTaken && damageTaken.wasDamagedRecently(Date.now(), 10000))) && npc.behavior !== 'flee') {
      this.facePlayer(attackerTransform, attackerEntity);
    }

    // Trova il player come target
    const playerEntity = this.playerSystem.getPlayerEntity();

    if (!playerEntity) return;

    const targetTransform = this.ecs.getComponent(playerEntity, Transform);
    const targetHealth = this.ecs.getComponent(playerEntity, Health);

    if (!targetTransform || !targetHealth) return;

    // Verifica se l'NPC può attaccare (cooldown e range)
    if (attackerDamage.isInRange(attackerTransform.x, attackerTransform.y, targetTransform.x, targetTransform.y) &&
        attackerDamage.canAttack(Date.now())) {
      // Esegui l'attacco
      this.performAttack(attackerEntity, attackerTransform, attackerDamage, targetTransform, playerEntity);
    }
  }

  /**
   * Crea un proiettile dall'attaccante verso il target
   */
  private performAttack(attackerEntity: Entity, attackerTransform: Transform, attackerDamage: Damage, targetTransform: Transform, targetEntity: Entity): void {

    // Usa la rotazione corrente dell'NPC per la direzione del proiettile
    // Gli NPC in modalità aggressive mantengono la rotazione verso il player
    const isPlayer = attackerEntity === this.playerSystem.getPlayerEntity();

    let directionX: number, directionY: number;

    if (isPlayer) {
      // Player: calcola direzione dal target usando utility centralizzata
      const { direction } = calculateDirection(
        attackerTransform.x, attackerTransform.y,
        targetTransform.x, targetTransform.y
      );
      directionX = direction.x;
      directionY = direction.y;
    } else {
      // NPC: usa la rotazione corrente (stabilita dal comportamento aggressive)
      // Gli NPC aggressive dovrebbero già essere rivolti verso il player
      const angle = attackerTransform.rotation;
      directionX = Math.cos(angle);
      directionY = Math.sin(angle);
    }

    if (isPlayer) {
      // Player: crea singolo laser
      // Nota: l'audio viene riprodotto in ProjectileFiredHandler quando arriva il proiettile dal server
      // (poiché l'attacco è completamente automatico senza input manuale)
      this.createSingleLaser(attackerEntity, attackerTransform, attackerDamage, targetTransform, targetEntity, directionX, directionY);
    } else {
      // NPC: non creare proiettile locale - il server gestisce tutti i proiettili NPC
      // Nota: tutti i suoni NPC vengono riprodotti in ProjectileFiredHandler quando arrivano dal server
      // Registra solo il cooldown per evitare spam di suoni
      attackerDamage.performAttack(Date.now());
    }
  }

  /**
   * Crea un singolo laser per il player
   */
  private createSingleLaser(attackerEntity: Entity, attackerTransform: Transform, attackerDamage: Damage, targetTransform: Transform, targetEntity: Entity, directionX: number, directionY: number): void {
    // Crea singolo laser con danno completo
    const laserDamage = attackerDamage.damage;

    this.createProjectileAt(attackerEntity, attackerTransform, laserDamage, directionX, directionY, targetEntity);

    // Registra l'attacco per il cooldown
    attackerDamage.performAttack(Date.now());
  }

  /**
   * Crea un singolo proiettile (usato dagli NPC)
   */
  private createSingleProjectile(attackerEntity: Entity, attackerTransform: Transform, attackerDamage: Damage, targetTransform: Transform, targetEntity: Entity, directionX: number, directionY: number): void {
    this.createProjectileAt(attackerEntity, attackerTransform, attackerDamage.damage, directionX, directionY, targetEntity);

    // Registra l'attacco per il cooldown
    attackerDamage.performAttack(Date.now());
  }

  /**
   * Crea un proiettile in una posizione e direzione specifica
   */
  private createProjectileAt(attackerEntity: Entity, attackerTransform: Transform, damage: number, directionX: number, directionY: number, targetEntity: Entity): void {
    // Genera ID univoco per il proiettile (per sincronizzazione multiplayer)
    const projectileId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Determina se è il player locale
    const playerEntity = this.playerSystem.getPlayerEntity();
    const isLocalPlayer = playerEntity && attackerEntity.id === playerEntity.id;

    // Calcola posizione target per la factory
    const targetX = attackerTransform.x + directionX * GAME_CONSTANTS.PROJECTILE.SPAWN_OFFSET * 2; // Moltiplica per 2 per compensare
    const targetY = attackerTransform.y + directionY * GAME_CONSTANTS.PROJECTILE.SPAWN_OFFSET * 2;

    // Crea proiettile usando factory centralizzata
    const projectileEntity = ProjectileFactory.createProjectile(
      this.ecs,
      damage,
      attackerTransform.x,
      attackerTransform.y,
      targetX,
      targetY,
      attackerEntity.id,
      targetEntity.id,
      isLocalPlayer && this.clientNetworkSystem ? this.clientNetworkSystem.getLocalClientId() : `npc_${attackerEntity.id}`
    );

    // Aggiungi ID univoco al proiettile per tracking multiplayer
    const projectileComponent = this.ecs.getComponent(projectileEntity, Projectile);
    if (projectileComponent) {
      (projectileComponent as any).id = projectileId;
    }

    // 🚫 CLIENT NON INVIA PIÙ projectile_fired PER IL PLAYER
    // Il server gestisce tutti i proiettili del player in modalità Server Authoritative
    // Solo gli NPC inviano projectile_fired per sincronizzazione
  }
  }

  /**
   * Crea un testo di danno (chiamato dal ProjectileSystem quando applica danno)
   */
  createDamageText(targetEntity: Entity, damage: number, isShieldDamage: boolean = false, isBoundsDamage: boolean = false): void {
    if (damage <= 0) {
      return;
    }

    const targetEntityId = targetEntity.id;

    // Controlla quanti testi sono già attivi per questa entità
    const activeCount = this.activeDamageTexts.get(targetEntityId) || 0;
    // Per danni bounds non applicare limiti - mostra sempre
    if (!isBoundsDamage && activeCount >= 3) return;

    // Determina il colore e offset del testo
    const playerEntity = this.playerSystem.getPlayerEntity();
    const isPlayerDamage = playerEntity && targetEntityId === playerEntity.id;

    let textColor: string;
    let offsetY: number;
    let offsetX: number;

    if (isShieldDamage) {
      textColor = '#4444ff'; // Blu per shield
      offsetY = -30;
      offsetX = (Math.random() - 0.5) * 25; // ±12.5px
    } else {
      textColor = isPlayerDamage ? '#ff4444' : '#ffffff'; // Rosso per danno al player, bianco per danno agli NPC
      offsetY = -30; // Default, sarà aggiustato sotto
      offsetX = (Math.random() - 0.5) * 20; // ±10px
    }

    // Se abbiamo appena applicato danno shield, il prossimo danno HP va più in basso
    if (!isShieldDamage && this.hasRecentShieldDamage(targetEntity)) {
      offsetY = -15; // HP più in basso quando c'è stato danno shield
    }

    // Crea il testo di danno
    const damageTextEntity = this.ecs.createEntity();
    const damageText = new DamageText(damage, targetEntityId, offsetX, offsetY, textColor);
    this.ecs.addComponent(damageTextEntity, DamageText, damageText);

    // Aggiorna il contatore
    this.activeDamageTexts.set(targetEntityId, activeCount + 1);
  }

  /**
   * Controlla se l'entità ha subito danno shield recentemente
   */
  private hasRecentShieldDamage(targetEntity: Entity): boolean {
    // Per ora semplificato - controlla se ha uno shield attivo con danni recenti
    // In futuro potrebbe usare un timestamp più sofisticato
    const shield = this.ecs.getComponent(targetEntity, Shield);
    return !!(shield && (shield.isActive() ?? false) && shield.current < shield.max);
  }

  /**
   * Ruota l'entità attaccante per puntare verso il target
   */
  private faceTarget(attackerTransform: Transform, targetTransform: Transform): void {
    const dx = targetTransform.x - attackerTransform.x;
    const dy = targetTransform.y - attackerTransform.y;

    // Calcola l'angolo e ruota la nave
    const angle = Math.atan2(dy, dx) + Math.PI / 2;
    attackerTransform.rotation = angle;
  }

  /**
   * Ruota l'NPC verso il player
   */
  private facePlayer(npcTransform: Transform, npcEntity: Entity): void {
    // Trova il player (entità con Transform ma senza componente Npc)
    const playerEntities = this.ecs.getEntitiesWithComponents(Transform)
      .filter(entity => !this.ecs.hasComponent(entity, Npc));

    if (playerEntities.length === 0) return;

    const playerTransform = this.ecs.getComponent(playerEntities[0], Transform);
    if (!playerTransform) return;

    // Ruota l'NPC verso il player
    this.faceTarget(npcTransform, playerTransform);
  }

  /**
   * Gestisce le richieste di combattimento al server (server-authoritative combat)
   */
  private processPlayerCombat(): void {
    // Trova il player (serve per la riselezione automatica)
    const playerEntity = this.playerSystem.getPlayerEntity();
    const playerDamage = playerEntity ? this.ecs.getComponent(playerEntity, Damage) : null;

    // Log di debug per vedere se la funzione viene chiamata

    // Trova l'NPC selezionato
    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);

    if (selectedNpcs.length === 0) {
      // Se non ci sono NPC selezionati, ferma qualsiasi combattimento attivo
      if (this.currentAttackTarget !== null) {
        this.sendStopCombat();
        this.endAttackLogging();
        this.currentAttackTarget = null;
        this.attackStartedLogged = false;
      }
      return;
    }

    const selectedNpc = selectedNpcs[0];

    // Verifica che abbiamo il player (dovrebbe già essere stato controllato sopra)
    if (!playerEntity || !playerDamage) return;

    const playerTransform = this.ecs.getComponent(playerEntity, Transform);
    const npcTransform = this.ecs.getComponent(selectedNpc, Transform);

    if (!playerTransform || !playerDamage || !npcTransform) return;

    // Controlla se l'NPC è ancora visibile nella viewport
    const canvasSize = (this.ecs as any).context?.canvas ?
                      { width: (this.ecs as any).context.canvas.width, height: (this.ecs as any).context.canvas.height } :
                      { width: window.innerWidth, height: window.innerHeight };

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

    const inRange = distance <= playerDamage.attackRange; // 600px
    const attackActivated = this.playerControlSystem?.isAttackActivated() || false;

    // Debug range consistency
    if (playerDamage.attackRange !== 600) {
      console.warn(`⚠️ [COMBAT] Player attackRange mismatch: expected 600, got ${playerDamage.attackRange}`);
    }

    if (inRange && attackActivated) {
      // Player in range E attacco attivato - inizia combattimento se non già attivo con questo target
      if (this.currentAttackTarget !== selectedNpc.id) {
        this.sendStartCombat(selectedNpc);
        this.startAttackLogging(selectedNpc);
        this.currentAttackTarget = selectedNpc.id;
        this.attackStartedLogged = true;
      }
    } else if (!inRange && this.currentAttackTarget === selectedNpc.id) {
      // Player uscito dal range - ferma combattimento
      this.sendStopCombat();
      this.endAttackLogging();
      this.currentAttackTarget = null;
      this.attackStartedLogged = false;
      this.wasInCombat = false;
    } else if (!attackActivated && this.currentAttackTarget !== null) {
      // Attacco disattivato - ferma qualsiasi combattimento in corso, indipendentemente dal target selezionato
      this.sendStopCombat();
      this.endAttackLogging();
      this.currentAttackTarget = null;
      this.attackStartedLogged = false;
      this.wasInCombat = false; // Reset wasInCombat if attack is manually deactivated
    }
  }

  /**
   * Invia richiesta di inizio combattimento al server
   */
  private sendStartCombat(npcEntity: Entity): void {

    if (!this.clientNetworkSystem) {
      return; // Non fare niente se non connesso
    }

    // Non controllare isConnected() qui - il metodo sendStartCombat del ClientNetworkSystem
    // controlla già se la connessione è attiva prima di inviare

    const npc = this.ecs.getComponent(npcEntity, Npc);
    if (!npc) {
      console.error(`📡 [CLIENT] Cannot send startCombat: NPC component not found for entity ${npcEntity.id}`);
      return;
    }

    // Usa l'ID server se disponibile, altrimenti l'ID entità locale
    const npcIdToSend = npc.serverId || npcEntity.id.toString();
    const playerId = this.clientNetworkSystem.gameContext.authId;

    // NON riprodurre suono qui - verrà riprodotto quando arriva il proiettile dal server
    // per evitare duplicazioni audio

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
   * Rimuove tutte le entità morte dal mondo (ora crea esplosione invece di rimuovere immediatamente)
   */
  private removeDeadEntities(): void {
    // Trova tutte le entità con componente Health
    const entitiesWithHealth = this.ecs.getEntitiesWithComponents(Health);

    // RIMOSSO: Check locale della morte
    // Le morti vengono ora gestite SOLO dal server attraverso messaggi entity_destroyed
    // Questo previene desincronizzazioni e danni locali non autorizzati
  }

  /**
   * Crea un effetto esplosione per un'entità morta
   */
  private async createExplosion(entity: Entity): Promise<void> {
    try {
      const npc = this.ecs.getComponent(entity, Npc);
      const entityType = npc ? `NPC-${npc.npcType}` : 'Player';

      // Verifica che l'entità esista ancora (potrebbe essere stata rimossa dal ProjectileSystem)
      if (!this.ecs.entityExists(entity.id)) {
        console.warn(`💥 [EXPLOSION] Cannot create explosion for ${entityType} entity ${entity.id}: entity no longer exists`);
        this.explodingEntities.delete(entity.id);
        return;
      }

      // Suono esplosione ora gestito dal server in modo sincronizzato
      // (rimosso per evitare duplicazione)

      // Carica i frame dell'esplosione se non già caricati
      if (!this.explosionFrames) {
        this.explosionFrames = await this.loadExplosionFrames();
      }

      // Verifica nuovamente che l'entità esista dopo il caricamento async
      if (!this.ecs.entityExists(entity.id)) {
        console.warn(`Cannot create explosion for entity ${entity.id}: entity removed during async operation`);
        this.explodingEntities.delete(entity.id);
        return;
      }

      // Rimuovi componenti non necessari per l'esplosione (mantieni Transform per la posizione)
      this.ecs.removeComponent(entity, Health);
      this.ecs.removeComponent(entity, Shield);
      this.ecs.removeComponent(entity, Damage);
      this.ecs.removeComponent(entity, DamageTaken);
      this.ecs.removeComponent(entity, SelectedNpc);
      this.ecs.removeComponent(entity, Npc);
      this.ecs.removeComponent(entity, Velocity); // Rimuovi velocità così l'esplosione rimane ferma

      // Aggiungi il componente esplosione
      const explosion = new Explosion(this.explosionFrames, 20, 1); // 20ms per frame - perfetto
      this.ecs.addComponent(entity, Explosion, explosion);

      // Notifica il sistema di rete per sincronizzazione multiplayer
      if (this.clientNetworkSystem) {
        const transform = this.ecs.getComponent(entity, Transform);
        if (transform) {
          // Determina il tipo di entità
          const hasNpc = this.ecs.hasComponent(entity, Npc);
          const entityType = hasNpc ? 'npc' : 'player';


          // Genera ID univoco per l'esplosione
          const explosionId = `expl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          // Invia notifica di esplosione creata
          this.clientNetworkSystem.sendExplosionCreated({
            explosionId,
            entityId: entity.id.toString(),
            entityType,
            position: { x: transform.x, y: transform.y },
            explosionType: 'entity_death'
          });
        }
      }


      // Pulisci il Set dopo che l'esplosione è finita (10 frame * 80ms = 800ms + margine)
      setTimeout(() => {
        this.explodingEntities.delete(entity.id);
      }, 1000);

    } catch (error) {
      console.error('Errore nel creare l\'esplosione:', error);
      // Rimuovi dall'insieme e fallback: rimuovi l'entità se fallisce il caricamento
      this.explodingEntities.delete(entity.id);
      this.ecs.removeEntity(entity);
    }
  }

  /**
   * Carica tutti i frame dell'animazione dell'esplosione
   */
  private async loadExplosionFrames(explosionType?: string): Promise<HTMLImageElement[]> {
    try {
      // Usa sempre la stessa esplosione per tutti gli entity
      const atlasPath = `/assets/explosions/explosions_npc/explosion.atlas`;

      const atlasData = await AtlasParser.parseAtlas(atlasPath);

      // Estrai tutti i frame definiti nell'atlas
      const frames = await AtlasParser.extractFrames(atlasData);

      return frames;
    } catch (error) {
      console.error('Failed to load explosion frames from atlas:', error);
      return [];
    }
  }

  /**
   * Imposta il riferimento al LogSystem per logging degli attacchi
   */
  setLogSystem(logSystem: LogSystem): void {
    this.logSystem = logSystem;
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
   * Decrementa il contatore dei testi di danno attivi per un'entità
   * Chiamato dal DamageTextSystem quando un testo scade
   */
  public decrementDamageTextCount(targetEntityId: number): void {
    const currentCount = this.activeDamageTexts.get(targetEntityId) || 0;
    if (currentCount > 0) {
      this.activeDamageTexts.set(targetEntityId, currentCount - 1);
      // Rimuovi la chiave se il contatore arriva a 0
      if (currentCount - 1 === 0) {
        this.activeDamageTexts.delete(targetEntityId);
      }
    }
  }

  /**
   * Cleanup delle risorse per prevenire memory leaks
   * Implementa l'interfaccia System.destroy()
   */
  public destroy(): void {
    // Pulisce tutte le mappe di stato
    this.activeDamageTexts.clear();
    this.explodingEntities.clear();

    // Reset dei riferimenti
    this.playerControlSystem = null;
    this.logSystem = null;
    this.clientNetworkSystem = null;
    this.audioSystem = null;

    // Reset delle variabili di stato del combattimento
    this.currentAttackTarget = null;
    this.attackStartedLogged = false;
  }

  /**
   * Ferma immediatamente il combattimento (chiamato quando disattivi manualmente l'attacco)
   */
  public stopCombatImmediately(): void {
    // Disattiva anche l'attacco nel PlayerControlSystem PRIMA di tutto
    this.deactivateAttackAfterCombatEnd();

    if (this.currentAttackTarget) {
      this.sendStopCombat();
      this.endAttackLogging();
      this.currentAttackTarget = null;
      this.attackStartedLogged = false;
      this.wasInCombat = false; // Reset wasInCombat on immediate stop
    }
  }

  /**
   * Disattiva l'attacco nel PlayerControlSystem quando finisce il combattimento
   */
  private deactivateAttackAfterCombatEnd(): void {
    const playerControlSystem = this.ecs.systems?.find((system) =>
      system instanceof PlayerControlSystem
    ) as PlayerControlSystem | undefined;

    if (playerControlSystem) {
      playerControlSystem.deactivateAttack();
    }
  }

}
