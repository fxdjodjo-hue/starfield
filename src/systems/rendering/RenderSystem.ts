import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { Npc } from '../../entities/ai/Npc';
import { SelectedNpc } from '../../entities/combat/SelectedNpc';
import { Health } from '../../entities/combat/Health';
import { Shield } from '../../entities/combat/Shield';
import { Damage } from '../../entities/combat/Damage';
import { Explosion } from '../../entities/combat/Explosion';
import { Projectile } from '../../entities/combat/Projectile';
import { Camera } from '../../entities/spatial/Camera';
import { MovementSystem } from '../physics/MovementSystem';
import { PlayerSystem } from '../player/PlayerSystem';
import { ParallaxLayer } from '../../entities/spatial/ParallaxLayer';
import { Sprite } from '../../entities/Sprite';
import { Velocity } from '../../entities/spatial/Velocity';

/**
 * Sistema di rendering per Canvas 2D
 * Renderizza tutte le entità con componente Transform applicando la camera
 */
export class RenderSystem extends BaseSystem {
  private movementSystem: MovementSystem;
  private playerSystem: PlayerSystem;
  private scouterProjectileImage: HTMLImageElement | null = null;

  constructor(ecs: ECS, movementSystem: MovementSystem, playerSystem: PlayerSystem) {
    super(ecs);
    this.movementSystem = movementSystem;
    this.playerSystem = playerSystem;
    this.loadScouterProjectileImage();
  }

  private loadScouterProjectileImage(): void {
    this.scouterProjectileImage = new Image();
    this.scouterProjectileImage.src = 'assets/npc_ships/scouter/npc_scouter_projectile.png';
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
      const sprite = this.ecs.getComponent(entity, Sprite);
      const explosion = this.ecs.getComponent(entity, Explosion);

      // Salta i proiettili - vengono renderizzati separatamente
      if (projectile) continue;

      // Salta gli elementi parallax - vengono renderizzati dal ParallaxSystem
      if (parallax) continue;

      if (transform) {
        // Converte le coordinate world in coordinate schermo usando la camera
        const screenPos = camera.worldToScreen(transform.x, transform.y, ctx.canvas.width, ctx.canvas.height);

        // Controlla se è un'esplosione
        if (explosion) {
          this.renderExplosion(ctx, transform, explosion, screenPos.x, screenPos.y);
        } else if (npc) {
          // Renderizza come NPC
          const entitySprite = this.ecs.getComponent(entity, Sprite);
          const entityVelocity = this.ecs.getComponent(entity, Velocity);
          this.renderNpc(ctx, transform, npc, screenPos.x, screenPos.y, selected !== undefined, entitySprite, entityVelocity);

          // Mostra range di attacco se selezionato
          if (selected !== undefined) {
            const damage = this.ecs.getComponent(entity, Damage);
            if (damage) {
              this.renderAttackRange(ctx, screenPos.x, screenPos.y, damage.attackRange, '#ff4444');
            }
          }
        } else {
          // Renderizza come player (con sprite se disponibile)
          // Aggiungi leggera fluttuazione al player
          const floatOffsetY = Math.sin(Date.now() * 0.003) * 2; // Fluttuazione verticale di ±2 pixel
          this.renderEntity(ctx, transform, screenPos.x, screenPos.y + floatOffsetY, sprite);

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
          this.renderHealthAndShieldBars(ctx, screenPos.x, screenPos.y, health || null, shield || null);
        }
      }
    }

