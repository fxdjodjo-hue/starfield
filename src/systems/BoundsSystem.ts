import { System as BaseSystem } from '/src/infrastructure/ecs/System';
import { ECS } from '/src/infrastructure/ecs/ECS';
import { Transform } from '/src/entities/spatial/Transform';
import { Health } from '/src/entities/combat/Health';
import { CONFIG } from '/src/utils/config/Config';
import { MovementSystem } from './physics/MovementSystem';

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

  // Riferimenti ai sistemi
  private playerEntity: any = null;
  private movementSystem: MovementSystem;

  constructor(ecs: ECS, movementSystem: MovementSystem) {
    super(ecs);
    this.movementSystem = movementSystem;
  }

  /**
   * Imposta il riferimento al player
   */
  setPlayerEntity(playerEntity: any): void {
    this.playerEntity = playerEntity;
  }

  update(deltaTime: number): void {
    if (!this.playerEntity) return;

    const transform = this.ecs.getComponent(this.playerEntity, Transform);
    const health = this.ecs.getComponent(this.playerEntity, Health);

    if (!transform || !health) return;

    // Controlla se il player è fuori dai bounds
    const isOutOfBounds = this.isOutOfBounds(transform.x, transform.y);

    if (isOutOfBounds) {
      // Accumula tempo quando fuori bounds
      this.damageTimer += deltaTime;

      // Applica danno periodico quando accumulato abbastanza tempo
      if (this.damageTimer >= this.DAMAGE_INTERVAL) {
        health.takeDamage(this.DAMAGE_AMOUNT);
        this.damageTimer = 0; // Reset del timer

        // Mostra il numero di danno come testo fluttuante
        this.notifyCombatSystemOfDamage(this.playerEntity, this.DAMAGE_AMOUNT);

        console.log(`⚠️ Player fuori bounds! Danno: -${this.DAMAGE_AMOUNT} HP`);
      }
    } else {
      // Reset del timer quando torna dentro i bounds
      this.damageTimer = 0;
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
    // Cerca il CombatSystem nell'ECS
    const combatSystem = (this.ecs as any).systems?.find((system: any) =>
      system.constructor.name === 'CombatSystem'
    );

    if (combatSystem && combatSystem.createDamageText) {
      // Il danno dei bounds è sempre danno HP (non shield)
      combatSystem.createDamageText(targetEntity, damage, false);
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
    ctx.setLineDash([10, 5]); // Linea tratteggiata
    ctx.globalAlpha = 0.8;

    // Ottieni la camera dal movement system
    const camera = this.movementSystem.getCamera();
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
