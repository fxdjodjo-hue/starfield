import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { GameContext } from '../../infrastructure/engine/GameContext';
import { AtlasParser } from '../../core/utils/AtlasParser';

/**
 * Remote Explosion System - gestisce creazione esplosioni remote
 * Estratto da ClientNetworkSystem per separare responsabilità
 */
export class RemoteExplosionSystem extends BaseSystem {
  private gameContext: GameContext;
  private explosionFramesCache: Map<string, HTMLImageElement[]> = new Map();
  private audioSystem: any = null;

  constructor(ecs: ECS, gameContext: GameContext) {
    super(ecs);
    this.gameContext = gameContext;

    // Precarica i frame dell'esplosione all'avvio per evitare lag al primo utilizzo
    this.preloadExplosionFrames();
  }

  /**
   * Precarica i frame dell'esplosione in background per evitare lag al primo utilizzo
   */
  private async preloadExplosionFrames(): Promise<void> {
    try {
      // Carica in background senza await per non bloccare l'inizializzazione
      this.loadExplosionFrames('entity_death').catch(error => {
        console.warn('[ExplosionSystem] Failed to preload entity explosion frames:', error);
      });
      this.loadExplosionFrames('projectile_impact').catch(error => {
        console.warn('[ExplosionSystem] Failed to preload missile explosion frames:', error);
      });
    } catch (error) {
      console.warn('[ExplosionSystem] Error starting preload:', error);
    }
  }

  /**
   * Update system loop (required by base class)
   */
  update(deltaTime: number): void {
    // No continuous logic needed for this system
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
    entityType: 'player' | 'npc' | 'missile' | 'projectile';
    position: { x: number; y: number };
    explosionType: 'entity_death' | 'projectile_impact' | 'special';
  }): Promise<void> {
    try {
      // Crea entità temporanea per l'esplosione
      const explosionEntity = this.ecs.createEntity();

      // Usa i frame cachati o caricali
      let explosionFrames = this.explosionFramesCache.get(message.explosionType);
      if (!explosionFrames) {
        explosionFrames = await this.loadExplosionFrames(message.explosionType);
      }

      if (!explosionFrames || explosionFrames.length === 0) {
        console.warn(`[ExplosionSystem] No frames for explosion type: ${message.explosionType}`);
        return;
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
        const soundKey = message.explosionType === 'projectile_impact' ? 'missileHit' : 'explosion';
        const volume = message.explosionType === 'projectile_impact' ? 0.8 : 0.4; // entity_death usa 0.1 originariamente, ma missileHit usa 0.8

        this.audioSystem.playSoundAt(
          soundKey,
          message.position.x,
          message.position.y,
          { volume, allowMultiple: true, category: 'effects' }
        );
      }

    } catch (error) {
      console.error('[ExplosionSystem] Error creating remote explosion:', error);
    }
  }

  /**
   * Imposta frame esplosioni precaricati
   */
  setPreloadedExplosionFrames(frames: HTMLImageElement[]): void {
    this.explosionFramesCache.set('entity_death', frames);
  }

  /**
   * Carica frame esplosione dal filesystem
   */
  private async loadExplosionFrames(explosionType: string = 'entity_death'): Promise<HTMLImageElement[]> {
    const cached = this.explosionFramesCache.get(explosionType);
    if (cached) {
      return cached;
    }

    try {
      let atlasPath = '';
      if (explosionType === 'projectile_impact') {
        atlasPath = `assets/missiles/rocketexplosion/rocketexp.atlas`;
      } else {
        atlasPath = `assets/explosions/explosions_npc/explosion.atlas`;
      }

      const atlasData = await AtlasParser.parseAtlas(atlasPath);
      const frames = await AtlasParser.extractFrames(atlasData);

      this.explosionFramesCache.set(explosionType, frames);
      return frames;
    } catch (error) {
      console.error(`Failed to load explosion frames for ${explosionType}:`, error);
      return [];
    }
  }

  /**
   * Cleanup risorse
   */
  destroy(): void {
    this.explosionFramesCache.clear();
    this.audioSystem = null;
  }
}
