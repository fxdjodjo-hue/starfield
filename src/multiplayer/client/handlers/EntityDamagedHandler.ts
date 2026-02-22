import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import type { EntityDamagedMessage } from '../../../config/NetworkConfig';
import { Health } from '../../../entities/combat/Health';
import { Shield } from '../../../entities/combat/Shield';
import { Damage } from '../../../entities/combat/Damage';
import { RemotePlayer } from '../../../entities/player/RemotePlayer';
import { Transform } from '../../../entities/spatial/Transform';
import { CombatSystem } from '../../../systems/combat/CombatSystem';
import { Entity } from '../../../infrastructure/ecs/Entity';

/**
 * Gestisce i danni ricevuti dalle entità (NPC o giocatori)
 */
export class EntityDamagedHandler extends BaseMessageHandler {
  private readonly shieldStateByEntity: Map<string, number> = new Map();

  constructor() {
    super(MESSAGE_TYPES.ENTITY_DAMAGED);
  }

  handle(message: EntityDamagedMessage, networkSystem: ClientNetworkSystem): void {
    const ecs = networkSystem.getECS();
    if (!ecs) {
      console.error('[EntityDamagedHandler] ECS not available!');
      return;
    }

    const localAuthId = networkSystem.gameContext.authId;
    const localClientId = networkSystem.getLocalClientId();
    const isLocalPlayerAttacker =
      message.attackerId === String(localAuthId) ||
      message.attackerId === String(localClientId);

    const projectileSource = message.projectileSource === 'pet' || message.projectileSource === 'player' || message.projectileSource === 'npc'
      ? message.projectileSource
      : (String(message.attackerId || '').startsWith('npc_') ? 'npc' : 'player');

    // Sincronizzazione cooldown per il player locale se è l'attaccante
    if (isLocalPlayerAttacker && projectileSource !== 'pet') {
      const playerSystem = networkSystem.getPlayerSystem();
      if (playerSystem) {
        const playerEntity = playerSystem.getPlayerEntity();
        if (playerEntity) {
          const playerDamage = ecs.getComponent(playerEntity, Damage);
          if (playerDamage) {
            const pType = message.projectileType;
            if (pType === 'laser' || pType === 'lb1' || pType === 'lb2' || pType === 'lb3') {
              playerDamage.performAttack(Date.now());
            } else if (pType === 'missile' || pType === 'm1' || pType === 'm2' || pType === 'm3') {
              playerDamage.lastMissileTime = Date.now();
            }
          }
        }
      }
    }

    // Trova l'entità target
    let targetEntity: Entity | null = null;
    if (message.entityType === 'npc') {
      const remoteNpcSystem = networkSystem.getRemoteNpcSystem();
      if (remoteNpcSystem) {
        const entityId = remoteNpcSystem.getRemoteNpcEntity(message.entityId.toString());
        if (entityId !== undefined) targetEntity = ecs.getEntity(entityId) || null;
      }
    } else if (message.entityType === 'player') {
      if (message.entityId === networkSystem.getLocalClientId()) {
        const playerSystem = networkSystem.getPlayerSystem();
        if (playerSystem) {
          targetEntity = playerSystem.getPlayerEntity();
        } else {
          // Fallback search
          const allEntities = ecs.getEntitiesWithComponents(Health, Shield);
          for (const entity of allEntities) {
            if (!ecs.hasComponent(entity, RemotePlayer)) {
              targetEntity = entity;
              break;
            }
          }
        }
      } else {
        const remotePlayerSystem = networkSystem.getRemotePlayerSystem();
        if (remotePlayerSystem) {
          targetEntity = remotePlayerSystem.findRemotePlayerEntity(message.entityId.toString());
        }

        if (!targetEntity) {
          // Fallback search
          const allEntities = ecs.getEntitiesWithComponents(Health);
          for (const entity of allEntities) {
            const remotePlayer = ecs.getComponent(entity, RemotePlayer);
            if (remotePlayer && remotePlayer.clientId.toString() === message.entityId.toString()) {
              targetEntity = entity;
              break;
            }
          }
        }
      }
    }

    const combatSystem = this.findCombatSystem(ecs);
    if (combatSystem && targetEntity) {
      const entityKey = `${message.entityType}:${String(message.entityId)}`;
      const trackedShieldBefore = this.shieldStateByEntity.get(entityKey);
      let previousShield = Number.isFinite(Number(trackedShieldBefore)) ? Number(trackedShieldBefore) : null;

      const targetShield = ecs.getComponent(targetEntity, Shield);
      if (targetShield) {
        previousShield = Number(targetShield.current);
      }

      const nextShield = Number.isFinite(Number(message.newShield)) ? Math.max(0, Number(message.newShield)) : 0;

      // Trigger Shield Hit Effect via CombatSystem centrality
      // ONLY for player entities (as requested: "non dovrebbe esserci su npc")
      if (message.entityType === 'player' && previousShield !== null && previousShield > nextShield) {
        const attackerPosition = this.resolveAttackerWorldPosition(ecs, networkSystem, message.attackerId);
        combatSystem.triggerShieldHitEffect(targetEntity, message.position, attackerPosition || undefined);
      }

      // Damage Text
      if (message.damage > 0) {
        const typeForText = projectileSource === 'pet' ? 'pet_laser' : message.projectileType;
        combatSystem.createDamageText(targetEntity, message.damage, false, false, typeForText as any, message.position.x, message.position.y);
      }
    }

    // Aggiornamento HP/Shield (Prediction Sync)
    if (message.entityType === 'player' && message.entityId === networkSystem.getLocalClientId()) {
      if (targetEntity) {
        const healthComponent = ecs.getComponent(targetEntity, Health);
        const shieldComponent = ecs.getComponent(targetEntity, Shield);
        if (healthComponent && shieldComponent) {
          healthComponent.current = message.newHealth;
          shieldComponent.current = message.newShield;
        }
      }
    } else if (message.entityType === 'player') {
      const remotePlayerSystem = networkSystem.getRemotePlayerSystem();
      if (remotePlayerSystem) {
        remotePlayerSystem.updatePlayerStats(message.entityId.toString(), message.newHealth, (message as any).maxHealth, message.newShield, (message as any).maxShield);
      }
    }

    // State cache
    if (message.entityType === 'player') {
      const entityKey = `${message.entityType}:${String(message.entityId)}`;
      this.shieldStateByEntity.set(entityKey, message.newShield);
    }
  }

