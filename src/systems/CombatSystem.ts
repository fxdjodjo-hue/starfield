import { BaseSystem } from '../ecs/System.js';
import { ECS } from '../ecs/ECS.js';
import { Health } from '../components/Health.js';
import { Damage } from '../components/Damage.js';
import { Transform } from '../components/Transform.js';
import { SelectedNpc } from '../components/SelectedNpc.js';
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
   * Elabora il combattimento per un'entità attaccante
   */
  private processCombat(attackerEntity: any): void {
    const attackerTransform = this.ecs.getComponent(attackerEntity, Transform);
    const attackerDamage = this.ecs.getComponent(attackerEntity, Damage);

    if (!attackerTransform || !attackerDamage) return;

    // Trova un target nel range di attacco (per ora il player)
    const playerEntities = this.ecs.getEntitiesWithComponents(Transform, Health);
    // Rimuovi l'entità attaccante dalla lista dei possibili target se presente
    const potentialTargets = playerEntities.filter(entity => entity !== attackerEntity);

    for (const targetEntity of potentialTargets) {
      const targetTransform = this.ecs.getComponent(targetEntity, Transform);
      const targetHealth = this.ecs.getComponent(targetEntity, Health);

      if (!targetTransform || !targetHealth) continue;

      // Verifica se il target è nel range di attacco
      if (attackerDamage.isInRange(
        attackerTransform.x, attackerTransform.y,
        targetTransform.x, targetTransform.y
      )) {
        // Verifica se l'attaccante può attaccare (cooldown)
        if (attackerDamage.canAttack(this.lastUpdateTime)) {
          // Esegui l'attacco
          this.performAttack(attackerDamage, targetHealth);
          console.log(`NPC attacked player for ${attackerDamage.damage} damage!`);
        }
        break; // Attacca solo un target alla volta
      }
    }
  }

  /**
   * Esegue un attacco da attaccante a target
   */
  private performAttack(attackerDamage: Damage, targetHealth: Health): void {
    // Applica il danno al target
    targetHealth.takeDamage(attackerDamage.damage);

    // Registra l'attacco per il cooldown
    attackerDamage.performAttack(this.lastUpdateTime);

    // Controlla se il target è morto
    if (targetHealth.isDead()) {
      console.log('Player is dead!');
      // Qui potremmo emettere un evento di morte o cambiare stato di gioco
    }
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

        // Il player attacca l'NPC
        this.performAttack(playerDamage, npcHealth);
        console.log(`Player auto-attacked NPC for ${playerDamage.damage} damage! Health remaining: ${npcHealth.current}/${npcHealth.max}`);

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

    console.log(`Player at (${playerTransform.x.toFixed(0)}, ${playerTransform.y.toFixed(0)}), NPC at (${npcTransform.x.toFixed(0)}, ${npcTransform.y.toFixed(0)}), distance: ${distance.toFixed(0)}, range: ${playerDamage.attackRange}`);

    if (playerDamage.isInRange(
      playerTransform.x, playerTransform.y,
      npcTransform.x, npcTransform.y
    )) {
      if (playerDamage.canAttack(this.lastUpdateTime)) {
        console.log('Player can attack!');

        // Ruota il player verso l'NPC prima di attaccare
        this.faceTarget(playerTransform, npcTransform);

        // Il player attacca l'NPC
        this.performAttack(playerDamage, npcHealth);
        console.log(`Player attacked NPC for ${playerDamage.damage} damage! Health remaining: ${npcHealth.current}/${npcHealth.max}`);

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
