import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { Health } from '../../entities/combat/Health';
import { CONFIG } from '../../core/utils/config/GameConfig';
import { CameraSystem } from '../rendering/CameraSystem';
import { DisplayManager } from '../../infrastructure/display';

/**
 * Sistema Bounds - Gestisce i limiti della mappa
 * Renderizza linee di confine rosse e applica danno ai giocatori fuori bounds
 */
export class BoundsSystem extends BaseSystem {
  // Bounds esattamente delle dimensioni della mappa
  private readonly BOUNDS_LEFT = -CONFIG.WORLD_WIDTH / 2;
  private readonly BOUNDS_RIGHT = CONFIG.WORLD_WIDTH / 2;
  private readonly BOUNDS_TOP = -CONFIG.WORLD_HEIGHT / 2;
  private readonly BOUNDS_BOTTOM = CONFIG.WORLD_HEIGHT / 2;

  // Timer accumulatore per il danno periodico
  private damageTimer = 0;
  private readonly DAMAGE_INTERVAL = 1000; // 1 secondo
  private readonly DAMAGE_AMOUNT = 1000;

  // Timer atomico per warning vocale periodico (basato su timestamp assoluti)
  private lastWarningTime = 0;
  private readonly WARNING_INTERVAL = 3000; // 3 secondi

  // Asset animazione radiazione
  private radiationAtlas: any = null;
  private radiationFrames: HTMLImageElement[] = [];
  private radiationAnimationFrame = 0;
  private animationTimer = 0;
  private readonly FRAME_DURATION = 1000 / 15; // 15 FPS per l'animazione
  private isLoadingRadiation = false;

  // Sistema audio
  private audioSystem: any = null;

  // Riferimenti ai sistemi
  private playerEntity: any = null;
  private cameraSystem: CameraSystem;

  constructor(ecs: ECS, cameraSystem: CameraSystem) {
    super(ecs);
    this.cameraSystem = cameraSystem;
    this.loadRadiationAssets();
  }

  /**
   * Carica gli asset per l'animazione della radiazione
   */
  private async loadRadiationAssets(): Promise<void> {
    if (this.isLoadingRadiation) return;
    this.isLoadingRadiation = true;

    try {
      const { AtlasParser } = await import('../../core/utils/AtlasParser');
      const atlasData = await AtlasParser.parseAtlas('assets/radiation/radiation.atlas');
      this.radiationFrames = await AtlasParser.extractFrames(atlasData);
      console.log(`[BoundsSystem] Cucinati ${this.radiationFrames.length} frame di radiazione.`);
    } catch (error) {
      console.error('[BoundsSystem] Errore caricamento radiation assets:', error);
    } finally {
      this.isLoadingRadiation = false;
    }
  }

  /**
   * Imposta il riferimento al player
   */
  setPlayerEntity(playerEntity: any): void {
    this.playerEntity = playerEntity;
  }

  /**
   * Imposta il sistema audio per i suoni di warning
   */
  setAudioSystem(audioSystem: any): void {
    this.audioSystem = audioSystem;
  }

