import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { GameContext } from '../../infrastructure/engine/GameContext';
import { AtlasParser } from '../../utils/AtlasParser';

/**
 * Explosion System - gestisce creazione esplosioni remote
 * Estratto da ClientNetworkSystem per separare responsabilità
 */
export class ExplosionSystem extends BaseSystem {
  private gameContext: GameContext;
  private ecs: ECS;
  private explosionFramesCache: HTMLImageElement[] | null = null;
  private audioSystem: any = null;

  constructor(ecs: ECS, gameContext: GameContext) {
    super(ecs);
    this.ecs = ecs;
    this.gameContext = gameContext;
  }

  /**
   * Imposta riferimento all'audio system
   */
  setAudioSystem(audioSystem: any): void {
    this.audioSystem = audioSystem;
  }

  /**
   * Crea esplosione remota per effetti visivi sincronizzati
   */
  async createRemoteExplosion(message: {
    explosionId: string;
    entityId: string;
    entityType: 'player' | 'npc';
    position: { x: number; y: number };
    explosionType: 'entity_death' | 'projectile_impact' | 'special';
  }): Promise<void> {
    try {
      // Crea entità temporanea per l'esplosione
      const explosionEntity = this.ecs.createEntity();

      // Usa i frame cachati o caricali
      let explosionFrames = this.explosionFramesCache;
      if (!explosionFrames) {
        explosionFrames = await this.loadExplosionFrames();
        this.explosionFramesCache = explosionFrames;
      }

      // Import componenti (lazy loading per performance)
      const { Explosion } = await import('../../entities/combat/Explosion');
      const { Transform } = await import('../../entities/spatial/Transform');

      // Crea componenti
      const transform = new Transform(message.position.x, message.position.y, 0);
      const explosion = new Explosion(explosionFrames, 20, 1); // 20ms per frame

      // Aggiungi componenti all'entità
      this.ecs.addComponent(explosionEntity, Transform, transform);
      this.ecs.addComponent(explosionEntity, Explosion, explosion);

      // Riproduci suono esplosione sincronizzato
      if (this.audioSystem) {
        this.audioSystem.playSound('explosion', 0.1, false, true); // Volume ridotto
      }

    } catch (error) {
      console.error('[ExplosionSystem] Error creating remote explosion:', error);
    }
  }

  /**
   * Imposta frame esplosioni precaricati
   */
  setPreloadedExplosionFrames(frames: HTMLImageElement[]): void {
    this.explosionFramesCache = frames;
  }

  /**
   * Carica frame esplosione dal filesystem
   */
  private async loadExplosionFrames(explosionType: string = 'explosion'): Promise<HTMLImageElement[]> {
    if (this.explosionFramesCache) {
      return this.explosionFramesCache;
    }

    try {
      const atlasPath = `/assets/explosions/explosions_npc/explosion.atlas`;
      const atlasData = await AtlasParser.parseAtlas(atlasPath);
      const frames = await AtlasParser.extractFrames(atlasData);

      this.explosionFramesCache = frames;
      return frames;
    } catch (error) {
      console.error('Failed to load explosion frames from atlas:', error);
      return [];
    }
  }

  /**
   * Cleanup risorse
   */
  destroy(): void {
    this.explosionFramesCache = null;
    this.audioSystem = null;
  }
}