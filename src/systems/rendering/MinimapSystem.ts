import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { Transform } from '../../entities/spatial/Transform';
import { Npc } from '../../entities/ai/Npc';
import { SelectedNpc } from '../../entities/combat/SelectedNpc';
import { Minimap } from '../../presentation/ui/Minimap';
import { Camera } from '../../entities/spatial/Camera';
import { CONFIG } from '../../utils/config/Config';

/**
 * Sistema per gestire la minimappa quadrata
 * Gestisce rendering e interazione click-to-move
 */
export class MinimapSystem extends BaseSystem {
  private minimap: Minimap;
  private camera: Camera | null = null;
  private canvas: HTMLCanvasElement;
  private onMoveToCallback: ((worldX: number, worldY: number) => void) | null = null;
  private destinationX: number | null = null;
  private destinationY: number | null = null;
  private isMouseDownInMinimap: boolean = false;
  private mapBackgroundImage: HTMLImageElement | null = null;
  private clientNetworkSystem: any = null;

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

    // Carica l'immagine di sfondo della mappa
    this.loadMapBackground('maps1/1');

    // Ascolta eventi di resize finestra
    window.addEventListener('resize', () => this.handleResize());
    this.handleResize(); // Imposta posizione iniziale
  }

  /**
   * Imposta il riferimento al ClientNetworkSystem per il rendering dei giocatori remoti
   */
  public setClientNetworkSystem(clientNetworkSystem: any): void {
    this.clientNetworkSystem = clientNetworkSystem;
  }

  /**
   * Carica l'immagine di sfondo della mappa
   */
  private loadMapBackground(mapName: string = 'sol_system'): void {
    this.mapBackgroundImage = new Image();
    this.mapBackgroundImage.src = `/assets/maps/${mapName}/bg.jpg`;

    // Gestione errori di caricamento
    this.mapBackgroundImage.onerror = () => {
      this.mapBackgroundImage = null;
    };
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

    // PRIMA controlla se il click è nei bordi glass - se sì, ignora completamente
    if (this.isClickInGlassBorders(screenX, screenY)) {
      return false; // Click nei bordi glass - non gestito dalla minimappa
    }

    // POI controlla se il click è nell'area effettiva della minimappa
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

    // Trova la posizione del player per le linee di riferimento
    let playerPos: { x: number, y: number } | null = null;
    if (this.camera) {
      const worldPos = this.minimap.worldToMinimap(this.camera.x, this.camera.y);
      playerPos = worldPos;
    }

    this.renderMinimapBackground(ctx, playerPos);
    this.renderEntities(ctx);
    this.renderRemotePlayers(ctx);
    this.renderPlayerIndicator(ctx);
  }

  /**
   * Renderizza lo sfondo della minimappa
   */
  private renderMinimapBackground(ctx: CanvasRenderingContext2D, playerPos: { x: number, y: number } | null = null): void {
    // Salva stato del contesto
    ctx.save();

    const x = this.minimap.x;
    const y = this.minimap.y;
    const w = this.minimap.width;
    const h = this.minimap.height;

    // Padding per il riquadro di sfondo glass
    const padding = 20;
    const headerHeight = 35; // Spazio per header con icona e titolo
    const bgX = x - padding;
    const bgY = y - padding - headerHeight;
    const bgW = w + (padding * 2);
    const bgH = h + (padding * 2) + headerHeight;

    // Ombra del pannello per effetto profondità
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 5;

    // Sfondo glass principale con gradiente
    const glassGradient = ctx.createLinearGradient(bgX, bgY, bgX, bgY + bgH);
    glassGradient.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
    glassGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
    glassGradient.addColorStop(1, 'rgba(255, 255, 255, 0.06)');
    ctx.fillStyle = glassGradient;

    // Arrotondamento degli angoli come gli altri pannelli
    this.roundedRect(ctx, bgX, bgY, bgW, bgH, 15);
    ctx.fill();

    // Reset ombra per il bordo
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Bordo glass sottile intorno al riquadro
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    this.roundedRect(ctx, bgX, bgY, bgW, bgH, 15);
    ctx.stroke();

    // Sfondo della minimappa con immagine della mappa o gradiente di fallback
    if (this.mapBackgroundImage && this.mapBackgroundImage.complete && this.mapBackgroundImage.naturalWidth > 0) {
      // Usa l'immagine della mappa come sfondo
      ctx.globalAlpha = 0.6; // Leggermente trasparente per non interferire con gli elementi
      ctx.drawImage(this.mapBackgroundImage, x, y, w, h);
      ctx.globalAlpha = 1.0; // Reset trasparenza
    } else {
      // Fallback: gradiente scuro se l'immagine non è caricata
      const minimapBgGradient = ctx.createLinearGradient(x, y, x, y + h);
      minimapBgGradient.addColorStop(0, 'rgba(0, 10, 20, 0.9)');
      minimapBgGradient.addColorStop(0.5, 'rgba(0, 20, 40, 0.85)');
      minimapBgGradient.addColorStop(1, 'rgba(0, 5, 15, 0.9)');
      ctx.fillStyle = minimapBgGradient;
      ctx.fillRect(x, y, w, h);
    }

    // Bordo interno sottile per la minimappa
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    // Indicatore centro mondo con glow
    const centerX = x + w / 2;
    const centerY = y + h / 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.moveTo(centerX - 6, centerY);
    ctx.lineTo(centerX + 6, centerY);
    ctx.moveTo(centerX, centerY - 6);
    ctx.lineTo(centerX, centerY + 6);
    ctx.stroke();

    // Header del pannello glass con titolo centrato
    const headerY = bgY + 8;

    // Coordinate X a sinistra del titolo
    if (this.camera) {
      const playerX = Math.round(this.camera.x);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`X:${playerX}`, bgX + 15, headerY + 17);
    }

    // Titolo "MINIMAP" centrato (grigio chiaro)
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 1;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('MINIMAP', bgX + bgW / 2, headerY + 18);

    // Coordinate Y a destra del titolo
    if (this.camera) {
      const playerY = Math.round(this.camera.y);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '12px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(`Y:${playerY}`, bgX + bgW - 15, headerY + 17);
    }

    // Separatore sottile sotto l'header
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bgX + 10, bgY + headerHeight - 2);
    ctx.lineTo(bgX + bgW - 10, bgY + headerHeight - 2);
    ctx.stroke();

    // Aggiungi linee di riferimento che attraversano tutta la minimappa
    if (playerPos) {
      this.renderPlayerReferenceLines(ctx, playerPos.x, playerPos.y);
    }

    // Ripristina stato del contesto
    ctx.restore();
  }

  /**
   * Renderizza linee di riferimento che attraversano tutta la minimappa per il player
   */
  private renderPlayerReferenceLines(ctx: CanvasRenderingContext2D, playerX: number, playerY: number): void {
    const x = this.minimap.x;
    const y = this.minimap.y;
    const w = this.minimap.width;
    const h = this.minimap.height;

    // Linee di riferimento continue più visibili
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]); // Linea continua

    // Linea verticale che passa per il player
    ctx.beginPath();
    ctx.moveTo(playerX, y);
    ctx.lineTo(playerX, y + h);
    ctx.stroke();

    // Linea orizzontale che passa per il player
    ctx.beginPath();
    ctx.moveTo(x, playerY);
    ctx.lineTo(x + w, playerY);
    ctx.stroke();
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
   * Renderizza i giocatori remoti sulla minimappa
   */
  private renderRemotePlayers(ctx: CanvasRenderingContext2D): void {
    if (!this.clientNetworkSystem) {
      console.log('❌ [MINIMAP] No clientNetworkSystem');
      return;
    }

    const remotePlayerSystem = this.clientNetworkSystem.getRemotePlayerSystem();
    if (!remotePlayerSystem) {
      console.log('❌ [MINIMAP] No remotePlayerSystem');
      return;
    }

    // Ottieni le posizioni di tutti i giocatori remoti
    const remotePlayerPositions = remotePlayerSystem.getRemotePlayerPositions();

    if (remotePlayerPositions.length > 0) {
      console.log(`🎨 [MINIMAP] Rendering ${remotePlayerPositions.length} remote players`);
    }

    // Renderizza ogni giocatore remoto come pallino giallo
    remotePlayerPositions.forEach((position: {x: number, y: number}, index: number) => {
      console.log(`🟡 [MINIMAP] Rendering remote player ${index} at (${position.x.toFixed(1)}, ${position.y.toFixed(1)})`);
      this.renderEntityDot(ctx, position.x, position.y, '#FFFF00'); // Giallo per giocatori remoti
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

    // Salva stato
    ctx.save();

    // Glow effect glass per gli NPC
    ctx.shadowColor = color.replace('0.8)', '0.6)'); // Riduce l'opacità del glow
    ctx.shadowBlur = 3;

    // Cerchio principale
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, this.minimap.entityDotSize, 0, Math.PI * 2);
    ctx.fill();

    // Bordino bianco con glow ridotto
    ctx.shadowBlur = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Ripristina stato
    ctx.restore();
  }

  /**
   * Renderizza una linea dalla posizione del player alla destinazione
   */
  private renderDestinationLine(ctx: CanvasRenderingContext2D, playerX: number, playerY: number, destX: number, destY: number): void {
    const playerPos = this.minimap.worldToMinimap(playerX, playerY);
    const destPos = this.minimap.worldToMinimap(destX, destY);

    // Salva lo stato del contesto
    ctx.save();

    // Linea con glow effect glass
    ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
    ctx.shadowBlur = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.setLineDash([]); // Linea continua

    // Disegna la linea
    ctx.beginPath();
    ctx.moveTo(playerPos.x, playerPos.y);
    ctx.lineTo(destPos.x, destPos.y);
    ctx.stroke();

    // Cerchio alla destinazione con glow glass
    ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(destPos.x, destPos.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Centro del cerchio glass
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(destPos.x, destPos.y, 2, 0, Math.PI * 2);
    ctx.fill();

    // Ripristina lo stato del contesto
    ctx.restore();
  }

  /**
   * Renderizza il player come semplice pallino blu
   */
  private renderPlayerTriangle(ctx: CanvasRenderingContext2D, worldX: number, worldY: number): void {
    const pos = this.minimap.worldToMinimap(worldX, worldY);
    const radius = 4;

    // Salva stato
    ctx.save();

    // Semplice pallino blu con glow sottile
    ctx.shadowColor = '#0088ff';
    ctx.shadowBlur = 4;

    ctx.fillStyle = '#0088ff';

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.fill();

    // Ripristina stato
    ctx.restore();
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

  /**
   * Verifica se un click è in qualsiasi parte del pannello glass della minimappa
   */
  isClickInGlassPanel(screenX: number, screenY: number): boolean {
    if (!this.minimap.visible) return false;

    const x = this.minimap.x;
    const y = this.minimap.y;
    const w = this.minimap.width;
    const h = this.minimap.height;

    // Padding del pannello glass
    const padding = 20;
    const headerHeight = 35;

    // Coordinate del pannello glass completo
    const glassX = x - padding;
    const glassY = y - padding - headerHeight;
    const glassW = w + (padding * 2);
    const glassH = h + (padding * 2) + headerHeight;

    // Il click è nel pannello glass completo?
    return screenX >= glassX && screenX <= glassX + glassW &&
           screenY >= glassY && screenY <= glassY + glassH;
  }

  /**
   * Verifica se un click è nei bordi glass del pannello (da ignorare per movimento nave)
   */
  private isClickInGlassBorders(screenX: number, screenY: number): boolean {
    const x = this.minimap.x;
    const y = this.minimap.y;
    const w = this.minimap.width;
    const h = this.minimap.height;

    // Padding del pannello glass
    const padding = 20;
    const headerHeight = 35;

    // Coordinate del pannello glass completo
    const glassX = x - padding;
    const glassY = y - padding - headerHeight;
    const glassW = w + (padding * 2);
    const glassH = h + (padding * 2) + headerHeight;

    // Il click è nel pannello glass?
    if (screenX >= glassX && screenX <= glassX + glassW &&
        screenY >= glassY && screenY <= glassY + glassH) {
      // Sì, ma è nell'area effettiva della minimappa?
      return !this.minimap.isPointInside(screenX, screenY);
    }

    // Click completamente fuori dal pannello glass
    return false;
  }

  /**
   * Disegna un rettangolo con angoli arrotondati
   */
  private roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}
