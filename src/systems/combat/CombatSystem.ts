import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
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
import { MovementSystem } from '../physics/MovementSystem';
import { LogSystem } from '../rendering/LogSystem';
import { GameContext } from '../../infrastructure/engine/GameContext';
import { PlayerSystem } from '../player/PlayerSystem';

/**
 * Sistema di combattimento - gestisce gli scontri tra entità
 * Gestisce attacchi, danni e logica di combattimento
 */
export class CombatSystem extends BaseSystem {
  private lastUpdateTime: number = Date.now();
  private movementSystem: MovementSystem;
  private logSystem: LogSystem | null = null;
  private gameContext: GameContext;
  private playerSystem: PlayerSystem;
  private audioSystem: any = null;
  private activeDamageTexts: Map<number, number> = new Map(); // entityId -> count
  private attackStartedLogged: boolean = false; // Flag per evitare log multipli di inizio attacco
  private currentAttackTarget: number | null = null; // ID dell'NPC attualmente sotto attacco
  private explosionFrames: HTMLImageElement[] | null = null; // Cache dei frame dell'esplosione

  constructor(ecs: ECS, movementSystem: MovementSystem, gameContext: GameContext, playerSystem: PlayerSystem) {
    super(ecs);
    this.movementSystem = movementSystem;
    this.gameContext = gameContext;
    this.playerSystem = playerSystem;
  }

  /**
   * Imposta il sistema audio per i suoni di combattimento
   */
  setAudioSystem(audioSystem: any): void {
    this.audioSystem = audioSystem;
  }

  update(deltaTime: number): void {
    this.lastUpdateTime = Date.now();

    // Rimuovi tutte le entità morte
    this.removeDeadEntities();

    // Combattimento automatico per NPC selezionati
    this.processPlayerCombat();

    // NPC attaccano automaticamente il player quando nel range (tutti gli NPC, non solo selezionati)
    const allNpcs = this.ecs.getEntitiesWithComponents(Npc, Damage, Transform);

    for (const attackerEntity of allNpcs) {
      this.processNpcCombat(attackerEntity);
    }

    // Elabora il combattimento per un NPC selezionato (player combatte automaticamente)
  }

  /**
   * Elabora il combattimento per un NPC che attacca il player quando nel range
   */
  private processNpcCombat(attackerEntity: any): void {
    const attackerTransform = this.ecs.getComponent(attackerEntity, Transform);
    const attackerDamage = this.ecs.getComponent(attackerEntity, Damage);

    if (!attackerTransform || !attackerDamage) return;

    // Verifica se l'NPC è stato danneggiato recentemente (solo NPC danneggiati attaccano)
    const damageTaken = this.ecs.getComponent(attackerEntity, DamageTaken);
    if (!damageTaken || !damageTaken.wasDamagedRecently(Date.now(), 10000)) {
      // L'NPC non è stato danneggiato negli ultimi 10 secondi, non attacca
      return;
    }

    // Trova il player come target
    const playerEntity = this.playerSystem.getPlayerEntity();

    if (!playerEntity) return;

    const targetTransform = this.ecs.getComponent(playerEntity, Transform);
    const targetHealth = this.ecs.getComponent(playerEntity, Health);

    if (!targetTransform || !targetHealth) return;

    // Verifica se l'NPC può attaccare (cooldown e range)
    if (attackerDamage.isInRange(attackerTransform.x, attackerTransform.y, targetTransform.x, targetTransform.y) &&
        attackerDamage.canAttack(this.lastUpdateTime)) {
      // Esegui l'attacco
      this.performAttack(attackerEntity, attackerTransform, attackerDamage, targetTransform, playerEntity);
    }
  }

