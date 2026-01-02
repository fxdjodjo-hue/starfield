import { System as BaseSystem } from '/src/infrastructure/ecs/System';
import { ECS } from '/src/infrastructure/ecs/ECS';
import { Health } from '/src/entities/combat/Health';
import { Shield } from '/src/entities/combat/Shield';
import { Damage } from '/src/entities/combat/Damage';
import { DamageTaken } from '/src/entities/combat/DamageTaken';
import { DamageText } from '/src/entities/combat/DamageText';
import { Transform } from '/src/entities/spatial/Transform';
import { SelectedNpc } from '/src/entities/combat/SelectedNpc';
import { Npc } from '/src/entities/ai/Npc';
import { Projectile } from '/src/entities/combat/Projectile';
import { MovementSystem } from '../physics/MovementSystem';

/**
 * Sistema di combattimento - gestisce gli scontri tra entità
 * Gestisce attacchi, danni e logica di combattimento
 */
export class CombatSystem extends BaseSystem {
  private lastUpdateTime: number = Date.now();
  private movementSystem: MovementSystem;
  private activeDamageTexts: Map<number, number> = new Map(); // entityId -> count

  constructor(ecs: ECS, movementSystem: MovementSystem) {
    super(ecs);
    this.movementSystem = movementSystem;
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
    const playerEntity = this.ecs.getPlayerEntity();

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

    // Crea il proiettile leggermente avanti all'attaccante per evitare auto-collisione
    const projectileX = attackerTransform.x + directionX * 25; // 25 pixel avanti (dimensione nave)
    const projectileY = attackerTransform.y + directionY * 25;

    // Crea l'entità proiettile
    const projectileEntity = this.ecs.createEntity();

    // Aggiungi componenti al proiettile
    const projectileTransform = new Transform(projectileX, projectileY, 0, 1, 1);
    const projectile = new Projectile(attackerDamage.damage, 400, directionX, directionY, attackerEntity.id, targetEntity.id, 3000);

    this.ecs.addComponent(projectileEntity, Transform, projectileTransform);
    this.ecs.addComponent(projectileEntity, Projectile, projectile);

    // Registra l'attacco per il cooldown
    attackerDamage.performAttack(this.lastUpdateTime);
  }

  /**
   * Crea un testo di danno (chiamato dal ProjectileSystem quando applica danno)
   */
  createDamageText(targetEntity: any, damage: number, isShieldDamage: boolean = false): void {
    if (damage <= 0) return;

    const targetEntityId = targetEntity.id;

    // Controlla quanti testi sono già attivi per questa entità
    const activeCount = this.activeDamageTexts.get(targetEntityId) || 0;
    if (activeCount >= 3) return; // Limite di 3 testi per entità

    // Determina il colore e offset del testo
    const playerEntity = this.ecs.getPlayerEntity();
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
    return shield && shield.isActive() && shield.current < shield.max;
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
    if (selectedNpcs.length === 0) return;

    const selectedNpc = selectedNpcs[0];

    // Trova il player
    const playerEntity = this.ecs.getPlayerEntity();

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
      return; // Esci dalla funzione, non continuare con la logica di combattimento
    }

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
   * Rimuove tutte le entità morte dal mondo
   */
  private removeDeadEntities(): void {
    // Trova tutte le entità con componente Health
    const entitiesWithHealth = this.ecs.getEntitiesWithComponents(Health);

    for (const entity of entitiesWithHealth) {
      const health = this.ecs.getComponent(entity, Health);
      const shield = this.ecs.getComponent(entity, Shield);

      // Un'entità è morta se l'HP è a 0 e non ha più shield attivo
      const isDead = health && health.isDead() && (!shield || !shield.isActive());

      if (isDead) {
        this.ecs.removeEntity(entity);
      }
    }
  }
}