  private findCombatSystem(ecs: any): CombatSystem | null {
    const systems = ecs.getSystems ? ecs.getSystems() : [];
    return systems.find((system: any) => typeof (system as any).triggerShieldHitEffect === 'function') as CombatSystem || null;
  }

  private resolveAttackerWorldPosition(ecs: any, networkSystem: ClientNetworkSystem, attackerId: unknown): { x: number; y: number } | null {
    const normalizedId = String(attackerId ?? '').trim();
    if (!normalizedId || ['server', 'radiation', 'environment'].includes(normalizedId)) return null;

    // NPC
    const remoteNpcSystem = networkSystem.getRemoteNpcSystem();
    if (remoteNpcSystem) {
      const npcEntityId = remoteNpcSystem.getRemoteNpcEntity(normalizedId);
      if (npcEntityId !== undefined) {
        const npcEntity = ecs.getEntity(npcEntityId) || null;
        const transform = npcEntity ? ecs.getComponent(npcEntity, Transform) : null;
        if (transform) return { x: transform.x, y: transform.y };
      }
    }

    // Players
    if (typeof (networkSystem as any).findAnyPlayerEntity === 'function') {
      const attackerEntity = (networkSystem as any).findAnyPlayerEntity(normalizedId);
      const transform = attackerEntity ? ecs.getComponent(attackerEntity, Transform) : null;
      if (transform) return { x: transform.x, y: transform.y };
    }

    return null;
  }
}
