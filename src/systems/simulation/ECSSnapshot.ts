import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { Transform } from '../../entities/spatial/Transform';
import { Velocity } from '../../entities/spatial/Velocity';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { Damage } from '../../entities/combat/Damage';
import { Npc } from '../../entities/ai/Npc';

/**
 * Snapshot dello stato ECS per multiplayer
 * Permette di salvare e ripristinare lo stato completo del mondo
 */
export class ECSSnapshot {
  public readonly timestamp: number;
  public readonly tick: number;
  private entityStates: Map<number, EntitySnapshot> = new Map();

  constructor(tick: number, timestamp: number = Date.now()) {
    this.tick = tick;
    this.timestamp = timestamp;
  }

  /**
   * Aggiunge lo stato di un'entità allo snapshot
   */
  addEntityState(entityId: number, components: ComponentSnapshot[]): void {
    // Validazione dell'entityId
    if (typeof entityId !== 'number' || isNaN(entityId) || entityId < 0) {
      console.error(`❌ Invalid entityId: ${entityId}, skipping addEntityState`);
      return;
    }

    this.entityStates.set(entityId, {
      entityId,
      components
    });
  }

  /**
   * Ottiene lo stato di un'entità
   */
  getEntityState(entityId: number): EntitySnapshot | undefined {
    return this.entityStates.get(entityId);
  }

  /**
   * Ottiene tutte le entità nello snapshot
   */
  getAllEntityStates(): EntitySnapshot[] {
    return Array.from(this.entityStates.values());
  }

  /**
   * Ottiene gli ID di tutte le entità
   */
  getEntityIds(): number[] {
    return Array.from(this.entityStates.keys());
  }

  /**
   * Verifica se lo snapshot contiene un'entità
   */
  hasEntity(entityId: number): boolean {
    return this.entityStates.has(entityId);
  }

  /**
   * Numero di entità nello snapshot
   */
  getEntityCount(): number {
    return this.entityStates.size;
  }

  /**
   * Calcola un hash semplice dello snapshot per confronto rapido
   */
  getHash(): string {
    let hash = `${this.tick}`;
    for (const [entityId, state] of this.entityStates) {
      hash += `|${entityId}:${state.components.length}`;
    }
    return hash;
  }
}

/**
 * Stato di un'entità nello snapshot
 */
export interface EntitySnapshot {
  entityId: number;
  components: ComponentSnapshot[];
}

/**
 * Stato serializzato di un componente
 */
export interface ComponentSnapshot {
  componentType: string;
  data: any;
}

/**
 * Manager per creare e applicare snapshot ECS
 */
export class ECSSnapshotManager {
  private ecs: ECS;

  constructor(ecs: ECS) {
    this.ecs = ecs;
  }

  /**
   * Crea uno snapshot completo dello stato ECS corrente
   */
  createSnapshot(tick: number): ECSSnapshot {
    const snapshot = new ECSSnapshot(tick);

    // Salva tutti i dati critici delle entità per multiplayer
    for (const entity of this.ecs.getEntitiesWithComponents()) {
      const components: ComponentSnapshot[] = [];

      // Serializza componenti essenziali per sincronizzazione
      const transform = this.ecs.getComponent(entity, Transform);
      const velocity = this.ecs.getComponent(entity, Velocity);
      const health = this.ecs.getComponent(entity, Health);
      const shield = this.ecs.getComponent(entity, Shield);
      const damage = this.ecs.getComponent(entity, Damage);
      const npc = this.ecs.getComponent(entity, Npc);

      if (transform) {
        components.push({
          componentType: 'Transform',
          data: {
            x: transform.x,
            y: transform.y,
            rotation: transform.rotation
          }
        });
      }

      if (velocity) {
        components.push({
          componentType: 'Velocity',
          data: {
            vx: velocity.vx,
            vy: velocity.vy,
            angularVelocity: velocity.angularVelocity
          }
        });
      }

      if (health) {
        components.push({
          componentType: 'Health',
          data: {
            current: health.current,
            max: health.max
          }
        });
      }

      if (shield) {
        components.push({
          componentType: 'Shield',
          data: {
            current: shield.current,
            max: shield.max
          }
        });
      }

      if (damage) {
        components.push({
          componentType: 'Damage',
          data: {
            damage: damage.damage,
            range: damage.range,
            cooldown: damage.cooldown
          }
        });
      }

      if (npc) {
        components.push({
          componentType: 'Npc',
          data: {
            npcType: npc.npcType,
            defaultBehavior: npc.defaultBehavior
          }
        });
      }

      snapshot.addEntityState(entity.id, components);
    }

    return snapshot;
  }

