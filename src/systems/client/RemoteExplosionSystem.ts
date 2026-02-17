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
  private pendingMissileSounds: Map<string, any> = new Map(); // Key -> TimeoutID
  private pendingExplosions: Map<string, any> = new Map(); // Key -> TimeoutID (for entity explosions)

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

      // Riproduci suono esplosione sincronizzato con prioritizzazione
      if (this.audioSystem) {
        // Priorità: Entity Death > Projectile Impact
        // Se un missile uccide un alieno, vogliamo sentire l'esplosione dell'alieno, non del missile

        if (message.explosionType === 'entity_death') {
          // Check debouncing per evitare doppi suoni esplosione
          const key = this.getSpatialKey(message.position);

          if (!this.pendingExplosions.has(key)) {
            // 1. Riproduci suono morte (Priorità ALTA)
            this.audioSystem.playSoundAt(
              'explosion',
              message.position.x,
              message.position.y,
              { volume: 0.4, allowMultiple: true, category: 'effects' }
            );

            // Registra per debouncing (ignora altri suoni qui per 100ms)
            const timeoutId = setTimeout(() => {
              this.pendingExplosions.delete(key);
            }, 100);
            this.pendingExplosions.set(key, timeoutId);

            // 2. CANCELLA eventuali suoni di impatto missile pendenti in questa zona
            // (Assumiamo che se muore, è stato colpito un attimo fa)
            this.cancelPendingMissileSound(message.position);
          }
        }
        else if (message.explosionType === 'projectile_impact') {
          // 3. Schedula suono missile con piccolo ritardo (Priorità BASSA)
          // Se arriva una morte entità subito dopo, questo viene cancellato
          this.scheduleMissileSound(message.position);
        }
      }

    } catch (error) {
      console.error('[ExplosionSystem] Error creating remote explosion:', error);
    }
  }

  /**
   * Schedula un suono missile con ritardo per permettere cancellazione se l'entità muore
   */
  private scheduleMissileSound(position: { x: number, y: number }): void {
    const key = this.getSpatialKey(position);

    // Cancella precedente se esiste (debounce spaziale implicito)
    if (this.pendingMissileSounds.has(key)) {
      clearTimeout(this.pendingMissileSounds.get(key));
    }

    const timeoutId = setTimeout(() => {
      if (this.audioSystem) {
        this.audioSystem.playSoundAt(
          'missileHit',
          position.x,
          position.y,
          { volume: 0.1, allowMultiple: true, category: 'effects' }
        );
      }
      this.pendingMissileSounds.delete(key);
    }, 100); // 100ms window to detect kill

    this.pendingMissileSounds.set(key, timeoutId);
  }

  /**
   * Cancella suoni missile pendenti vicino a questa posizione
   */
  private cancelPendingMissileSound(position: { x: number, y: number }): void {
    // Controlla la cella esatta e quelle adiacenti per sicurezza
    const keysToCheck = [
      this.getSpatialKey(position),
      // Potremmo controllare vicini, ma per ora strict check sulla grid 100x100
    ];

    keysToCheck.forEach(key => {
      if (this.pendingMissileSounds.has(key)) {
        clearTimeout(this.pendingMissileSounds.get(key));
        this.pendingMissileSounds.delete(key);
        // console.log("🤫 Suppressed missile sound in favor of explosion!");
      }
    });
  }

  private getSpatialKey(position: { x: number, y: number }): string {
    // Grid 100x100 pixels per raggruppare eventi vicini
    return `${Math.round(position.x / 100)}_${Math.round(position.y / 100)}`;
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
        atlasPath = `assets/explosions/explosion.atlas`;
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
    this.pendingMissileSounds.forEach(timeoutId => clearTimeout(timeoutId));
    this.pendingMissileSounds.clear();
    this.pendingExplosions.forEach(timeoutId => clearTimeout(timeoutId));
    this.pendingExplosions.clear();
    this.explosionFramesCache.clear();
    this.audioSystem = null;
  }
}
