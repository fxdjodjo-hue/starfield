/**
 * BroadcastManager - Sistema centralizzato per broadcasting messaggi
 * Unifica tutti i sistemi di broadcasting (ProjectileBroadcaster, NpcBroadcaster, MessageRouter)
 */

import { LoggerWrapper, LogCategory } from '../data/LoggerWrapper';
import { MessageSerializer, SerializationResult } from '../utils/MessageSerializer';

export interface BroadcastOptions {
  excludeClientId?: string;
  interestRadius?: number;
  global?: boolean; // Broadcast a tutti i client
  reliable?: boolean; // Garantisce consegna
}

export interface BroadcastContext {
  source?: string;
  entityId?: string;
  clientId?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
}

export class BroadcastManager {
  private static mapServer: any = null;

  /**
   * Inizializza il BroadcastManager con il mapServer
   */
  static initialize(mapServer: any): void {
    this.mapServer = mapServer;
    LoggerWrapper.system('BroadcastManager initialized', {
      hasMapServer: !!mapServer,
      hasBroadcastNear: typeof mapServer?.broadcastNear === 'function',
      hasBroadcastToMap: typeof mapServer?.broadcastToMap === 'function'
    });
  }

  /**
   * Broadcast messaggio con opzioni avanzate
   */
  static broadcast(
    message: any,
    options: BroadcastOptions = {},
    context?: BroadcastContext
  ): boolean {
    try {
      if (!this.mapServer) {
        LoggerWrapper.error(LogCategory.NETWORK, 'BroadcastManager not initialized - no mapServer', undefined, {
          message: message,
          options: options,
          context: context
        });
        return false;
      }

      // Serializza messaggio
      const serialized = MessageSerializer.safeStringify(message);
      if (!serialized.success) {
        LoggerWrapper.error(LogCategory.NETWORK, 'Failed to serialize broadcast message', new Error(serialized.error), {
          message: message,
          options: options,
          context: context
        });
        return false;
      }

      const finalMessage = JSON.parse(serialized.data!);
      let broadcastResult: any = null;

      if (options.global) {
        // Broadcast globale
        broadcastResult = this.mapServer.broadcastToMap(finalMessage, options.excludeClientId);
        LoggerWrapper.network(`Global broadcast: ${message.type}`, {
          messageType: message.type,
          recipients: 'all',
          excludeClientId: options.excludeClientId,
          context: context
        });
      } else {
        // Broadcast con interest radius
        const position = this.extractPosition(message);
        const radius = options.interestRadius || 2000; // Default 2000

        if (position) {
          broadcastResult = this.mapServer.broadcastNear(position, radius, finalMessage, options.excludeClientId);
          LoggerWrapper.network(`Area broadcast: ${message.type}`, {
            messageType: message.type,
            position: position,
            radius: radius,
            excludeClientId: options.excludeClientId,
            context: context
          });
        } else {
          // Fallback a broadcast globale se non c'è posizione
          broadcastResult = this.mapServer.broadcastToMap(finalMessage, options.excludeClientId);
          LoggerWrapper.network(`Positionless broadcast: ${message.type}`, {
            messageType: message.type,
            recipients: 'all',
            excludeClientId: options.excludeClientId,
            context: context
          });
        }
      }

      return true;
    } catch (error) {
      LoggerWrapper.error(LogCategory.NETWORK, 'Broadcast failed', error as Error, {
        message: message,
        options: options,
        context: context
      });
      return false;
    }
  }

  /**
   * Broadcast evento entità danneggiata
   */
  static broadcastEntityDamaged(
    entity: any,
    damage: number,
    newHealth: number,
    newShield: number,
    attackerId?: string,
    entityType: 'npc' | 'player' = 'npc',
    options?: BroadcastOptions
  ): boolean {
    const message = {
      type: 'entity_damaged',
      entityId: entityType === 'npc' ? entity.id : entity.clientId,
      entityType: entityType,
      damage: damage,
      newHealth: newHealth,
      newShield: newShield,
      attackerId: attackerId,
      position: entity.position,
      timestamp: Date.now()
    };

    return this.broadcast(message, {
      interestRadius: 2000, // Entità danneggiate sono interessanti per giocatori vicini
      ...options
    }, {
      source: 'damage_system',
      entityId: entity.id || entity.clientId,
      priority: damage > 100 ? 'high' : 'normal'
    });
  }

