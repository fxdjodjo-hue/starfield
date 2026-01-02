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
  private destinationX: number | null = null;
  private destinationY: number | null = null;
  private isMouseDownInMinimap: boolean = false;

  constructor(ecs: any, canvas: HTMLCanvasElement) {
    super(ecs);
    this.canvas = canvas;

    // Crea minimappa con dimensioni mondo dal config
    this.minimap = new Minimap(
      0, 0, // posizione (verrà aggiornata automaticamente)
      CONFIG.MINIMAP_WIDTH, CONFIG.MINIMAP_HEIGHT, // dimensioni dal config
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
   * Gestisce mouse down sulla minimappa
   */
  handleMouseDown(screenX: number, screenY: number): boolean {
    if (!this.minimap.enabled || !this.minimap.visible) return false;

    if (this.minimap.isPointInside(screenX, screenY)) {
      this.isMouseDownInMinimap = true;
      this.updateDestination(screenX, screenY);
      return true; // Mouse down gestito dalla minimappa
    }

    return false; // Mouse down non sulla minimappa
  }

  /**
   * Gestisce mouse move mentre è premuto nella minimappa
   */
  handleMouseMove(screenX: number, screenY: number): boolean {
    if (!this.isMouseDownInMinimap) return false;

    if (this.minimap.isPointInside(screenX, screenY)) {
      this.updateDestination(screenX, screenY);
      return true; // Mouse move gestito dalla minimappa
    } else {
      // Se il mouse esce dalla minimappa mentre è premuto, ferma il movimento
      this.handleMouseUp();
      return false;
    }
  }

  /**
   * Gestisce mouse up (ferma il movimento dalla minimappa)
   */
  handleMouseUp(): void {
    this.isMouseDownInMinimap = false;
  }

  /**
   * Aggiorna la destinazione e avvia il movimento
   */
  private updateDestination(screenX: number, screenY: number): void {
    const worldPos = this.minimap.minimapToWorld(screenX, screenY);

    // Salva la destinazione per mostrare la linea
    this.destinationX = worldPos.x;
    this.destinationY = worldPos.y;

    if (this.onMoveToCallback) {
      this.onMoveToCallback(worldPos.x, worldPos.y);
    }
  }

  /**
   * Metodo deprecato - mantenuto per compatibilità
   */
  handleClick(screenX: number, screenY: number): boolean {
    return this.handleMouseDown(screenX, screenY);
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
    // Salva stato del contesto
    ctx.save();

    // Sfondo
    ctx.fillStyle = this.minimap.backgroundColor;
    ctx.fillRect(this.minimap.x, this.minimap.y, this.minimap.width, this.minimap.height);

    // Bordo blu meno acceso
    ctx.strokeStyle = '#0066cc'; // Blu meno acceso
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

    // Testo "MINIMAP" sopra i bordi
    ctx.fillStyle = '#ffffff'; // Bianco invece di blu
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    const minimapTextX = this.minimap.x + this.minimap.width / 2;
    ctx.fillText('MINIMAP', minimapTextX, this.minimap.y - 8);

    // Coordinate del player poco a destra del testo MINIMAP
    if (this.camera) {
      const playerX = Math.round(this.camera.x);
      const playerY = Math.round(this.camera.y);
      ctx.fillStyle = '#ffffff'; // Bianco anche per le coordinate
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${playerX}, ${playerY}`, minimapTextX + 70, this.minimap.y - 6);
    }

    // Ripristina stato del contesto
    ctx.restore();
  }

  /**
   * Renderizza tutte le entità sulla minimappa
   */
  private renderEntities(ctx: CanvasRenderingContext2D): void {
    // Renderizza NPC
    const npcEntities = this.ecs.getEntitiesWithComponents(Npc);
    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);

    npcEntities.forEach(entityId => {
      const transform = this.ecs.getComponent(entityId, Transform);
      if (transform) {
        const isSelected = selectedNpcs.includes(entityId);
        const color = isSelected ? this.minimap.selectedNpcColor : this.minimap.npcColor;
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

    // Renderizza linea verso destinazione se presente
    if (this.destinationX !== null && this.destinationY !== null) {
      this.renderDestinationLine(ctx, playerX, playerY, this.destinationX, this.destinationY);
    }
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
   * Renderizza una linea dalla posizione del player alla destinazione
   */
  private renderDestinationLine(ctx: CanvasRenderingContext2D, playerX: number, playerY: number, destX: number, destY: number): void {
    const playerPos = this.minimap.worldToMinimap(playerX, playerY);
    const destPos = this.minimap.worldToMinimap(destX, destY);

    // Salva lo stato del contesto
    ctx.save();

    // Imposta stile linea continua
    ctx.strokeStyle = '#0066cc'; // Blu meno acceso come il bordo della minimappa
    ctx.lineWidth = 1;
    ctx.setLineDash([]); // Linea continua (rimuovi tratteggio)

    // Disegna la linea
    ctx.beginPath();
    ctx.moveTo(playerPos.x, playerPos.y);
    ctx.lineTo(destPos.x, destPos.y);
    ctx.stroke();

    // Disegna un cerchio alla destinazione
    ctx.fillStyle = '#0066cc';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(destPos.x, destPos.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ripristina lo stato del contesto
    ctx.restore();
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
   * Cancella la destinazione della minimappa (chiamato quando il movimento finisce)
   */
  clearDestination(): void {
    this.destinationX = null;
    this.destinationY = null;
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