    // Renderizza i proiettili
    this.renderProjectiles(ctx, camera);
  }

  /**
   * Renderizza una singola entità (placeholder per nave)
   */
  private renderEntity(ctx: CanvasRenderingContext2D, transform: Transform, screenX: number, screenY: number, sprite?: Sprite): void {
    ctx.save();

    // Applica trasformazioni usando le coordinate schermo
    ctx.translate(screenX, screenY);
    ctx.rotate(transform.rotation);
    ctx.scale(transform.scaleX, transform.scaleY);

    if (sprite && sprite.isLoaded()) {
      // Renderizza lo sprite
      const spriteX = -sprite.width / 2 + sprite.offsetX;
      const spriteY = -sprite.height / 2 + sprite.offsetY;
      ctx.drawImage(sprite.image, spriteX, spriteY, sprite.width, sprite.height);
    } else {
      // Render placeholder nave (triangolo semplice) - fallback
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
    }

    ctx.restore();
  }

  /**
   * Renderizza un NPC
   */
  private renderNpc(ctx: CanvasRenderingContext2D, transform: Transform, npc: Npc, screenX: number, screenY: number, isSelected: boolean = false, sprite?: Sprite, velocity?: Velocity): void {
    ctx.save();

    // Applica trasformazioni usando le coordinate schermo
    ctx.translate(screenX, screenY);

    // Per NPC con sprite, calcola rotazione basata sulla direzione di movimento
    if (sprite && sprite.isLoaded() && velocity) {
      // Calcola l'angolo dalla direzione di movimento
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      if (speed > 0.1) { // Se si sta muovendo (velocità minima per evitare divisioni per zero)
        const rotationAngle = Math.atan2(velocity.y, velocity.x) + Math.PI / 2; // +90° per orientare correttamente lo sprite
        ctx.rotate(rotationAngle);
      } else {
        // Se fermo, usa la rotazione standard
        ctx.rotate(transform.rotation);
      }
    } else {
      // Per forme geometriche o NPC senza velocity, usa la rotazione standard
      ctx.rotate(transform.rotation);
    }

    ctx.scale(transform.scaleX, transform.scaleY);

    // Cerchio rosso di selezione (se selezionato)
    if (isSelected) {
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2); // Cerchio di raggio 18px attorno all'NPC
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Se l'NPC ha uno sprite, renderizza quello invece della forma geometrica
    if (sprite && sprite.isLoaded()) {
      // Renderizza lo sprite dell'NPC
      const spriteX = -sprite.width / 2 + sprite.offsetX;
      const spriteY = -sprite.height / 2 + sprite.offsetY;
      ctx.drawImage(sprite.image, spriteX, spriteY, sprite.width, sprite.height);
    } else {
      // Fallback: renderizza forme geometriche
      if (npc.npcType === 'triangle') {
        // Triangolo rosso per NPC nemici
        const size = 10;
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
        const size = 8;
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
      }
    }

    ctx.restore();

    // Renderizza il nickname FUORI dalle trasformazioni per evitare effetti 3D strani
    // Il nickname deve rimanere orizzontale e leggibile
    this.renderNpcNickname(ctx, npc, screenX, screenY + 45);
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

      // Controlla se il proiettile appartiene a un NPC (scouter)
      // Usa la stessa logica robusta del ProjectileSystem per garantire consistenza
      const playerEntity = this.playerSystem.getPlayerEntity();
      const isNpcProjectile = playerEntity && projectile.ownerId !== playerEntity.id;

      ctx.save();

      if (isNpcProjectile) {
        // Renderizza proiettile NPC (scouter)
        if (this.scouterProjectileImage && this.scouterProjectileImage.complete && this.scouterProjectileImage.width > 0) {
          // Usa l'immagine del proiettile se disponibile
          const imageSize = 36; // Dimensione del proiettile (ingrandito)
          ctx.drawImage(
            this.scouterProjectileImage,
            screenPos.x - imageSize / 2,
            screenPos.y - imageSize / 2,
            imageSize,
            imageSize
          );
        } else {
          // Fallback: proiettile NPC come laser verde semplice
          const laserLength = 12; // Lunghezza leggermente più corta
          const endX = screenPos.x + projectile.directionX * laserLength;
          const endY = screenPos.y + projectile.directionY * laserLength;

          // Laser verde semplice per NPC
          ctx.strokeStyle = '#00ff00'; // Verde per NPC
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';

          ctx.beginPath();
          ctx.moveTo(screenPos.x, screenPos.y);
          ctx.lineTo(endX, endY);
          ctx.stroke();

          // Linea bianca al centro per effetto laser
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(screenPos.x, screenPos.y);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        }
      } else {
        // Renderizza proiettile player come laser rosso (ora duali)
        const laserLength = 15; // Lunghezza del laser
        const endX = screenPos.x + projectile.directionX * laserLength;
        const endY = screenPos.y + projectile.directionY * laserLength;

        // Disegna il laser come linea rossa
        ctx.strokeStyle = '#ff0000'; // Rosso per i laser del player
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
   * Renderizza il nickname dell'NPC sotto di esso (stile uniforme al player)
   */
  private renderNpcNickname(ctx: CanvasRenderingContext2D, npc: Npc, offsetX: number, offsetY: number): void {
    ctx.save();

    // Stile uniforme al player ma con colori distintivi per tipo NPC
    ctx.font = '500 12px "Segoe UI", Tahoma, Geneva, Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Colore rosso uniforme per tutti gli NPC
    const textColor = 'rgba(255, 68, 68, 0.9)'; // Rosso con trasparenza

    // Testo con ombra elegante come il player
    ctx.fillStyle = textColor;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 3;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1;

    // Disegna il testo
    ctx.fillText(npc.npcType, offsetX, offsetY);

    ctx.restore();
  }

  /**
   * Renderizza un effetto esplosione
   */
  private renderExplosion(ctx: CanvasRenderingContext2D, transform: Transform, explosion: Explosion, screenX: number, screenY: number): void {
    const currentFrame = explosion.getCurrentFrame();

    if (currentFrame && currentFrame.complete && currentFrame.naturalWidth > 0) {
      ctx.save();

      // Centra l'esplosione rispetto alla posizione dell'entità - dimensioni più grandi
      const explosionWidth = currentFrame.width * 0.8; // Scala l'esplosione al 80%
      const explosionHeight = currentFrame.height * 0.8;

      ctx.drawImage(
        currentFrame,
        screenX - explosionWidth / 2,
        screenY - explosionHeight / 2,
        explosionWidth,
        explosionHeight
      );

      ctx.restore();
    }
  }

}