  /**
   * Crea un proiettile dall'attaccante verso il target
   */
  private performAttack(attackerEntity: any, attackerTransform: Transform, attackerDamage: Damage, targetTransform: Transform, targetEntity: any): void {
    // Calcola direzione del proiettile (verso il target)
    const dx = targetTransform.x - attackerTransform.x;
    const dy = targetTransform.y - attackerTransform.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Normalizza la direzione
    const directionX = dx / distance;
    const directionY = dy / distance;

    // Verifica se l'attaccante è il player per applicare laser duali
    const isPlayer = attackerEntity === this.playerSystem.getPlayerEntity();

    if (isPlayer) {
      // Riproduci suono laser una volta per lo sparo
      if (this.audioSystem) {
        this.audioSystem.playSound('laser', 0.4, false, true); // allowMultiple=true per affidabilità
      }

      // Player: crea due laser laterali
      this.createDualLasers(attackerEntity, attackerTransform, attackerDamage, targetTransform, targetEntity, directionX, directionY);
    } else {
      // NPC: crea singolo proiettile come prima
      this.createSingleProjectile(attackerEntity, attackerTransform, attackerDamage, targetTransform, targetEntity, directionX, directionY);
    }
  }

  /**
   * Crea due laser laterali per il player (modifica visiva, danno invariato)
   */
  private createDualLasers(attackerEntity: any, attackerTransform: Transform, attackerDamage: Damage, targetTransform: Transform, targetEntity: any, baseDirectionX: number, baseDirectionY: number): void {
    // Angolo di deviazione per i laser laterali (circa 60 gradi)
    const deviationAngle = Math.PI / 3; // 60 gradi in radianti

    // Calcola le direzioni deviate
    const cos = Math.cos(deviationAngle);
    const sin = Math.sin(deviationAngle);

    // Laser sinistro
    const leftDirectionX = baseDirectionX * cos - baseDirectionY * sin;
    const leftDirectionY = baseDirectionX * sin + baseDirectionY * cos;

    // Laser destro
    const rightDirectionX = baseDirectionX * cos + baseDirectionY * sin;
    const rightDirectionY = -baseDirectionX * sin + baseDirectionY * cos;

    // Crea i due laser visivi: uno con danno completo (500), l'altro puramente visivo (0)
    const fullDamage = attackerDamage.damage; // 500 danni
    const visualOnlyDamage = 0; // Solo effetto visivo

    this.createProjectileAt(attackerEntity, attackerTransform, fullDamage, leftDirectionX, leftDirectionY, targetEntity);
    this.createProjectileAt(attackerEntity, attackerTransform, visualOnlyDamage, rightDirectionX, rightDirectionY, targetEntity);

    // Registra l'attacco per il cooldown
    attackerDamage.performAttack(this.lastUpdateTime);
  }

  /**
   * Crea un singolo proiettile (usato dagli NPC)
   */
  private createSingleProjectile(attackerEntity: any, attackerTransform: Transform, attackerDamage: Damage, targetTransform: Transform, targetEntity: any, directionX: number, directionY: number): void {
    this.createProjectileAt(attackerEntity, attackerTransform, attackerDamage.damage, directionX, directionY, targetEntity);

    // Registra l'attacco per il cooldown
    attackerDamage.performAttack(this.lastUpdateTime);
  }

  /**
   * Crea un proiettile in una posizione e direzione specifica
   */
  private createProjectileAt(attackerEntity: any, attackerTransform: Transform, damage: number, directionX: number, directionY: number, targetEntity: any): void {
    // Crea il proiettile leggermente avanti all'attaccante per evitare auto-collisione
    const projectileX = attackerTransform.x + directionX * 25; // 25 pixel avanti (dimensione nave)
    const projectileY = attackerTransform.y + directionY * 25;

    // Crea l'entità proiettile
    const projectileEntity = this.ecs.createEntity();

    // Aggiungi componenti al proiettile
    const projectileTransform = new Transform(projectileX, projectileY, 0, 1, 1);
    const projectile = new Projectile(damage, 400, directionX, directionY, attackerEntity.id, targetEntity.id, 3000);

    this.ecs.addComponent(projectileEntity, Transform, projectileTransform);
    this.ecs.addComponent(projectileEntity, Projectile, projectile);
  }

