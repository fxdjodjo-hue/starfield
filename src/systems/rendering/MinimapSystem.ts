import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { Transform } from '../../entities/spatial/Transform';
import { Npc } from '../../entities/ai/Npc';
import { SelectedNpc } from '../../entities/combat/SelectedNpc';
import { Portal } from '../../entities/spatial/Portal';
import { Minimap } from '../../presentation/ui/Minimap';
import { Camera } from '../../entities/spatial/Camera';
import { CONFIG } from '../../core/utils/config/GameConfig';
import { DisplayManager } from '../../infrastructure/display';

/**
 * MinimapSystem - Sistema ECS per rendering minimappa e navigazione
 * Responsabilità: Rendering entità su minimappa quadrata, gestione click-to-move,
 * sincronizzazione camera, evidenziazione entità selezionate
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
  private fadeStartTime: number | null = null;
  private fadeDuration: number = 600; // millisecondi, sincronizzato con altri elementi UI

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
    this.loadMapBackground(CONFIG.CURRENT_MAP);

    // Usa DisplayManager per gestire il resize in modo centralizzato
    DisplayManager.getInstance().onResize(() => this.handleResize());
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
    // Usa percorsi assoluti dal root per maggiore robustezza
    const primaryPath = `assets/maps/${mapName}/bg1forse.jpg`;
    const fallbackPath = `assets/maps/${mapName}/bg.jpg`;

    this.mapBackgroundImage = new Image();

    // Gestione errori di caricamento - fallback a bg.jpg
    this.mapBackgroundImage.onerror = () => {
      // Se era già il fallback, allora non c'è altro da provare
      if (this.mapBackgroundImage && this.mapBackgroundImage.src.endsWith('bg.jpg')) {
        this.mapBackgroundImage = null;
        console.warn(`[MinimapSystem] Failed to load background image for map: ${mapName}`);
        return;
      }

      console.log(`[MinimapSystem] Trying fallback background for map: ${mapName}`);
      this.mapBackgroundImage = new Image();
      this.mapBackgroundImage.src = fallbackPath;
      this.mapBackgroundImage.onerror = () => {
        this.mapBackgroundImage = null;
        console.warn(`[MinimapSystem] Failed to load fallback background image for map: ${mapName}`);
      };
    };

    // Tenta il caricamento primario
    this.mapBackgroundImage.src = primaryPath;
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

    // Calcola opacità per fade-in sincronizzato
    let opacity = 1;
    if (this.fadeStartTime !== null) {
      const elapsed = Date.now() - this.fadeStartTime;
      if (elapsed < this.fadeDuration) {
        // Easing cubic-bezier(0.4, 0, 0.2, 1) approssimato
        const progress = elapsed / this.fadeDuration;
        const easedProgress = progress < 1 ? 1 - Math.pow(1 - progress, 3) : 1;
        opacity = easedProgress;
      } else {
        this.fadeStartTime = null; // Fade completato
      }
    }

    // Applica opacità al rendering
    ctx.save();
    ctx.globalAlpha = opacity;

    // Trova la posizione del player per le linee di riferimento
    let playerPos: { x: number, y: number } | null = null;
    if (this.camera) {
      const worldPos = this.minimap.worldToMinimap(this.camera.x, this.camera.y);
      playerPos = worldPos;
    }

    this.renderMinimapBackground(ctx, playerPos);
    this.renderEntities(ctx);
    this.renderPortals(ctx);
    this.renderRemotePlayers(ctx);
    this.renderPlayerIndicator(ctx);

    ctx.restore();
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

    // Compensazione DPR dalla minimap
    const c = this.minimap.getDprCompensation();

    // Padding per il riquadro di sfondo glass (compensato)
    const padding = Math.round(20 * c);
    const headerHeight = Math.round(35 * c); // Spazio per header con icona e titolo
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

    // Arrotondamento degli angoli come gli altri pannelli (compensato)
    this.roundedRect(ctx, bgX, bgY, bgW, bgH, Math.round(15 * c));
    ctx.fill();

    // Reset ombra per il bordo
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Bordo glass sottile intorno al riquadro
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    this.roundedRect(ctx, bgX, bgY, bgW, bgH, Math.round(15 * c));
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

    // Renderizza il nome della mappa sopra la minimappa nel pannello glass
    this.renderMapName(ctx, bgX, bgY, bgW, headerHeight);

    // Indicatore centro mondo con glow (dimensioni compensate)
    const centerX = x + w / 2;
    const centerY = y + h / 2;
    const crossSize = Math.round(6 * c);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
    ctx.shadowBlur = Math.round(3 * c);
    ctx.beginPath();
    ctx.moveTo(centerX - crossSize, centerY);
    ctx.lineTo(centerX + crossSize, centerY);
    ctx.moveTo(centerX, centerY - crossSize);
    ctx.lineTo(centerX, centerY + crossSize);
    ctx.stroke();

    // Coordinate del player nell'header
    const headerY = bgY + Math.round(8 * c);
    const fontSize = Math.round(12 * c);
    const textPadding = Math.round(15 * c);

    if (this.camera) {
      const playerX = Math.round(this.camera.x);
      const playerY = Math.round(this.camera.y);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = `${fontSize}px Arial`;
      ctx.textAlign = 'left';
      ctx.fillText(`X:${playerX}`, bgX + textPadding, headerY + Math.round(17 * c));

      ctx.textAlign = 'right';
      ctx.fillText(`Y:${playerY}`, bgX + bgW - textPadding, headerY + Math.round(17 * c));
    }

    // Separatore sottile sotto l'header
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bgX + Math.round(10 * c), bgY + headerHeight - Math.round(2 * c));
    ctx.lineTo(bgX + bgW - Math.round(10 * c), bgY + headerHeight - Math.round(2 * c));
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
    if (!this.camera) return;

    // Renderizza NPC
    const npcEntities = this.ecs.getEntitiesWithComponents(Npc);
    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);

    // Distanza massima di visibilità radar (3000 unità)
    const RADAR_RANGE = 3000;
    const RADAR_RANGE_SQ = RADAR_RANGE * RADAR_RANGE;

    npcEntities.forEach(entityId => {
      const transform = this.ecs.getComponent(entityId, Transform);
      if (transform) {
        // Calcola distanza al quadrato per evitare sqrt costosa
        const dx = transform.x - this.camera!.x;
        const dy = transform.y - this.camera!.y;
        const distSq = dx * dx + dy * dy;

        // Renderizza solo se entro il raggio radar
        if (distSq <= RADAR_RANGE_SQ) {
          const isSelected = selectedNpcs.includes(entityId);
          const color = isSelected ? this.minimap.selectedNpcColor : this.minimap.npcColor;
          this.renderEntityDot(ctx, transform.x, transform.y, color);
        }
      }
    });
  }

  /**
   * Renderizza i portali sulla minimappa come cerchi bianchi
   */
  private renderPortals(ctx: CanvasRenderingContext2D): void {
    const portalEntities = this.ecs.getEntitiesWithComponents(Portal);

    portalEntities.forEach(entityId => {
      const transform = this.ecs.getComponent(entityId, Transform);
      if (transform) {
        this.renderPortalDot(ctx, transform.x, transform.y);
      }
    });
  }

  /**
   * Renderizza i giocatori remoti sulla minimappa
   */
  private renderRemotePlayers(ctx: CanvasRenderingContext2D): void {
    if (!this.clientNetworkSystem || !this.camera) {
      return;
    }

    const remotePlayerSystem = this.clientNetworkSystem.getRemotePlayerSystem();
    if (!remotePlayerSystem) {
      return;
    }

    // Verifica se ci sono giocatori remoti prima di ottenere le posizioni
    const remotePlayerCount = remotePlayerSystem.getRemotePlayerCount();
    if (remotePlayerCount === 0) {
      return; // Nessun giocatore remoto da renderizzare
    }

    // Ottieni le posizioni di tutti i giocatori remoti
    const remotePlayerPositions = remotePlayerSystem.getRemotePlayerPositions();

    // Distanza massima di visibilità radar (3000 unità) - deve matchare renderEntities
    const RADAR_RANGE = 3000;
    const RADAR_RANGE_SQ = RADAR_RANGE * RADAR_RANGE;

    // Renderizza ogni giocatore remoto come pallino giallo
    remotePlayerPositions.forEach((position: { x: number, y: number }) => {
      // Calcola distanza al quadrato
      const dx = position.x - this.camera!.x;
      const dy = position.y - this.camera!.y;
      const distSq = dx * dx + dy * dy;

      // Renderizza solo se entro il raggio radar
      if (distSq <= RADAR_RANGE_SQ) {
        this.renderEntityDot(ctx, position.x, position.y, '#FFFF00'); // Giallo per giocatori remoti
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
   * Renderizza un portale come cerchio bianco vuoto
   */
  private renderPortalDot(ctx: CanvasRenderingContext2D, worldX: number, worldY: number): void {
    const pos = this.minimap.worldToMinimap(worldX, worldY);
    const c = this.minimap.getDprCompensation();
    const radius = Math.round(6 * c);

    // Salva stato
    ctx.save();

    // Cerchio bianco vuoto (solo contorno)
    ctx.strokeStyle = 'rgba(255, 255, 255, 1.0)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
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
    const c = this.minimap.getDprCompensation();

    // Salva lo stato del contesto
    ctx.save();

    // Linea con glow effect glass
    ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
    ctx.shadowBlur = Math.round(4 * c);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = Math.round(2 * c);
    ctx.lineCap = 'round';
    ctx.setLineDash([]); // Linea continua

    // Disegna la linea
    ctx.beginPath();
    ctx.moveTo(playerPos.x, playerPos.y);
    ctx.lineTo(destPos.x, destPos.y);
    ctx.stroke();

    // Cerchio alla destinazione con glow glass
    ctx.shadowColor = 'rgba(255, 255, 255, 0.4)';
    ctx.shadowBlur = Math.round(6 * c);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(destPos.x, destPos.y, Math.round(5 * c), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Centro del cerchio glass
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(destPos.x, destPos.y, Math.round(2 * c), 0, Math.PI * 2);
    ctx.fill();

    // Ripristina lo stato del contesto
    ctx.restore();
  }

  /**
   * Renderizza il player come semplice pallino blu
   */
  private renderPlayerTriangle(ctx: CanvasRenderingContext2D, worldX: number, worldY: number): void {
    const pos = this.minimap.worldToMinimap(worldX, worldY);
    const c = this.minimap.getDprCompensation();
    const radius = Math.round(4 * c);

    // Salva stato
    ctx.save();

    // Semplice pallino blu con glow sottile
    ctx.shadowColor = '#0088ff';
    ctx.shadowBlur = Math.round(4 * c);

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
    const { width, height } = DisplayManager.getInstance().getLogicalSize();
    this.minimap.updateViewport(width, height);
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
   * Mostra la minimappa
   */
  show(): void {
    this.minimap.visible = true;
    this.fadeStartTime = Date.now();
  }

  /**
   * Nasconde la minimappa
   */
  hide(): void {
    this.minimap.visible = false;
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

    // Compensazione DPR
    const c = this.minimap.getDprCompensation();

    // Padding del pannello glass (compensato)
    const padding = Math.round(20 * c);
    const headerHeight = Math.round(35 * c);

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

    // Compensazione DPR
    const c = this.minimap.getDprCompensation();

    // Padding del pannello glass (compensato)
    const padding = Math.round(20 * c);
    const headerHeight = Math.round(35 * c);

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
   * Renderizza il nome della mappa sopra la minimappa nel pannello glass
   */
  private renderMapName(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
    // Formatta il nome della mappa (tutto maiuscolo)
    const mapName = CONFIG.CURRENT_MAP.toUpperCase();

    // Compensazione DPR
    const c = this.minimap.getDprCompensation();
    const fontSize = Math.round(14 * c);

    // Configura il font e lo stile del testo
    ctx.font = `bold ${fontSize}px "Courier New", monospace`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Aggiungi un leggero glow al testo
    ctx.shadowColor = 'rgba(0, 255, 136, 0.4)'; // Colore cyan/verde del tema, leggermente più tenue
    ctx.shadowBlur = Math.round(4 * c);

    // Posiziona il testo al centro sopra la minimappa
    const textX = x + width / 2;
    const textY = y + height / 2;

    // Renderizza il testo
    ctx.fillText(mapName, textX, textY);

    // Reset dello shadow per non influenzare altri elementi
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
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
