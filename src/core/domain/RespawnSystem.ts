/**
 * RespawnSystem - Sistema centralizzato per gestione respawn
 * Unifica tutta la logica di respawn per player e NPC
 */

import { DamageSystem } from './DamageSystem';
import { LoggerWrapper, LogCategory } from '../data/LoggerWrapper';

export interface RespawnConfig {
  health: number;
  shield: number;
  position: { x: number; y: number };
  isDead?: boolean;
  respawnTime?: number;
}

export interface RespawnContext {
  entityId: string;
  entityType: 'player' | 'npc';
  killerId?: string;
  reason?: string;
}

export class RespawnSystem {
  private static defaultPlayerRespawn: RespawnConfig = {
    health: 10000,
    shield: 10000,
    position: { x: 0, y: 0 },
    isDead: false,
    respawnTime: undefined
  };

  private static defaultNpcRespawn: RespawnConfig = {
    health: 1000, // Sarà sovrascritto dal tipo NPC specifico
    shield: 500,  // Sarà sovrascritto dal tipo NPC specifico
    position: { x: 0, y: 0 }, // Sarà sovrascritto dalla posizione di spawn
    isDead: false,
    respawnTime: undefined
  };

  /**
   * Respawna un player con configurazione standard
   */
  static respawnPlayer(
    playerData: any,
    context?: RespawnContext
  ): RespawnConfig {
    try {
      const respawnConfig = { ...this.defaultPlayerRespawn };

      // Applica configurazione
      this.applyRespawnConfig(playerData, respawnConfig);

      LoggerWrapper.gameplay(`Player ${playerData.playerId || playerData.clientId} respawned`, {
        playerId: playerData.playerId,
        clientId: playerData.clientId,
        position: respawnConfig.position,
        health: respawnConfig.health,
        shield: respawnConfig.shield,
        killerId: context?.killerId,
        reason: context?.reason || 'death'
      });

      return respawnConfig;
    } catch (error) {
      LoggerWrapper.error(LogCategory.GAMEPLAY, 'Failed to respawn player', error as Error, {
        playerData: playerData,
        context: context
      });
      throw error;
    }
  }

  /**
   * Respawna un NPC con configurazione basata sul tipo
   */
  static respawnNpc(
    npcData: any,
    respawnConfig?: Partial<RespawnConfig>,
    context?: RespawnContext
  ): RespawnConfig {
    try {
      // Ottieni configurazione base per il tipo di NPC
      const baseConfig = this.getNpcRespawnConfig(npcData.type);
      const finalConfig = { ...baseConfig, ...respawnConfig };

      // Applica configurazione
      this.applyRespawnConfig(npcData, finalConfig);

      LoggerWrapper.ai(`NPC ${npcData.id} (${npcData.type}) respawned`, {
        npcId: npcData.id,
        npcType: npcData.type,
        position: finalConfig.position,
        health: finalConfig.health,
        shield: finalConfig.shield,
        killerId: context?.killerId,
        reason: context?.reason || 'death'
      });

      return finalConfig;
    } catch (error) {
      LoggerWrapper.error(LogCategory.AI, 'Failed to respawn NPC', error as Error, {
        npcData: npcData,
        respawnConfig: respawnConfig,
        context: context
      });
      throw error;
    }
  }

  /**
   * Respawna un'entità con configurazione personalizzata
   */
  static respawnEntity(
    entityData: any,
    config: RespawnConfig,
    context?: RespawnContext
  ): RespawnConfig {
    try {
      // Applica configurazione
      this.applyRespawnConfig(entityData, config);

      LoggerWrapper.system(`Entity respawned`, {
        entityId: entityData.id || entityData.playerId || entityData.clientId,
        entityType: context?.entityType || 'unknown',
        position: config.position,
        health: config.health,
        shield: config.shield,
        context: context
      });

      return config;
    } catch (error) {
      LoggerWrapper.error(LogCategory.SYSTEM, 'Failed to respawn entity', error as Error, {
        entityData: entityData,
        config: config,
        context: context
      });
      throw error;
    }
  }