  update(deltaTime: number): void {
    if (!this.playerEntity) return;

    const transform = this.ecs.getComponent(this.playerEntity, Transform);
    const health = this.ecs.getComponent(this.playerEntity, Health);

    if (!transform || !health) return;

    // Controlla se il player è fuori dai bounds
    const isOutOfBounds = this.isOutOfBounds(transform.x, transform.y);

    if (isOutOfBounds) {
      // Accumula tempo per il danno periodico
      this.damageTimer += deltaTime;

      // Aggiorna animazione radiazione
      this.animationTimer += deltaTime;
      if (this.animationTimer >= this.FRAME_DURATION) {
        this.radiationAnimationFrame = (this.radiationAnimationFrame + 1) % Math.max(1, this.radiationFrames.length);
        this.animationTimer = 0;
      }

      // Riproduci warning vocale ogni 3 secondi (controllo atomico)
      const now = Date.now();
      if (now - this.lastWarningTime >= this.WARNING_INTERVAL) {
        if (this.audioSystem) {
          this.audioSystem.playSound('warning', 0.7, false, false, 'voice'); // Cambiato allowMultiple a false
        }
        this.lastWarningTime = now;
      }

      // Applica danno periodico quando accumulato abbastanza tempo
      if (this.damageTimer >= this.DAMAGE_INTERVAL) {
        health.takeDamage(this.DAMAGE_AMOUNT);
        this.damageTimer = 0; // Reset del timer danno

        // Mostra il numero di danno come testo fluttuante
        this.notifyCombatSystemOfDamage(this.playerEntity, this.DAMAGE_AMOUNT);
      }
    } else {
      // Reset di tutti i timer quando torna dentro i bounds
      this.damageTimer = 0;
      this.lastWarningTime = 0;
      this.radiationAnimationFrame = 0;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // 1. Renderizza le linee di confine rosse
    this.renderBounds(ctx);

    // 2. Se fuori bounds, renderizza l'effetto radiazione overlay
    if (this.playerEntity) {
      const transform = this.ecs.getComponent(this.playerEntity, Transform);
      if (transform && this.isOutOfBounds(transform.x, transform.y)) {
        this.renderRadiationOverlay(ctx);
      }
    }
  }

  /**
   * Renderizza l'effetto visivo della radiazione centrato sul giocatore
   */
  private renderRadiationOverlay(ctx: CanvasRenderingContext2D): void {
    if (this.radiationFrames.length === 0 || !this.playerEntity) return;

    const transform = this.ecs.getComponent(this.playerEntity, Transform);
    if (!transform) return;

    const camera = this.cameraSystem.getCamera();
    if (!camera) return;

    // Ottieni dimensioni logiche e posizione schermo del player
    const { width, height } = DisplayManager.getInstance().getLogicalSize();
    const screenPos = camera.worldToScreen(transform.x, transform.y, width, height);

    const frame = this.radiationFrames[this.radiationAnimationFrame];
    if (!frame) return;

    ctx.save();

    // Effetto "glow" energetico
    ctx.globalAlpha = 0.8;
    ctx.globalCompositeOperation = 'screen';

    // Disegna l'animazione centrata sull'astronave
    const size = 250; // Dimensione ridotta per un effetto meno invasivo
    ctx.drawImage(
      frame,
      screenPos.x - size / 2,
      screenPos.y - size / 2,
      size,
      size
    );

    ctx.restore();
  }

  /**
   * Verifica se una posizione è fuori dai bounds
   */
  private isOutOfBounds(x: number, y: number): boolean {
    return x < this.BOUNDS_LEFT ||
      x > this.BOUNDS_RIGHT ||
      y < this.BOUNDS_TOP ||
      y > this.BOUNDS_BOTTOM;
  }

  /**
   * Notifica il CombatSystem per mostrare i numeri di danno
   */
  private notifyCombatSystemOfDamage(targetEntity: any, damage: number): void {
    // Cerca il CombatSystem nell'ECS (robusto contro minificazione)
    const systems = (this.ecs as any).systems || [];
    const combatSystem = systems.find((system: any) =>
      typeof system.createDamageText === 'function'
    );

    if (combatSystem) {
      // Il danno dei bounds è sempre danno HP e permette più testi simultanei
      combatSystem.createDamageText(targetEntity, damage, false, true);
    }
  }

  /**
   * Renderizza i confini della mappa come particelle di "Polvere Stellare"
   */
  private renderBounds(ctx: CanvasRenderingContext2D): void {
    const camera = this.cameraSystem.getCamera();
    if (!camera) return;

    ctx.save();

    const { width, height } = DisplayManager.getInstance().getLogicalSize();
    const now = Date.now();
    const flowSpeed = 0.000005;

    const worldW = this.BOUNDS_RIGHT - this.BOUNDS_LEFT;
    const worldH = this.BOUNDS_BOTTOM - this.BOUNDS_TOP;
    const totalPerim = 2 * (worldW + worldH);

    const step = 20;
    const particleCount = Math.floor(totalPerim / step);
    const flowOffset = (now * flowSpeed * totalPerim) % totalPerim;

    ctx.fillStyle = 'white';

    for (let i = 0; i < particleCount; i++) {
      let d = (i * step + flowOffset) % totalPerim;
      let wx, wy;

      if (d < worldW) {
        wx = this.BOUNDS_LEFT + d; wy = this.BOUNDS_TOP;
      } else if (d < worldW + worldH) {
        wx = this.BOUNDS_RIGHT; wy = this.BOUNDS_TOP + (d - worldW);
      } else if (d < 2 * worldW + worldH) {
        wx = this.BOUNDS_RIGHT - (d - (worldW + worldH)); wy = this.BOUNDS_BOTTOM;
      } else {
        wx = this.BOUNDS_LEFT; wy = this.BOUNDS_BOTTOM - (d - (2 * worldW + worldH));
      }

      const driftX = (Math.sin(i * 3.7 + now * 0.0003) * 20);
      const driftY = (Math.sin(i * 5.2 + now * 0.0004) * 20);
      const screenPos = camera.worldToScreen(wx, wy, width, height);
      const pulse = 0.5 + Math.abs(Math.sin(now * 0.001 + i * 0.5)) * 0.2;

      ctx.globalAlpha = pulse;
      ctx.fillRect(screenPos.x + driftX, screenPos.y + driftY, 1.5, 1.5);
    }

    ctx.restore();
  }

}
