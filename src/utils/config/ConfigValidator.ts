import { z } from 'zod';

// Import configurations
import playerConfigData from '../../../shared/player-config.json';
import npcConfigData from '../../../shared/npc-config.json';

// Schema validazione Player
const PlayerStatsSchema = z.object({
  health: z.number().positive('Health must be positive'),
  shield: z.number().min(0, 'Shield cannot be negative'),
  damage: z.number().positive('Damage must be positive'),
  range: z.number().positive('Range must be positive'),
  rangeWidth: z.number().positive('Range width must be positive'),
  rangeHeight: z.number().positive('Range height must be positive'),
  cooldown: z.number().positive('Cooldown must be positive'),
  speed: z.number().positive('Speed must be positive')
});

const PlayerStartingResourcesSchema = z.object({
  credits: z.number().min(0, 'Credits cannot be negative'),
  cosmos: z.number().min(0, 'Cosmos cannot be negative'),
  level: z.number().min(1, 'Level must be at least 1'),
  experience: z.number().min(0, 'Experience cannot be negative'),
  honor: z.number().min(0, 'Honor cannot be negative'),
  skillPoints: z.number().min(0, 'Skill points cannot be negative')
});

const PlayerSpriteSizeSchema = z.object({
  width: z.number().positive('Width must be positive'),
  height: z.number().positive('Height must be positive')
});

const PlayerUpgradesSchema = z.object({
  maxHpUpgrades: z.number().min(0, 'Max HP upgrades cannot be negative'),
  maxShieldUpgrades: z.number().min(0, 'Max shield upgrades cannot be negative'),
  maxSpeedUpgrades: z.number().min(0, 'Max speed upgrades cannot be negative'),
  maxDamageUpgrades: z.number().min(0, 'Max damage upgrades cannot be negative')
});

const PlayerConfigSchema = z.object({
  stats: PlayerStatsSchema,
  startingResources: PlayerStartingResourcesSchema,
  spriteSize: PlayerSpriteSizeSchema,
  upgrades: PlayerUpgradesSchema,
  description: z.string().optional()
});

// Schema validazione NPC
const NpcStatsSchema = z.object({
  health: z.number().positive('NPC health must be positive'),
  shield: z.number().min(0, 'NPC shield cannot be negative'),
  damage: z.number().positive('NPC damage must be positive'),
  range: z.number().positive('NPC range must be positive'),
  cooldown: z.number().positive('NPC cooldown must be positive'),
  speed: z.number().positive('NPC speed must be positive').optional()
});

const NpcRewardsSchema = z.object({
  credits: z.number().min(0, 'NPC credits reward cannot be negative'),
  cosmos: z.number().min(0, 'NPC cosmos reward cannot be negative'),
  experience: z.number().min(0, 'NPC experience reward cannot be negative'),
  honor: z.number().min(0, 'NPC honor reward cannot be negative')
});

const NpcAISchema = z.object({
  aggressionLevel: z.enum(['low', 'medium', 'high'], {
    errorMap: () => ({ message: 'Aggression level must be low, medium, or high' })
  }),
  targetPriority: z.enum(['nearest', 'weakest', 'players', 'defense'], {
    errorMap: () => ({ message: 'Target priority must be nearest, weakest, players, or defense' })
  }),
  formation: z.enum(['scattered', 'patrol', 'pack', 'solo', 'swarm'], {
    errorMap: () => ({ message: 'Formation must be scattered, patrol, pack, solo, or swarm' })
  })
});

const NpcDefinitionSchema = z.object({
  type: z.string().min(1, 'NPC type cannot be empty'),
  defaultBehavior: z.string().min(1, 'NPC default behavior cannot be empty'),
  stats: NpcStatsSchema,
  rewards: NpcRewardsSchema,
  spawns: z.array(z.string()).optional(),
  ai: NpcAISchema.optional(),
  description: z.string().optional()
});