  /**
   * Pianifica respawn dopo un delay
   */
  static scheduleRespawn(
    entityData: any,
    delayMs: number,
    config: RespawnConfig,
    onRespawn: (config: RespawnConfig) => void,
    context?: RespawnContext
  ): void {
    try {
      const entityId = entityData.id || entityData.playerId || entityData.clientId;

      LoggerWrapper.system(`Respawn scheduled for entity ${entityId} in ${delayMs}ms`, {
        entityId: entityId,
        delayMs: delayMs,
        context: context
      });

      setTimeout(() => {
        try {
          const finalConfig = this.respawnEntity(entityData, config, context);
          onRespawn(finalConfig);
        } catch (error) {
          LoggerWrapper.error(LogCategory.SYSTEM, 'Respawn callback failed', error as Error, {
            entityId: entityId,
            context: context
          });
        }
      }, delayMs);

    } catch (error) {
      LoggerWrapper.error(LogCategory.SYSTEM, 'Failed to schedule respawn', error as Error, {
        entityData: entityData,
        delayMs: delayMs,
        config: config,
        context: context
      });
    }
  }

  /**
   * Ottiene configurazione respawn per tipo di NPC
   */
  private static getNpcRespawnConfig(npcType: string): RespawnConfig {
    // Configurazioni base per diversi tipi di NPC
    const npcConfigs: Record<string, RespawnConfig> = {
      'Scouter': {
        health: 500,
        shield: 200,
        position: { x: Math.random() * 4000 - 2000, y: Math.random() * 4000 - 2000 },
        isDead: false
      },
      'Kronos': {
        health: 1500,
        shield: 800,
        position: { x: Math.random() * 4000 - 2000, y: Math.random() * 4000 - 2000 },
        isDead: false
      }
    };

    return npcConfigs[npcType] || {
      health: 500,
      shield: 200,
      position: { x: Math.random() * 4000 - 2000, y: Math.random() * 4000 - 2000 },
      isDead: false
    };
  }

  /**
   * Applica configurazione di respawn ai dati dell'entità
   */
  private static applyRespawnConfig(entityData: any, config: RespawnConfig): void {
    // Reset salute e scudo
    entityData.health = config.health;
    entityData.maxHealth = config.health; // Assumi che maxHealth sia uguale a health iniziale
    entityData.shield = config.shield;
    entityData.maxShield = config.shield; // Assumi che maxShield sia uguale a shield iniziale

    // Reset stato morte
    entityData.isDead = config.isDead ?? false;

    // Imposta posizione
    if (entityData.position) {
      entityData.position.x = config.position.x;
      entityData.position.y = config.position.y;
    } else {
      entityData.position = { ...config.position };
    }

    // Reset timestamp respawn
    entityData.respawnTime = config.respawnTime;

    // Reset altri campi specifici per combattimento
    entityData.lastDamage = undefined;
    entityData.lastAttackerId = undefined;
    entityData.lastUpdate = Date.now();
  }

  /**
   * Valida configurazione respawn
   */
  static validateRespawnConfig(config: RespawnConfig): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (isNaN(config.health) || config.health < 0) {
      errors.push('Invalid health value');
    }

    if (isNaN(config.shield) || config.shield < 0) {
      errors.push('Invalid shield value');
    }

    if (!config.position || isNaN(config.position.x) || isNaN(config.position.y)) {
      errors.push('Invalid position');
    }

    if (config.respawnTime !== undefined && (isNaN(config.respawnTime) || config.respawnTime < 0)) {
      errors.push('Invalid respawnTime');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Imposta configurazione predefinita per player
   */
  static setDefaultPlayerRespawn(config: RespawnConfig): void {
    const validation = this.validateRespawnConfig(config);
    if (!validation.isValid) {
      throw new Error(`Invalid player respawn config: ${validation.errors.join(', ')}`);
    }

    this.defaultPlayerRespawn = { ...config };
    LoggerWrapper.system('Default player respawn config updated', {
      config: config
    });
  }

  /**
   * Imposta configurazione predefinita per NPC
   */
  static setDefaultNpcRespawn(config: RespawnConfig): void {
    const validation = this.validateRespawnConfig(config);
    if (!validation.isValid) {
      throw new Error(`Invalid NPC respawn config: ${validation.errors.join(', ')}`);
    }

    this.defaultNpcRespawn = { ...config };
    LoggerWrapper.system('Default NPC respawn config updated', {
      config: config
    });
  }

  /**
   * Ottiene configurazione respawn sicura (con valori di fallback)
   */
  static getSafeRespawnConfig(
    entityType: 'player' | 'npc',
    customConfig?: Partial<RespawnConfig>
  ): RespawnConfig {
    const baseConfig = entityType === 'player' ? this.defaultPlayerRespawn : this.defaultNpcRespawn;
    return { ...baseConfig, ...customConfig };
  }
}