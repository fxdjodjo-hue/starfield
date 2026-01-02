import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { Npc } from '../../entities/ai/Npc';
import { SelectedNpc } from '../../entities/combat/SelectedNpc';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { Damage } from '../../entities/combat/Damage';
import { Projectile } from '../../entities/combat/Projectile';
import { Camera } from '../../entities/spatial/Camera';
import { MovementSystem } from '../physics/MovementSystem';
import { ParallaxLayer } from '../../entities/spatial/ParallaxLayer';

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

    // Renderizza stelle di sfondo semplici
    this.renderBackgroundStars(ctx, camera);

    // Ottiene tutte le entità con Transform
    const entities = this.ecs.getEntitiesWithComponents(Transform);

    for (const entity of entities) {
      const transform = this.ecs.getComponent(entity, Transform);
      const npc = this.ecs.getComponent(entity, Npc);
      const selected = this.ecs.getComponent(entity, SelectedNpc);
      const projectile = this.ecs.getComponent(entity, Projectile);
      const parallax = this.ecs.getComponent(entity, ParallaxLayer);

      // Salta i proiettili - vengono renderizzati separatamente
      if (projectile) continue;

      // Salta gli elementi parallax - vengono renderizzati dal ParallaxSystem
      if (parallax) continue;

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

        // Renderizza le barre salute/shield se l'entità ha componenti
        const health = this.ecs.getComponent(entity, Health);
        const shield = this.ecs.getComponent(entity, Shield);
        if (health || shield) {
          this.renderHealthAndShieldBars(ctx, screenPos.x, screenPos.y, health, shield);
        }
      }
    }

    // Renderizza i proiettili
    this.renderProjectiles(ctx, camera);
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

    if (npc.npcType === 'triangle') {
      // Triangolo rosso per NPC nemici
      const size = 14;
      ctx.beginPath();
      ctx.moveTo(0, -size/2); // Punta superiore
      ctx.lineTo(-size/2, size/2); // Angolo sinistro
      ctx.lineTo(size/2, size/2); // Angolo destro
      ctx.closePath();

      // NPC triangolo: rosso con bordo arancione
      ctx.fillStyle = '#ff4444';
      ctx.strokeStyle = '#ff8800';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
    } else {
      // Quadrato per gli NPC normali (tipo 'square' o default)
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

      // Renderizza il nickname sotto l'NPC (come il player)
      this.renderNpcNickname(ctx, npc, 0, 45);
    }

    ctx.restore();
  }

  /**
   * Renderizza le barre salute e shield sopra l'entità
   */
  private renderHealthAndShieldBars(ctx: CanvasRenderingContext2D, x: number, y: number, health: Health | null, shield: Shield | null): void {
    const barWidth = 40;
    const barHeight = 6;
    let barY = y - 60; // Posiziona ancora più in alto sopra l'entità

    // Renderizza prima lo shield (se presente), poi la salute sotto
    if (shield) {
      // Barra shield (blu)
      const shieldPercent = shield.getShieldPercentage();

      // Sfondo barra shield (blu scuro)
      ctx.fillStyle = '#001133';
      ctx.fillRect(x - barWidth/2, barY, barWidth, barHeight);

      // Barra shield
      ctx.fillStyle = '#4444ff';
      ctx.fillRect(x - barWidth/2, barY, barWidth * shield.getPercentage(), barHeight);

      // Bordino bianco
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - barWidth/2, barY, barWidth, barHeight);

      barY += barHeight + 2; // Sposta giù la barra salute
    }

    // Renderizza la barra salute se presente
    if (health) {
      // Sfondo barra salute (rosso scuro)
      ctx.fillStyle = '#330000';
      ctx.fillRect(x - barWidth/2, barY, barWidth, barHeight);

      // Barra salute (verde per buona salute, giallo per media, rosso per bassa)
      const healthPercent = health.getPercentage();
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
  private renderProjectiles(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const projectiles = this.ecs.getEntitiesWithComponents(Transform, Projectile);

    for (const projectileEntity of projectiles) {
      const transform = this.ecs.getComponent(projectileEntity, Transform);
      const projectile = this.ecs.getComponent(projectileEntity, Projectile);

      if (!transform || !projectile) continue;

      // Converte coordinate mondo a schermo
      const screenPos = camera.worldToScreen(transform.x, transform.y, ctx.canvas.width, ctx.canvas.height);

      // Renderizza il proiettile come laser rosso
      ctx.save();

      // Calcola la fine del laser (direzione del proiettile)
      const laserLength = 15; // Lunghezza del laser
      const endX = screenPos.x + projectile.directionX * laserLength;
      const endY = screenPos.y + projectile.directionY * laserLength;

      // Disegna il laser come linea rossa
      ctx.strokeStyle = '#ff0000'; // Rosso per i laser
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';

      // Aggiungi effetto luminoso
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 8;

      ctx.beginPath();
      ctx.moveTo(screenPos.x, screenPos.y);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Aggiungi una linea più sottile al centro per effetto laser
      ctx.strokeStyle = '#ffffff'; // Bianco al centro
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0; // Rimuovi ombra per il centro
      ctx.stroke();

      ctx.restore();
    }
  }

  /**
   * Renderizza stelle di sfondo che coprono tutta la mappa
   */
  private renderBackgroundStars(ctx: CanvasRenderingContext2D, camera: any): void {
    // Crea stelle distribuite uniformemente su tutta la mappa
    ctx.save();
    ctx.fillStyle = 'white';

    // Usa le dimensioni della mappa dal config
    const worldWidth = 21000;  // CONFIG.WORLD_WIDTH
    const worldHeight = 13100; // CONFIG.WORLD_HEIGHT

    // Aumenta il numero di stelle per densità massima (600 stelle)
    let renderedStars = 0;
    const totalStars = 600;

    for (let i = 0; i < totalStars; i++) {
      // Distribuisci uniformemente su tutta la mappa usando una griglia
      const gridCols = Math.ceil(Math.sqrt(totalStars));
      const gridRows = Math.ceil(totalStars / gridCols);

      const gridX = i % gridCols;
      const gridY = Math.floor(i / gridCols);

      // Calcola posizione base nella griglia
      const cellWidth = worldWidth / gridCols;
      const cellHeight = worldHeight / gridRows;

      const baseX = gridX * cellWidth - worldWidth / 2;
      const baseY = gridY * cellHeight - worldHeight / 2;

      // Aggiungi variazione casuale entro la cella (usa hash per consistenza)
      const hash = (i * 73856093) % 1000000;
      const variationX = ((hash % 100) / 100 - 0.5) * cellWidth * 0.9;
      const variationY = (((hash / 100) % 100) / 100 - 0.5) * cellHeight * 0.9;

      const x = baseX + variationX;
      const y = baseY + variationY;

      // Converti in coordinate schermo
      const screenPos = camera.worldToScreen(x, y, ctx.canvas.width, ctx.canvas.height);

      // Renderizza solo se visibile (con margine più ampio per transizioni fluide)
      if (screenPos.x >= -50 && screenPos.x <= ctx.canvas.width + 50 &&
          screenPos.y >= -50 && screenPos.y <= ctx.canvas.height + 50) {
        const size = 1 + (hash % 2); // Size 1-2 pixel (ancora più piccole per alta densità)
        ctx.globalAlpha = 0.5 + (hash % 50) / 100; // Alpha 0.5-1.0 per profondità
        ctx.fillRect(screenPos.x - size/2, screenPos.y - size/2, size, size);
        renderedStars++;
      }
    }

    ctx.restore();
  }

  /**
   * Renderizza il tipo dell'NPC sotto di esso
   */
  private renderNpcNickname(ctx: CanvasRenderingContext2D, npc: Npc, offsetX: number, offsetY: number): void {
    ctx.save();

    // Stile del testo
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Aggiungi ombra per leggibilità
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;

    // Disegna il contorno nero
    ctx.strokeText(npc.npcType, offsetX, offsetY);

    // Disegna il testo bianco
    ctx.fillText(npc.npcType, offsetX, offsetY);

    ctx.restore();
  }

}
