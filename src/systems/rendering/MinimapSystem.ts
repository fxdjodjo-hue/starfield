import { System } from '../../infrastructure/ecs/System';
import { Transform } from '../../entities/spatial/Transform';
import { Npc } from '../../entities/ai/Npc';
import { SelectedNpc } from '../../entities/combat/SelectedNpc';
import { Minimap } from '../../ui/Minimap';
import { Camera } from '../../entities/spatial/Camera';
import { CONFIG } from '../../utils/config/Config';

/**
 * Sistema per gestire la minimappa quadrata
 * Gestisce rendering e interazione click-to-move
 */
export class MinimapSystem extends System {
  private minimap: Minimap;
  private camera: Camera | null = null;
  private canvas: HTMLCanvasElement;
  private onMoveToCallback: ((worldX: number, worldY: number) => void) | null = null;

  constructor(ecs: any, canvas: HTMLCanvasElement) {
    super(ecs);
    this.canvas = canvas;

    // Crea minimappa con dimensioni mondo dal config
    this.minimap = new Minimap(
      0, 0, 200, 200, // posizione e dimensioni verranno aggiornate
      CONFIG.WORLD_WIDTH,
      CONFIG.WORLD_HEIGHT
    );

    // Ascolta eventi di resize finestra
    window.addEventListener('resize', () => this.handleResize());
    this.handleResize(); // Imposta posizione iniziale
  }

  /**
   * Imposta la camera per conversioni coordinate
   */
  setCamera(camera: Camera): void {
    this.camera = camera;
  }

  /**
   * Imposta callback per movimento player
   */
  setMoveToCallback(callback: (worldX: number, worldY: number) => void): void {
    this.onMoveToCallback = callback;
  }

  /**
   * Gestisce click sulla minimappa
   */
  handleClick(screenX: number, screenY: number): boolean {
    if (!this.minimap.enabled || !this.minimap.visible) return false;

    if (this.minimap.isPointInside(screenX, screenY)) {
      const worldPos = this.minimap.minimapToWorld(screenX, screenY);

      if (this.onMoveToCallback) {
        this.onMoveToCallback(worldPos.x, worldPos.y);
      }

      return true; // Click gestito dalla minimappa
    }

    return false; // Click non sulla minimappa
  }

  /**
   * Aggiorna il sistema (chiamato dal loop di gioco)
   */
  update(deltaTime: number): void {
    // La minimappa non ha logica di update complessa
    // Potrebbe essere usata per animazioni future o aggiornamenti dinamici
  }

  /**
   * Renderizza la minimappa
   */
  render(ctx: CanvasRenderingContext2D): void {
    if (!this.minimap.visible) return;

    this.renderMinimapBackground(ctx);
    this.renderEntities(ctx);
    this.renderPlayerIndicator(ctx);
  }

  /**
   * Renderizza lo sfondo della minimappa
   */
  private renderMinimapBackground(ctx: CanvasRenderingContext2D): void {
    // Sfondo
    ctx.fillStyle = this.minimap.backgroundColor;
    ctx.fillRect(this.minimap.x, this.minimap.y, this.minimap.width, this.minimap.height);

    // Bordo
    ctx.strokeStyle = this.minimap.borderColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(this.minimap.x, this.minimap.y, this.minimap.width, this.minimap.height);

    // Indicatore centro mondo (opzionale)
    const centerX = this.minimap.x + this.minimap.width / 2;
    const centerY = this.minimap.y + this.minimap.height / 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - 5, centerY);
    ctx.lineTo(centerX + 5, centerY);
    ctx.moveTo(centerX, centerY - 5);
    ctx.lineTo(centerX, centerY + 5);
    ctx.stroke();
  }

  /**
   * Renderizza tutte le entità sulla minimappa
   */
  private renderEntities(ctx: CanvasRenderingContext2D): void {
    // Renderizza NPC
    const npcEntities = this.ecs.getEntitiesWithComponents(Npc);
    npcEntities.forEach(entityId => {
      const transform = this.ecs.getComponent(entityId, Transform);
      if (transform) {
        const isSelected = this.ecs.getComponent(entityId, SelectedNpc) !== null;
        // Debug: forza sempre colore rosso per verificare
        const color = this.minimap.npcColor; // Forza sempre rosso per debug
        this.renderEntityDot(ctx, transform.x, transform.y, color);
      }
    });
  }

  /**
   * Renderizza l'indicatore del player
   */
  private renderPlayerIndicator(ctx: CanvasRenderingContext2D): void {
    if (!this.camera) return;

    // Il player è al centro della camera
    const playerX = this.camera.x;
    const playerY = this.camera.y;

    // Renderizza player con forma diversa (triangolo)
    this.renderPlayerTriangle(ctx, playerX, playerY);
  }

  /**
   * Renderizza un pallino per un'entità
   */
  private renderEntityDot(ctx: CanvasRenderingContext2D, worldX: number, worldY: number, color: string): void {
    const pos = this.minimap.worldToMinimap(worldX, worldY);

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, this.minimap.entityDotSize, 0, Math.PI * 2);
    ctx.fill();

    // Bordino bianco per migliore visibilità
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /**
   * Renderizza il player come quadrato blu
   */
  private renderPlayerTriangle(ctx: CanvasRenderingContext2D, worldX: number, worldY: number): void {
    const pos = this.minimap.worldToMinimap(worldX, worldY);
    const size = 6;

    ctx.fillStyle = this.minimap.playerColor;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;

    // Disegna un quadrato invece di un triangolo
    const halfSize = size / 2;
    ctx.fillRect(pos.x - halfSize, pos.y - halfSize, size, size);
    ctx.strokeRect(pos.x - halfSize, pos.y - halfSize, size, size);
  }

  /**
   * Gestisce il resize della finestra
   */
  private handleResize(): void {
    this.minimap.updateViewport(window.innerWidth, window.innerHeight);
  }

  /**
   * Toggle visibilità minimappa
   */
  toggleVisibility(): void {
    this.minimap.visible = !this.minimap.visible;
  }

  /**
   * Restituisce riferimento alla minimappa per accesso esterno
   */
  getMinimap(): Minimap {
    return this.minimap;
  }
}
