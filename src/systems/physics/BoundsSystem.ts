import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { Health } from '../../entities/combat/Health';
import { CONFIG } from '../../utils/config/Config';
import { CameraSystem } from '../rendering/CameraSystem';

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
  private readonly DAMAGE_AMOUNT = 10;

  // Timer atomico per warning vocale periodico (basato su timestamp assoluti)
  private lastWarningTime = 0;
  private readonly WARNING_INTERVAL = 3000; // 3 secondi

  // Sistema audio
  private audioSystem: any = null;

  // Riferimenti ai sistemi
  private playerEntity: any = null;
  private cameraSystem: CameraSystem;

  constructor(ecs: ECS, cameraSystem: CameraSystem) {
    super(ecs);
    this.cameraSystem = cameraSystem;
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
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Renderizza le linee di confine rosse
    this.renderBounds(ctx);
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

    // Converti coordinate mondo in coordinate schermo
    const topLeft = camera.worldToScreen(this.BOUNDS_LEFT, this.BOUNDS_TOP, ctx.canvas.width, ctx.canvas.height);
    const topRight = camera.worldToScreen(this.BOUNDS_RIGHT, this.BOUNDS_TOP, ctx.canvas.width, ctx.canvas.height);
    const bottomRight = camera.worldToScreen(this.BOUNDS_RIGHT, this.BOUNDS_BOTTOM, ctx.canvas.width, ctx.canvas.height);
    const bottomLeft = camera.worldToScreen(this.BOUNDS_LEFT, this.BOUNDS_BOTTOM, ctx.canvas.width, ctx.canvas.height);

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
