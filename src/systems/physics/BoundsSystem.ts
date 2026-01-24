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
    const size = 350; // Dimensione dell'effetto attorno al player
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
   * Renderizza le linee di confine rosse (esattamente ai bordi della mappa)
   */
  private renderBounds(ctx: CanvasRenderingContext2D): void {
    ctx.save();

    // Stile della linea di confine
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3;
    ctx.setLineDash([]); // Linea continua
    ctx.globalAlpha = 0.8;

    // Ottieni la camera dal camera system
    const camera = this.cameraSystem.getCamera();
    if (!camera) return;

    // Converti coordinate mondo in coordinate schermo usando dimensioni logiche
    const { width, height } = DisplayManager.getInstance().getLogicalSize();
    const topLeft = camera.worldToScreen(this.BOUNDS_LEFT, this.BOUNDS_TOP, width, height);
    const topRight = camera.worldToScreen(this.BOUNDS_RIGHT, this.BOUNDS_TOP, width, height);
    const bottomRight = camera.worldToScreen(this.BOUNDS_RIGHT, this.BOUNDS_BOTTOM, width, height);
    const bottomLeft = camera.worldToScreen(this.BOUNDS_LEFT, this.BOUNDS_BOTTOM, width, height);

    // Disegna il rettangolo di confine
    ctx.beginPath();
    ctx.moveTo(topLeft.x, topLeft.y);
    ctx.lineTo(topRight.x, topRight.y);
    ctx.lineTo(bottomRight.x, bottomRight.y);
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }

}
