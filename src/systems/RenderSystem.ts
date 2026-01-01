import { BaseSystem } from '../ecs/System';
import { ECS } from '../ecs/ECS';
import { Transform } from '../components/Transform';
import { Npc } from '../components/Npc';
import { SelectedNpc } from '../components/SelectedNpc';
import { Health } from '../components/Health';
import { Damage } from '../components/Damage';
import { Projectile } from '../components/Projectile';
import { MovementSystem } from './MovementSystem';

/**
 * Sistema di rendering per Canvas 2D
 * Renderizza tutte le entità con componente Transform applicando la camera
 */
export class RenderSystem extends BaseSystem {
  private movementSystem: MovementSystem;

  constructor(ecs: ECS, movementSystem: MovementSystem) {
    super(ecs);
    this.movementSystem = movementSystem;
  }

  update(deltaTime: number): void {
    // Il rendering avviene nel metodo render()
  }

  render(ctx: CanvasRenderingContext2D): void {
    const camera = this.movementSystem.getCamera();

    // Ottiene tutte le entità con Transform
    const entities = this.ecs.getEntitiesWithComponents(Transform);

    for (const entity of entities) {
      const transform = this.ecs.getComponent(entity, Transform);
      const npc = this.ecs.getComponent(entity, Npc);
      const selected = this.ecs.getComponent(entity, SelectedNpc);

      if (transform) {
        // Converte le coordinate world in coordinate schermo usando la camera
        const screenPos = camera.worldToScreen(transform.x, transform.y, ctx.canvas.width, ctx.canvas.height);

        if (npc) {
          // Renderizza come NPC
          this.renderNpc(ctx, transform, npc, screenPos.x, screenPos.y, selected !== undefined);

          // Mostra range di attacco se selezionato
          if (selected !== undefined) {
            const damage = this.ecs.getComponent(entity, Damage);
            if (damage) {
              this.renderAttackRange(ctx, screenPos.x, screenPos.y, damage.attackRange, '#ff4444');
            }
          }
        } else {
          // Renderizza come player
          this.renderEntity(ctx, transform, screenPos.x, screenPos.y);

          // Mostra sempre il range di attacco del player
          const damage = this.ecs.getComponent(entity, Damage);
          if (damage) {
            this.renderAttackRange(ctx, screenPos.x, screenPos.y, damage.attackRange, '#44ff44');
          }
        }

        // Renderizza la barra della salute se l'entità ha Health
        const health = this.ecs.getComponent(entity, Health);
        if (health) {
          this.renderHealthBar(ctx, screenPos.x, screenPos.y, health);
        }
      }
    }

    // Renderizza i proiettili
    this.renderProjectiles(ctx);
  }

  /**
   * Renderizza una singola entità (placeholder per nave)
   */
  private renderEntity(ctx: CanvasRenderingContext2D, transform: Transform, screenX: number, screenY: number): void {
    ctx.save();

    // Applica trasformazioni usando le coordinate schermo
    ctx.translate(screenX, screenY);
    ctx.rotate(transform.rotation);
    ctx.scale(transform.scaleX, transform.scaleY);

    // Render placeholder nave (triangolo semplice)
    ctx.fillStyle = '#00ff88';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;

    // Triangolo leggermente più grande (scalato del 30%)
    const scale = 1.3;
    ctx.beginPath();
    ctx.moveTo(0, -15 * scale); // Punta superiore
    ctx.lineTo(-10 * scale, 10 * scale); // Angolo sinistro
    ctx.lineTo(10 * scale, 10 * scale); // Angolo destro
    ctx.closePath();

    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Renderizza un NPC
   */
  private renderNpc(ctx: CanvasRenderingContext2D, transform: Transform, npc: Npc, screenX: number, screenY: number, isSelected: boolean = false): void {
    ctx.save();

    // Applica trasformazioni usando le coordinate schermo
    ctx.translate(screenX, screenY);
    ctx.rotate(transform.rotation);
    ctx.scale(transform.scaleX, transform.scaleY);

    // Cerchio rosso di selezione (se selezionato)
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(0, 0, 25, 0, Math.PI * 2); // Cerchio di raggio 25px attorno all'NPC
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Quadrato per gli NPC (diversi dal triangolo del player)
    const size = 12;
    ctx.beginPath();
    ctx.rect(-size/2, -size/2, size, size);

    // NPC: blu con bordo giallo
    ctx.fillStyle = '#0088ff';
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();

    // Aggiungi un punto al centro per identificare il tipo
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.restore();
  }

  /**
   * Renderizza una barra della salute sopra l'entità
   */
  private renderHealthBar(ctx: CanvasRenderingContext2D, x: number, y: number, health: Health): void {
    const barWidth = 40;
    const barHeight = 6;
    const barY = y - 35; // Posiziona sopra l'entità

    // Sfondo barra (rosso scuro)
    ctx.fillStyle = '#330000';
    ctx.fillRect(x - barWidth/2, barY, barWidth, barHeight);

    // Barra salute (verde per buona salute, giallo per media, rosso per bassa)
    const healthPercent = health.getHealthPercentage();
    let healthColor = '#00ff00'; // Verde

    if (healthPercent < 0.3) {
      healthColor = '#ff0000'; // Rosso
    } else if (healthPercent < 0.6) {
      healthColor = '#ffff00'; // Giallo
    }

    ctx.fillStyle = healthColor;
    ctx.fillRect(x - barWidth/2, barY, barWidth * healthPercent, barHeight);

    // Bordino bianco
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - barWidth/2, barY, barWidth, barHeight);
  }

  /**
   * Renderizza il cerchio del range di attacco
   */
  private renderAttackRange(ctx: CanvasRenderingContext2D, x: number, y: number, range: number, color: string): void {
    ctx.save();

    // Cerchio semitrasparente per il range
    ctx.beginPath();
    ctx.arc(x, y, range, 0, Math.PI * 2);
    ctx.fillStyle = color + '20'; // Colore con 20% opacità
    ctx.fill();

    // Bordino del range
    ctx.strokeStyle = color + '60'; // Colore con 60% opacità
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Renderizza tutti i proiettili
   */
  private renderProjectiles(ctx: CanvasRenderingContext2D): void {
    const projectiles = this.ecs.getEntitiesWithComponents(Transform, Projectile);

    for (const projectileEntity of projectiles) {
      const transform = this.ecs.getComponent(projectileEntity, Transform);
      const projectile = this.ecs.getComponent(projectileEntity, Projectile);

      if (!transform || !projectile) continue;

      // Converte coordinate mondo a schermo
      const screenPos = this.worldToScreen(transform.x, transform.y);

      // Renderizza il proiettile come un piccolo cerchio giallo
      ctx.save();
      ctx.fillStyle = '#ffff00'; // Giallo per i proiettili
      ctx.beginPath();
      ctx.arc(screenPos.x, screenPos.y, 3, 0, Math.PI * 2);
      ctx.fill();

      // Aggiungi un alone luminoso
      ctx.shadowColor = '#ffff00';
      ctx.shadowBlur = 5;
      ctx.fill();

      ctx.restore();
    }
  }
}
