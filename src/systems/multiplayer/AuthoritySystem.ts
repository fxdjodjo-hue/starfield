import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { Authority, AuthorityLevel } from '../../entities/spatial/Authority';
import { Transform } from '../../entities/spatial/Transform';
import { Health } from '../../entities/combat/Health';
import { Velocity } from '../../entities/spatial/Velocity';
import { GameContext } from '../../infrastructure/engine/GameContext';

/**
 * Authority System - applica enforcement reale delle regole di authority
 * Previene violazioni di sicurezza architetturale nell'ECS
 */
export class AuthoritySystem extends BaseSystem {
  private gameContext: GameContext;
  private localClientId: string;

  // Cache per performance - authority decisions per entity/component
  private authorityCache = new Map<string, boolean>();
  private lastCacheClear = 0;

  constructor(ecs: ECS, gameContext: GameContext) {
    super(ecs);
    this.gameContext = gameContext;
    this.localClientId = gameContext.localClientId || 'unknown';
  }

  update(deltaTime: number): void {
    // Clear cache ogni 5 secondi per evitare memory leaks
    if (Date.now() - this.lastCacheClear > 5000) {
      this.authorityCache.clear();
      this.lastCacheClear = Date.now();
    }

    // Valida authority su tutte le entity critiche
    this.validateCriticalEntities();
  }

  /**
   * Verifica se il client locale ha autorità su una specifica componente di una entity
   * Questa è l'unica funzione che determina l'accesso ai dati ECS
   */
  hasAuthority(entity: Entity, componentType: new (...args: any[]) => any): boolean {
    const cacheKey = `${entity.id}_${componentType.name}`;

    if (this.authorityCache.has(cacheKey)) {
      return this.authorityCache.get(cacheKey)!;
    }

    const authority = this.ecs.getComponent(entity, Authority);
    if (!authority) {
      // Default: se non specificato, assume server authoritative
      this.authorityCache.set(cacheKey, false);
      return false;
    }

    let hasAuthority = false;

    switch (componentType) {
      case Transform:
        // Position è sempre server authoritative tranne per entità locali
        hasAuthority = authority.authorityLevel === AuthorityLevel.CLIENT_LOCAL;
        break;

      case Velocity:
        // Velocity può essere predictive per il proprio player
        hasAuthority = authority.canBeControlledBy(this.localClientId);
        break;

      case Health:
        // Health è sempre server authoritative
        hasAuthority = false;
        break;

      default:
        // Default basato su authority level
        hasAuthority = authority.canBeControlledBy(this.localClientId);
        break;
    }

    this.authorityCache.set(cacheKey, hasAuthority);
    return hasAuthority;
  }

  /**
   * Valida che le entity critiche abbiano authority corretta
   * Logga violazioni per debugging ma non le corregge automaticamente
   */
  private validateCriticalEntities(): void {
    const entitiesWithAuthority = this.ecs.getEntitiesWithComponents(Authority);

    for (const entity of entitiesWithAuthority) {
      const authority = this.ecs.getComponent(entity, Authority)!;

      // Validazione: entity del player locale dovrebbero essere predictive
      if (authority.ownerId === this.localClientId) {
        if (authority.authorityLevel === AuthorityLevel.SERVER_AUTHORITATIVE) {
          console.warn(`[Authority] Player entity ${entity.id} should not be SERVER_AUTHORITATIVE`);
        }
      }

      // Validazione: NPC dovrebbero sempre essere server authoritative
      if (authority.ownerId === 'server' && authority.authorityLevel !== AuthorityLevel.SERVER_AUTHORITATIVE) {
        console.warn(`[Authority] NPC entity ${entity.id} should be SERVER_AUTHORITATIVE`);
      }
    }
  }

  /**
   * Imposta authority per una nuova entity
   * Questa è l'unica funzione autorizzata a modificare authority
   */
  setEntityAuthority(entity: Entity, ownerId: string, level: AuthorityLevel): void {
    const authority = new Authority(ownerId, level);
    this.ecs.addComponent(entity, Authority, authority);

    // Clear cache per questa entity
    this.authorityCache.clear();
  }

  /**
   * Marca una componente come modificata localmente (predetta)
   * Usata dal client prediction system
   */
  markAsPredicted(entity: Entity): void {
    const authority = this.ecs.getComponent(entity, Authority);
    if (authority) {
      authority.markAsPredicted();
    }
  }

  /**
   * Conferma modifica dal server
   * Usata dal server reconciliation system
   */
  confirmFromServer(entity: Entity): void {
    const authority = this.ecs.getComponent(entity, Authority);
    if (authority) {
      authority.confirmFromServer();
    }
  }

  /**
   * Ottiene tutte le entity che richiedono sincronizzazione
   * Usato dal network system per delta updates
   */
  getEntitiesNeedingSync(): Entity[] {
    return this.ecs.getEntitiesWithComponents(Authority)
      .filter(entity => {
        const authority = this.ecs.getComponent(entity, Authority)!;
        return authority.needsSynchronization() && authority.isPredicted;
      });
  }
}