const NpcConfigSchema = z.record(z.string(), NpcDefinitionSchema);

/**
 * Sistema di validazione configurazione basato su schema
 * Utilizza Zod per validare le configurazioni JSON e fornire errori dettagliati
 */
export class ConfigValidator {
  /**
   * Valida la configurazione del Player
   */
  static validatePlayerConfig(config: any): { success: boolean; errors?: string[] } {
    try {
      PlayerConfigSchema.parse(config);
      return { success: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        try {
          const errors = error.errors?.map(err => `${err.path.join('.')}: ${err.message}`) || [`ZodError: ${error.message}`];
          console.error('❌ [ConfigValidator] Player config validation failed:', errors);
          return { success: false, errors };
        } catch (mapError) {
          console.error('❌ [ConfigValidator] Player config validation failed with ZodError:', error.message);
          return { success: false, errors: [`ZodError: ${error.message}`] };
        }
      }
      console.error('❌ [ConfigValidator] Player config validation failed with unknown error:', error);
      return { success: false, errors: ['Unknown validation error'] };
    }
  }

  /**
   * Valida la configurazione degli NPC
   */
  static validateNpcConfig(config: any): { success: boolean; errors?: string[] } {
    try {
      NpcConfigSchema.parse(config);
      return { success: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        try {
          const errors = error.errors?.map(err => `${err.path.join('.')}: ${err.message}`) || [`ZodError: ${error.message}`];
          console.error('❌ [ConfigValidator] NPC config validation failed:', errors);
          return { success: false, errors };
        } catch (mapError) {
          console.error('❌ [ConfigValidator] NPC config validation failed with ZodError:', error.message);
          return { success: false, errors: [`ZodError: ${error.message}`] };
        }
      }
      console.error('❌ [ConfigValidator] NPC config validation failed with unknown error:', error);
      return { success: false, errors: ['Unknown validation error'] };
    }
  }

  /**
   * Valida tutte le configurazioni
   */
  static validateAllConfigs(): { success: boolean; errors?: { player?: string[]; npc?: string[] } } {
    // Import dinamici per evitare dipendenze cicliche
    const playerConfig = this.loadPlayerConfig();
    const npcConfig = this.loadNpcConfig();

    const playerResult = this.validatePlayerConfig(playerConfig);
    const npcResult = this.validateNpcConfig(npcConfig);

    const allSuccess = playerResult.success && npcResult.success;

    if (allSuccess) {
      return { success: true };
    } else {
      const errors: { player?: string[]; npc?: string[] } = {};
      if (!playerResult.success) errors.player = playerResult.errors;
      if (!npcResult.success) errors.npc = npcResult.errors;

      console.error('❌ [ConfigValidator] Configuration validation failed:', errors);
      return { success: false, errors };
    }
  }

  /**
   * Carica la configurazione del player (metodo helper)
   */
  private static loadPlayerConfig(): any {
    try {
      return playerConfigData;
    } catch (error) {
      console.error('❌ [ConfigValidator] Failed to load player config:', error);
      return null;
    }
  }

  /**
   * Carica la configurazione degli NPC (metodo helper)
   */
  private static loadNpcConfig(): any {
    try {
      return npcConfigData;
    } catch (error) {
      console.error('❌ [ConfigValidator] Failed to load NPC config:', error);
      return null;
    }
  }

  /**
   * Valida una configurazione e lancia un errore se fallisce
   * Utile per l'inizializzazione dell'applicazione
   */
  static validateOrThrow(): void {
    const result = this.validateAllConfigs();
    if (!result.success) {
      const errorMessage = [
        'Configuration validation failed:',
        result.errors?.player && `Player config errors: ${result.errors.player.join(', ')}`,
        result.errors?.npc && `NPC config errors: ${result.errors.npc.join(', ')}`
      ].filter(Boolean).join('\n');

      throw new Error(errorMessage);
    }
  }
}