  /**
   * Crea un testo di danno (chiamato dal ProjectileSystem quando applica danno)
   */
  createDamageText(targetEntity: any, damage: number, isShieldDamage: boolean = false, isBoundsDamage: boolean = false): void {
    if (damage <= 0) return;

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
  private hasRecentShieldDamage(targetEntity: any): boolean {
    // Per ora semplificato - controlla se ha uno shield attivo con danni recenti
    // In futuro potrebbe usare un timestamp più sofisticato
    const shield = this.ecs.getComponent(targetEntity, Shield);
    return shield && shield.isActive() === true && shield.current < shield.max;
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
   * Elabora il combattimento automatico del player contro NPC selezionati
   */
  private processPlayerCombat(): void {
    // Trova l'NPC selezionato
    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
    if (selectedNpcs.length === 0) {
      // Reset dei flag quando non c'è nessun NPC selezionato
      this.attackStartedLogged = false;
      if (this.currentAttackTarget !== null) {
        this.endAttackLogging();
      }
      return;
    }

    const selectedNpc = selectedNpcs[0];

    // Trova il player
    const playerEntity = this.playerSystem.getPlayerEntity();

    if (!playerEntity) return;

    const playerTransform = this.ecs.getComponent(playerEntity, Transform);
    const playerDamage = this.ecs.getComponent(playerEntity, Damage);
    const npcHealth = this.ecs.getComponent(selectedNpc, Health);

    if (!playerTransform || !playerDamage || !npcHealth) return;

    // Controlla se il player è nel range di attacco
    const npcTransform = this.ecs.getComponent(selectedNpc, Transform);
    if (!npcTransform) return;

    // Controlla se l'NPC selezionato è ancora visibile nella viewport
    const canvasSize = (this.ecs as any).context?.canvas ?
                      { width: (this.ecs as any).context.canvas.width, height: (this.ecs as any).context.canvas.height } :
                      { width: window.innerWidth, height: window.innerHeight };

    // Usa la camera dal MovementSystem
    const camera = this.movementSystem.getCamera();
    const npcScreenPos = camera.worldToScreen(npcTransform.x, npcTransform.y, canvasSize.width, canvasSize.height);

    // Margine di sicurezza per considerare "fuori schermo"
    const margin = 100;
    const isOffScreen = npcScreenPos.x < -margin ||
                       npcScreenPos.x > canvasSize.width + margin ||
                       npcScreenPos.y < -margin ||
                       npcScreenPos.y > canvasSize.height + margin;

    if (isOffScreen) {
      // NPC uscito dalla visuale - deseleziona automaticamente
      this.ecs.removeComponent(selectedNpc, SelectedNpc);

      // Se stavamo attaccando questo NPC, logga attacco fallito
      if (this.currentAttackTarget === selectedNpc.id && this.logSystem) {
        const npc = this.ecs.getComponent(selectedNpc, Npc);
        if (npc) {
          this.logSystem.logAttackFailed(npc.npcType);
        }
      }

      // Reset dei flag
      this.currentAttackTarget = null;
      this.attackStartedLogged = false;

      return; // Esci dalla funzione, non continuare con la logica di combattimento
    }

    if (playerDamage.isInRange(
      playerTransform.x, playerTransform.y,
      npcTransform.x, npcTransform.y
    )) {
      // Inizia logging attacco se non è stato ancora loggato per questo combattimento
      if (!this.attackStartedLogged) {
        this.startAttackLogging(selectedNpc);
        this.attackStartedLogged = true;
      }

      if (playerDamage.canAttack(this.lastUpdateTime)) {
        // Ruota il player verso l'NPC prima di attaccare
        this.faceTarget(playerTransform, npcTransform);

        // Il player spara un proiettile verso l'NPC
        this.performAttack(playerEntity, playerTransform, playerDamage, npcTransform, selectedNpc);
      }
    } else {
      // Fuori range - se stavamo attaccando questo NPC, l'attacco è finito
      if (this.currentAttackTarget === selectedNpc.id) {
        this.endAttackLogging();
        this.attackStartedLogged = false; // Reset per permettere nuovi attacchi
      }
    }
    // Nota: L'attacco finisce quando il player si allontana troppo (500px)
    // ma la selezione rimane attiva finché non superi questa distanza massima
  }


  /**
   * Permette al player di attaccare un NPC selezionato (per uso futuro)
   */
  attackSelectedNpc(): void {
    // Trova l'NPC selezionato
    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
    if (selectedNpcs.length === 0) return;

    const selectedNpc = selectedNpcs[0];

    // Trova il player (entità senza SelectedNpc ma con Damage e Health)
    const playerEntities = this.ecs.getEntitiesWithComponents(Transform, Health, Damage);
    const playerEntity = playerEntities.find(entity => {
      return !this.ecs.hasComponent(entity, SelectedNpc);
    });

    if (!playerEntity) return;

    const playerTransform = this.ecs.getComponent(playerEntity, Transform);
    const playerDamage = this.ecs.getComponent(playerEntity, Damage);
    const npcHealth = this.ecs.getComponent(selectedNpc, Health);

    if (!playerTransform || !playerDamage || !npcHealth) return;

    // Controlla se il player è nel range di attacco
    const npcTransform = this.ecs.getComponent(selectedNpc, Transform);
    if (!npcTransform) return;

    if (playerDamage.isInRange(
      playerTransform.x, playerTransform.y,
      npcTransform.x, npcTransform.y
    )) {
      if (playerDamage.canAttack(this.lastUpdateTime)) {
        // Ruota il player verso l'NPC prima di attaccare
        this.faceTarget(playerTransform, npcTransform);

        // Il player spara un proiettile verso l'NPC
        this.performAttack(playerEntity, playerTransform, playerDamage, npcTransform, selectedNpc);
      }
    }
  }

  /**
   * Rimuove tutte le entità morte dal mondo (ora crea esplosione invece di rimuovere immediatamente)
   */
  private removeDeadEntities(): void {
    // Trova tutte le entità con componente Health
    const entitiesWithHealth = this.ecs.getEntitiesWithComponents(Health);

    for (const entity of entitiesWithHealth) {
      const health = this.ecs.getComponent(entity, Health);
      const shield = this.ecs.getComponent(entity, Shield);

      // Un'entità è morta se l'HP è a 0 e non ha più shield attivo
      const isDead = health && health.isDead() && (!shield || !shield.isActive());

      if (isDead && !this.ecs.hasComponent(entity, Explosion)) {
        // Crea l'effetto esplosione invece di rimuovere immediatamente
        this.createExplosion(entity);
      }
    }
  }

  /**
   * Crea un effetto esplosione per un'entità morta
   */
  private async createExplosion(entity: any): Promise<void> {
    try {
      // Carica i frame dell'esplosione se non già caricati
      if (!this.explosionFrames) {
        this.explosionFrames = await this.loadExplosionFrames();
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
      const explosion = new Explosion(this.explosionFrames, 80); // 80ms per frame
      this.ecs.addComponent(entity, Explosion, explosion);

    } catch (error) {
      console.error('Errore nel creare l\'esplosione:', error);
      // Fallback: rimuovi l'entità se fallisce il caricamento
      this.ecs.removeEntity(entity);
    }
  }

  /**
   * Carica tutti i frame dell'animazione dell'esplosione
   */
  private async loadExplosionFrames(): Promise<HTMLImageElement[]> {
    const frames: HTMLImageElement[] = [];
    const basePath = '/assets/explosions/explosions_npc/Explosion_blue_oval/Explosion_blue_oval';

    // Carica i 10 frame dell'esplosione
    for (let i = 1; i <= 10; i++) {
      const framePath = `${basePath}${i}.png`;
      const frame = await this.gameContext.assetManager.loadImage(framePath);
      frames.push(frame);
    }

    return frames;
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
  private startAttackLogging(targetEntity: any): void {
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
}