  /**
   * Applica uno snapshot allo stato ECS (aggiorna le entità esistenti)
   */
  applySnapshot(snapshot: ECSSnapshot): void {
    // Applica i dati dello snapshot alle entità esistenti
    for (const entitySnapshot of snapshot.getAllEntityStates()) {
      const entityId = entitySnapshot.entityId;

      // Validazione: salta entità con ID non valido
      if (entityId === undefined || entityId === null) {
        console.warn(`⚠️ Invalid entityId in snapshot: ${entityId}, skipping`);
        continue;
      }

      let entity = null;

      // Gestisci il caso normale: entityId numerico
      if (typeof entityId === 'number') {
        if (!this.ecs.entities.has(entityId)) {
          console.warn(`Entity ${entityId} not found locally, skipping snapshot update`);
          continue;
        }
        entity = this.ecs.getEntity(entityId);
      }
      // Gestisci il caso speciale del player: entityId stringa che rappresenta playerId
      else if (typeof entityId === 'string' && (entityId.startsWith('player_') || entityId.includes('player'))) {
        // Cerca l'entità del player locale (entità senza componente NPC)
        const playerEntities = this.ecs.getEntitiesWithComponents(Transform)
          .filter(e => !this.ecs.hasComponent(e, Npc));

        if (playerEntities.length > 0) {
          entity = this.ecs.getEntity(playerEntities[0]);
          console.log(`🔍 Mapped remote player ID ${entityId} to local entity ${playerEntities[0]}`);
        } else {
          console.warn(`⚠️ No local player entity found for remote ID ${entityId}, skipping`);
          continue;
        }
      }
      else {
        console.warn(`⚠️ Unsupported entityId type: ${typeof entityId} (${entityId}), skipping`);
        continue;
      }

      // Applica i componenti dello snapshot
      for (const componentSnapshot of entitySnapshot.components) {
        this.applyComponentSnapshot(entity, componentSnapshot);
      }
    }
  }

  /**
   * Applica un singolo componente snapshot a un'entità
   */
  private applyComponentSnapshot(entity: any, componentSnapshot: ComponentSnapshot): void {
    switch (componentSnapshot.componentType) {
      case 'Transform':
        const transform = this.ecs.getComponent(entity, Transform);
        if (transform) {
          transform.x = componentSnapshot.data.x;
          transform.y = componentSnapshot.data.y;
          transform.rotation = componentSnapshot.data.rotation;
        }
        break;

      case 'Velocity':
        const velocity = this.ecs.getComponent(entity, Velocity);
        if (velocity) {
          velocity.setVelocity(componentSnapshot.data.vx, componentSnapshot.data.vy);
          velocity.angularVelocity = componentSnapshot.data.angularVelocity;
        }
        break;

      case 'Health':
        const health = this.ecs.getComponent(entity, Health);
        if (health) {
          health.current = componentSnapshot.data.current;
          health.max = componentSnapshot.data.max;
        }
        break;

      case 'Shield':
        const shield = this.ecs.getComponent(entity, Shield);
        if (shield) {
          shield.current = componentSnapshot.data.current;
          shield.max = componentSnapshot.data.max;
        }
        break;

      case 'Damage':
        const damage = this.ecs.getComponent(entity, Damage);
        if (damage) {
          damage.damage = componentSnapshot.data.damage;
          damage.range = componentSnapshot.data.range;
          damage.cooldown = componentSnapshot.data.cooldown;
        }
        break;

      case 'Npc':
        const npc = this.ecs.getComponent(entity, Npc);
        if (npc) {
          npc.npcType = componentSnapshot.data.npcType;
          npc.defaultBehavior = componentSnapshot.data.defaultBehavior;
        }
        break;
    }
  }

  /**
   * Confronta due snapshot e restituisce le differenze
   */
  compareSnapshots(snapshot1: ECSSnapshot, snapshot2: ECSSnapshot): SnapshotDiff {
    const added: number[] = [];
    const removed: number[] = [];
    const changed: number[] = [];

    const entities1 = new Set(snapshot1.getEntityIds());
    const entities2 = new Set(snapshot2.getEntityIds());

    // Trova entità aggiunte in snapshot2
    for (const entityId of entities2) {
      if (!entities1.has(entityId)) {
        added.push(entityId);
      }
    }

    // Trova entità rimosse da snapshot1
    for (const entityId of entities1) {
      if (!entities2.has(entityId)) {
        removed.push(entityId);
      }
    }

    // Per ora non implementiamo il confronto dei cambiamenti
    // In futuro confronteremo i dati dei componenti

    return { added, removed, changed };
  }

  /**
   * Valida l'integrità di uno snapshot
   */
  validateSnapshot(snapshot: ECSSnapshot): boolean {
    try {
      // Verifiche basic
      if (snapshot.tick < 0) return false;
      if (snapshot.getEntityCount() < 0) return false;

      // Verifica che tutti gli entityId siano validi
      for (const entityId of snapshot.getEntityIds()) {
        if (!Number.isInteger(entityId) || entityId < 0) {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }
}

/**
 * Differenze tra due snapshot
 */
export interface SnapshotDiff {
  added: number[];    // Entità aggiunte
  removed: number[];  // Entità rimosse
  changed: number[];  // Entità modificate
}