  /**
   * Broadcast evento entità distrutta
   */
  static broadcastEntityDestroyed(
    entity: any,
    destroyerId: string,
    entityType: 'npc' | 'player' = 'npc',
    rewards?: any,
    options?: BroadcastOptions
  ): boolean {
    // Prima broadcast esplosione per effetti visivi
    const explosionId = `expl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const explosionMessage = {
      type: 'explosion_created',
      explosionId: explosionId,
      entityId: entityType === 'npc' ? entity.id : entity.clientId,
      entityType: entityType,
      position: entity.position,
      explosionType: 'entity_death'
    };

    this.broadcast(explosionMessage, {
      interestRadius: 2000, // Esplosioni sono interessanti per giocatori vicini
      ...options
    }, {
      source: 'entity_destruction',
      entityId: entity.id || entity.clientId,
      priority: 'high'
    });

    // Poi broadcast distruzione entità
    const destroyMessage = {
      type: 'entity_destroyed',
      entityId: entityType === 'npc' ? entity.id : entity.clientId,
      entityType: entityType,
      destroyerId: destroyerId,
      position: entity.position,
      rewards: entityType === 'npc' ? rewards : undefined,
      timestamp: Date.now()
    };

    return this.broadcast(destroyMessage, {
      global: entityType === 'npc', // Distruzioni NPC sono sempre globali (minimap)
      interestRadius: 50000, // Tutto il mondo per minimap
      ...options
    }, {
      source: 'entity_destruction',
      entityId: entity.id || entity.clientId,
      priority: 'high'
    });
  }

  /**
   * Broadcast creazione NPC
   */
  static broadcastNpcSpawn(
    npc: any,
    options?: BroadcastOptions
  ): boolean {
    const message = {
      type: 'npc_spawn',
      npc: {
        id: npc.id,
        type: npc.type,
        position: npc.position,
        health: { current: npc.health, max: npc.maxHealth },
        shield: { current: npc.shield, max: npc.maxShield },
        behavior: npc.behavior
      },
      timestamp: Date.now()
    };

    return this.broadcast(message, {
      global: true, // Spawn NPC sempre globali per minimap
      ...options
    }, {
      source: 'npc_spawn',
      entityId: npc.id,
      priority: 'normal'
    });
  }

  /**
   * Broadcast aggiornamento stato giocatore remoto
   */
  static broadcastRemotePlayerUpdate(
    clientId: string,
    position: any,
    nickname?: string,
    playerId?: string,
    options?: BroadcastOptions
  ): boolean {
    const message = {
      type: 'remote_player_update',
      clientId: clientId,
      position: position,
      rotation: position.rotation || 0,
      tick: 0,
      nickname: nickname,
      playerId: playerId,
      timestamp: Date.now()
    };

    return this.broadcast(message, {
      excludeClientId: clientId, // Non broadcast al giocatore stesso
      interestRadius: 3000, // Giocatori remoti interessanti per chi è vicino
      ...options
    }, {
      source: 'player_update',
      clientId: clientId,
      priority: 'low'
    });
  }

  /**
   * Broadcast creazione proiettile
   */
  static broadcastProjectileFired(
    projectile: any,
    excludeClientId?: string,
    actualDamage?: number,
    options?: BroadcastOptions
  ): boolean {
    const message = {
      type: 'projectile_fired',
      projectileId: projectile.id,
      playerId: projectile.playerId,
      position: projectile.position,
      velocity: projectile.velocity,
      damage: actualDamage !== null && actualDamage !== undefined ? actualDamage : projectile.damage,
      projectileType: projectile.projectileType,
      targetId: projectile.targetId,
      timestamp: Date.now()
    };

    return this.broadcast(message, {
      excludeClientId: excludeClientId,
      interestRadius: 2000, // Proiettili interessanti per giocatori vicini
      ...options
    }, {
      source: 'projectile_fire',
      entityId: projectile.id,
      priority: 'normal'
    });
  }

  /**
   * Broadcast distruzione proiettile
   */
  static broadcastProjectileDestroyed(
    projectileId: string,
    reason: string,
    position?: any,
    projectile?: any,
    options?: BroadcastOptions
  ): boolean {
    const message = {
      type: 'projectile_destroyed',
      projectileId: projectileId,
      reason: reason,
      position: position || projectile?.position,
      timestamp: Date.now()
    };

    return this.broadcast(message, {
      interestRadius: 1500, // Distruzione proiettili meno interessante
      ...options
    }, {
      source: 'projectile_destruction',
      entityId: projectileId,
      priority: 'low'
    });
  }

  /**
   * Broadcast inizio combattimento
   */
  static broadcastCombatStart(
    playerId: string,
    npcId: string,
    options?: BroadcastOptions
  ): boolean {
    const message = {
      type: 'combat_update',
      action: 'start',
      playerId: playerId,
      npcId: npcId,
      timestamp: Date.now()
    };

    return this.broadcast(message, {
      interestRadius: 2000, // Combattimenti interessanti per giocatori vicini
      ...options
    }, {
      source: 'combat_system',
      entityId: playerId,
      priority: 'normal'
    });
  }

  /**
   * Broadcast fine combattimento
   */
  static broadcastCombatEnd(
    playerId: string,
    npcId?: string,
    options?: BroadcastOptions
  ): boolean {
    const message = {
      type: 'combat_update',
      action: 'stop',
      playerId: playerId,
      npcId: npcId || 'unknown',
      timestamp: Date.now()
    };

    return this.broadcast(message, {
      interestRadius: 2000, // Fine combattimenti interessanti per giocatori vicini
      ...options
    }, {
      source: 'combat_system',
      entityId: playerId,
      priority: 'normal'
    });
  }

  /**
   * Broadcast evento riparazione
   */
  static broadcastRepairEvent(
    playerId: string,
    action: 'start' | 'stop' | 'complete',
    healthRepaired?: number,
    shieldRepaired?: number,
    options?: BroadcastOptions
  ): boolean {
    const message = {
      type: 'repair_' + action,
      playerId: playerId,
      healthRepaired: healthRepaired,
      shieldRepaired: shieldRepaired,
      timestamp: Date.now()
    };

    return this.broadcast(message, {
      interestRadius: 1000, // Riparazioni poco interessanti per altri giocatori
      ...options
    }, {
      source: 'repair_system',
      entityId: playerId,
      priority: 'low'
    });
  }

  /**
   * Estrae posizione da un messaggio (se presente)
   */
  private static extractPosition(message: any): { x: number; y: number } | null {
    // Diverse possibili strutture di messaggio
    if (message.position) {
      return message.position;
    }

    if (message.npc && message.npc.position) {
      return message.npc.position;
    }

    if (message.entity && message.entity.position) {
      return message.entity.position;
    }

    // Per messaggi di combattimento, usa posizione dell'NPC
    if (message.npcId && this.mapServer) {
      const npc = this.mapServer.npcManager?.getNpc(message.npcId);
      if (npc && npc.position) {
        return npc.position;
      }
    }

    return null;
  }

  /**
   * Ottiene statistiche di broadcasting
   */
  static getStats(): {
    initialized: boolean;
    hasBroadcastNear: boolean;
    hasBroadcastToMap: boolean;
  } {
    return {
      initialized: !!this.mapServer,
      hasBroadcastNear: typeof this.mapServer?.broadcastNear === 'function',
      hasBroadcastToMap: typeof this.mapServer?.broadcastToMap === 'function'
    };
  }
}