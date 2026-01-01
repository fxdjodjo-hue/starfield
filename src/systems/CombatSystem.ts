import { BaseSystem } from '../ecs/System.js';
import { ECS } from '../ecs/ECS.js';
import { Health } from '../components/Health.js';
import { Damage } from '../components/Damage.js';
import { Transform } from '../components/Transform.js';
import { SelectedNpc } from '../components/SelectedNpc.js';
import { Projectile } from '../components/Projectile.js';
import { Velocity } from '../components/Velocity.js';

/**
 * Sistema di combattimento - gestisce gli scontri tra entità
 * Gestisce attacchi, danni e logica di combattimento
 */
export class CombatSystem extends BaseSystem {
  private lastUpdateTime: number = 0;

  constructor(ecs: ECS) {
    super(ecs);
  }

  update(deltaTime: number): void {
    this.lastUpdateTime += deltaTime;

    // Combattimento automatico per NPC selezionati
    this.processPlayerCombat();

    // NPC attaccano automaticamente il player quando nel range
    const attackers = this.ecs.getEntitiesWithComponents(Damage, SelectedNpc);

    for (const attackerEntity of attackers) {
      this.processCombat(attackerEntity);
    }
  }

  /**
   * Elabora il combattimento per un'entità attaccante (NPC selezionati che attaccano il player)
   */
  private processCombat(attackerEntity: any): void {
    const attackerTransform = this.ecs.getComponent(attackerEntity, Transform);
    const attackerDamage = this.ecs.getComponent(attackerEntity, Damage);

    if (!attackerTransform || !attackerDamage) return;

    // Trova il player come target
    const playerEntities = this.ecs.getEntitiesWithComponents(Transform, Health, Damage);
    // Il player è l'entità con Damage ma senza SelectedNpc
    const playerEntity = playerEntities.find(entity => {
      return !this.ecs.hasComponent(entity, SelectedNpc);
    });

    if (!playerEntity) return;

    const targetTransform = this.ecs.getComponent(playerEntity, Transform);
    const targetHealth = this.ecs.getComponent(playerEntity, Health);

    if (!targetTransform || !targetHealth) return;

    // Verifica se il player è nel range di attacco dell'NPC
    const distance = Math.sqrt(
      Math.pow(attackerTransform.x - targetTransform.x, 2) +
      Math.pow(attackerTransform.y - targetTransform.y, 2)
    );

    if (attackerDamage.isInRange(
      attackerTransform.x, attackerTransform.y,
      targetTransform.x, targetTransform.y
    )) {
      // Verifica se l'NPC può attaccare (cooldown)
      if (attackerDamage.canAttack(this.lastUpdateTime)) {
        // Esegui l'attacco
        this.performAttack(attackerEntity, attackerTransform, attackerDamage, targetTransform);
        console.log(`NPC fired projectile at player! Distance: ${distance.toFixed(0)}, range: ${attackerDamage.attackRange}`);
      }
    }
  }

  /**
   * Crea un proiettile dall'attaccante verso il target
   */
  private performAttack(attackerEntity: any, attackerTransform: Transform, attackerDamage: Damage, targetTransform: Transform): void {
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
    const projectile = new Projectile(attackerDamage.damage, 600, directionX, directionY, attackerEntity.id);

    this.ecs.addComponent(projectileEntity, projectileTransform);
    this.ecs.addComponent(projectileEntity, projectile);

    // Registra l'attacco per il cooldown
    attackerDamage.performAttack(this.lastUpdateTime);

    console.log(`Projectile fired! From (${attackerTransform.x.toFixed(0)}, ${attackerTransform.y.toFixed(0)}) to (${targetTransform.x.toFixed(0)}, ${targetTransform.y.toFixed(0)})`);
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
        this.performAttack(playerEntity, playerTransform, playerDamage, npcTransform);
        console.log(`Player fired projectile at NPC!`);

        // Controlla se l'NPC è morto
        if (npcHealth.isDead()) {
          console.log('NPC is dead! Removing from world...');
          // Rimuovi l'NPC morto dal mondo
          this.ecs.removeEntity(selectedNpc);
          console.log('NPC removed from world');
        }
      }
    }
  }

  /**
   * Permette al player di attaccare un NPC selezionato (per uso futuro)
   */
  attackSelectedNpc(): void {
    console.log('CombatSystem.attackSelectedNpc() called');

    // Trova l'NPC selezionato
    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
    console.log(`Found ${selectedNpcs.length} selected NPCs`);

    if (selectedNpcs.length === 0) return;

    const selectedNpc = selectedNpcs[0];

    // Trova il player (entità senza SelectedNpc ma con Damage e Health)
    const playerEntities = this.ecs.getEntitiesWithComponents(Transform, Health, Damage);
    const playerEntity = playerEntities.find(entity => {
      return !this.ecs.hasComponent(entity, SelectedNpc);
    });

    console.log(`Found ${playerEntities.length} player entities, selected: ${!!playerEntity}`);

    if (!playerEntity) return;

    const playerTransform = this.ecs.getComponent(playerEntity, Transform);
    const playerDamage = this.ecs.getComponent(playerEntity, Damage);
    const npcHealth = this.ecs.getComponent(selectedNpc, Health);

    if (!playerTransform || !playerDamage || !npcHealth) {
      console.log('Missing components:', {
        playerTransform: !!playerTransform,
        playerDamage: !!playerDamage,
        npcHealth: !!npcHealth
      });
      return;
    }

    // Controlla se il player è nel range di attacco
    const npcTransform = this.ecs.getComponent(selectedNpc, Transform);
    if (!npcTransform) {
      console.log('Missing NPC transform');
      return;
    }

    const distance = Math.sqrt(
      Math.pow(playerTransform.x - npcTransform.x, 2) +
      Math.pow(playerTransform.y - npcTransform.y, 2)
    );

    if (playerDamage.isInRange(
      playerTransform.x, playerTransform.y,
      npcTransform.x, npcTransform.y
    )) {
      console.log(`Player attacking NPC - distance: ${distance.toFixed(0)}, range: ${playerDamage.attackRange}`);
      if (playerDamage.canAttack(this.lastUpdateTime)) {
        console.log('Player can attack!');

        // Ruota il player verso l'NPC prima di attaccare
        this.faceTarget(playerTransform, npcTransform);

        // Il player spara un proiettile verso l'NPC
        this.performAttack(playerEntity, playerTransform, playerDamage, npcTransform);
        console.log(`Player fired projectile at NPC!`);

        // Controlla se l'NPC è morto
        if (npcHealth.isDead()) {
          console.log('NPC is dead! Removing from world...');
          // Rimuovi l'NPC morto dal mondo
          this.ecs.removeEntity(selectedNpc);
          console.log('NPC removed from world');
        } else {
          console.log(`NPC still alive with ${npcHealth.current} HP`);
        }
      } else {
        console.log('Player attack on cooldown');
      }
    } else {
      console.log('NPC is out of attack range');
    }
  }
}
