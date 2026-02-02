import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { Transform } from '../../entities/spatial/Transform';
import { Npc } from '../../entities/ai/Npc';
import { SelectedNpc } from '../../entities/combat/SelectedNpc';
import { Portal } from '../../entities/spatial/Portal';
import { Minimap } from '../../presentation/ui/Minimap';
import { Camera } from '../../entities/spatial/Camera';
import { CONFIG } from '../../core/utils/config/GameConfig';
import { DisplayManager } from '../../infrastructure/display';
import { PixiRenderer } from '../../infrastructure/rendering/PixiRenderer';
import { Container, Graphics, Sprite, Text, TextStyle, Texture, FederatedPointerEvent, Assets } from 'pixi.js';

/**
 * MinimapSystem - PixiJS based Minimap
 * Renders the minimap using Pixi Graphics/Sprites and handles input via Pixi events
 */
export class MinimapSystem extends BaseSystem {
  private minimap: Minimap;
  private camera: Camera | null = null;

  // PixiJS Components
  private pixiRenderer: PixiRenderer;
  private container: Container;
  private backgroundGraphics: Graphics;
  private backgroundSprite: Sprite;
  private contentGraphics: Graphics; // Lines, dots, dynamic content
  private labelsContainer: Container;
  private mapNameText: Text;
  private coordsTextLeft: Text;
  private coordsTextRight: Text;

  private onMoveToCallback: ((worldX: number, worldY: number) => void) | null = null;
  private destinationX: number | null = null;
  private destinationY: number | null = null;
  private isMouseDownInMinimap: boolean = false;

  // Logic
  private clientNetworkSystem: any = null;
  private fadeStartTime: number | null = null;
  private fadeDuration: number = 600;
  private currentMapId: string;
  private currentMapName: string = '';

  constructor(ecs: any) {
    super(ecs);
    this.pixiRenderer = PixiRenderer.getInstance();
    this.minimap = new Minimap(
      0, 0,
      CONFIG.MINIMAP_WIDTH, CONFIG.MINIMAP_HEIGHT,
      CONFIG.WORLD_WIDTH,
      CONFIG.WORLD_HEIGHT
    );

    this.currentMapId = CONFIG.CURRENT_MAP;
    this.currentMapName = this.currentMapId;

    // Setup Pixi Container
    this.container = new Container();
    this.container.label = 'MinimapContainer';
    this.container.visible = false;

    // Input Handling
    this.container.eventMode = 'static';
    this.container.on('pointerdown', this.onPointerDown.bind(this));
    this.container.on('pointermove', this.onPointerMove.bind(this));
    this.container.on('pointerup', this.onPointerUp.bind(this));
    this.container.on('pointerupoutside', this.onPointerUp.bind(this));

    // Background Layer (Glass effect)
    this.backgroundGraphics = new Graphics();
    this.container.addChild(this.backgroundGraphics);

    // Map Image Layer
    this.backgroundSprite = new Sprite();
    this.backgroundSprite.anchor.set(0, 0);
    this.backgroundSprite.alpha = 0.6;
    this.container.addChild(this.backgroundSprite);

    // Content Layer (Dots, Lines - cleared every frame)
    this.contentGraphics = new Graphics();
    this.container.addChild(this.contentGraphics);

    // Labels Container
    this.labelsContainer = new Container();
    this.container.addChild(this.labelsContainer);

    // Text Elements
    const headerStyle = new TextStyle({
      fontFamily: '"Courier New", monospace',
      fontSize: 14,
      fontWeight: 'bold',
      fill: 'rgba(255, 255, 255, 0.8)',
      dropShadow: {
        color: 'rgba(0, 255, 136, 0.4)',
        blur: 4,
        distance: 0
      }
    });

    this.mapNameText = new Text({ text: '', style: headerStyle });
    this.mapNameText.anchor.set(0.5, 0.5);
    this.labelsContainer.addChild(this.mapNameText);

    const coordsStyle = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 12,
      fill: 'rgba(255, 255, 255, 0.7)'
    });

    this.coordsTextLeft = new Text({ text: '', style: coordsStyle });
    this.labelsContainer.addChild(this.coordsTextLeft);

    this.coordsTextRight = new Text({ text: '', style: coordsStyle });
    this.coordsTextRight.anchor.set(1, 0); // Align right
    this.labelsContainer.addChild(this.coordsTextRight);

    // Attach to UI Container
    this.pixiRenderer.getUIContainer().addChild(this.container);

    // Load Initial Asset
    this.loadMapBackground(this.currentMapId);

    // Resize Hook
    DisplayManager.getInstance().onResize(() => this.handleResize());
    this.handleResize();
  }

  public setClientNetworkSystem(clientNetworkSystem: any): void {
    this.clientNetworkSystem = clientNetworkSystem;
  }

  public updateMapData(mapId: string, width: number, height: number, mapName?: string): void {
    this.currentMapId = mapId;
    this.currentMapName = mapName || mapId;
    this.minimap.updateWorldDimensions(width, height);
    this.loadMapBackground(mapId);
    console.log(`[MinimapSystem] Updated map data for: ${mapId} (${width}x${height})`);
  }

  private async loadMapBackground(mapName: string = 'sol_system'): Promise<void> {
    const mapIdToFolder: Record<string, string> = {
      'palantir': 'palantir',
      'singularity': 'singularity'
    };
    const assetFolder = mapIdToFolder[mapName] || mapName;

    // Try primary
    try {
      const texture = await Assets.load(`assets/maps/${assetFolder}/bg1forse.jpg`);
      this.backgroundSprite.texture = texture;
      this.backgroundSprite.visible = true;
    } catch (e) {
      console.warn(`[MinimapSystem] Failed to load bg for ${mapName}, trying fallback.`);
      try {
        const texture = await Assets.load(`assets/maps/${assetFolder}/bg.jpg`);
        this.backgroundSprite.texture = texture;
        this.backgroundSprite.visible = true;
      } catch (e2) {
        console.warn(`[MinimapSystem] Failed to load fallback bg.`);
        this.backgroundSprite.visible = false;
      }
    }
  }

  setCamera(camera: Camera): void {
    this.camera = camera;
  }

  setMoveToCallback(callback: (worldX: number, worldY: number) => void): void {
    this.onMoveToCallback = callback;
  }

  // --- Input Handling (Pixi Events) ---

  private onPointerDown(e: FederatedPointerEvent): void {
    const screenX = e.global.x;
    const screenY = e.global.y;

    if (this.isClickInGlassBorders(screenX, screenY)) return;

    if (this.minimap.isPointInside(screenX, screenY)) {
      this.isMouseDownInMinimap = true;
      this.updateDestination(screenX, screenY);
      e.stopPropagation(); // Consume event
    }
  }

  private onPointerMove(e: FederatedPointerEvent): void {
    if (!this.isMouseDownInMinimap) return;

    const screenX = e.global.x;
    const screenY = e.global.y;

    if (this.minimap.isPointInside(screenX, screenY)) {
      this.updateDestination(screenX, screenY);
    } else {
      this.isMouseDownInMinimap = false;
    }
  }

  private onPointerUp(e: FederatedPointerEvent): void {
    this.isMouseDownInMinimap = false;
  }

  private updateDestination(screenX: number, screenY: number): void {
    const worldPos = this.minimap.minimapToWorld(screenX, screenY);
    this.destinationX = worldPos.x;
    this.destinationY = worldPos.y;

    if (this.onMoveToCallback) {
      this.onMoveToCallback(worldPos.x, worldPos.y);
    }
  }

  // Legacy hooks (Game loop calls render, which we don't need)
  render(ctx: CanvasRenderingContext2D): void { }
  handleMouseDown(x: number, y: number): boolean { return false; }
  handleMouseMove(x: number, y: number): boolean { return false; }
  handleClick(x: number, y: number): boolean { return false; }
  handleMouseUp(): void { }

  // --- Update Loop ---

  update(deltaTime: number): void {
    if (!this.minimap.visible) {
      this.container.visible = false;
      return;
    }
    this.container.visible = true;

    // Fade In
    if (this.fadeStartTime !== null) {
      const elapsed = Date.now() - this.fadeStartTime;
      if (elapsed < this.fadeDuration) {
        const progress = elapsed / this.fadeDuration;
        this.container.alpha = progress < 1 ? 1 - Math.pow(1 - progress, 3) : 1;
      } else {
        this.container.alpha = 1;
        this.fadeStartTime = null;
      }
    }

    // Draw Frame
    this.drawMinimap();
  }

  private drawMinimap(): void {
    const c = this.minimap.getDprCompensation();
    const { x, y, width, height } = this.minimap;

    // 1. Static Layout (Position Container)

    // Background
    const padding = Math.round(20 * c);
    const headerHeight = Math.round(35 * c);
    const bgX = x - padding;
    const bgY = y - padding - headerHeight;
    const bgW = width + (padding * 2);
    const bgH = height + (padding * 2) + headerHeight;

    const g = this.backgroundGraphics;
    g.clear();

    // Glass Background
    g.rect(bgX, bgY, bgW, bgH);
    g.fill({ color: 0x000000, alpha: 0.5 }); // Simple transparent black for now
    g.stroke({ width: 1, color: 'rgba(255, 255, 255, 0.08)' });

    // Map Sprite
    const s = this.backgroundSprite;
    s.position.set(x, y);
    s.width = width;
    s.height = height;

    // Content Graphics (Dots, Lines)
    const cg = this.contentGraphics;
    cg.clear();

    // Border around map
    cg.rect(x, y, width, height);
    cg.stroke({ width: 1, color: 'rgba(255, 255, 255, 0.15)' });

    // Crosshair
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const crossSize = Math.round(6 * c);

    cg.moveTo(centerX - crossSize, centerY);
    cg.lineTo(centerX + crossSize, centerY);
    cg.moveTo(centerX, centerY - crossSize);
    cg.lineTo(centerX, centerY + crossSize);
    cg.stroke({ width: 1, color: 'rgba(255, 255, 255, 0.6)' });

    // Entities
    if (this.camera) {
      const playerPos = this.minimap.worldToMinimap(this.camera.x, this.camera.y);

      // Reference Lines
      cg.moveTo(playerPos.x, y);
      cg.lineTo(playerPos.x, y + height);
      cg.moveTo(x, playerPos.y);
      cg.lineTo(x + width, playerPos.y);
      cg.stroke({ width: 1, color: 'rgba(255, 255, 255, 0.6)' });

      this.renderEntities(cg);
      this.renderPortals(cg);
      this.renderRemotePlayers(cg);
      this.renderPlayerIndicator(cg, playerPos);
    }

    // Text Labels Update
    this.mapNameText.text = this.currentMapName.toUpperCase();
    this.mapNameText.position.set(bgX + bgW / 2, bgY + headerHeight / 2);
    // Header line
    cg.moveTo(bgX + 10 * c, bgY + headerHeight - 2 * c);
    cg.lineTo(bgX + bgW - 10 * c, bgY + headerHeight - 2 * c);
    cg.stroke({ width: 1, color: 'rgba(255, 255, 255, 0.1)' });

    if (this.camera) {
      const playerX = Math.round(this.camera.x);
      const playerY = Math.round(this.camera.y);
      const textPadding = Math.round(15 * c);
      const headerY = bgY + Math.round(8 * c);

      this.coordsTextLeft.text = `X:${playerX}`;
      this.coordsTextLeft.position.set(bgX + textPadding, headerY + 17 * c);

      this.coordsTextRight.text = `Y:${playerY}`;
      this.coordsTextRight.position.set(bgX + bgW - textPadding, headerY + 17 * c);
    }
  }

  private renderEntities(g: Graphics): void {
    if (!this.camera) return;
    const npcEntities = this.ecs.getEntitiesWithComponents(Npc);
    const selectedNpcs = this.ecs.getEntitiesWithComponents(SelectedNpc);
    const RADAR_RANGE_SQ = 1200 * 1200;

    npcEntities.forEach(entityId => {
      const transform = this.ecs.getComponent(entityId, Transform);
      if (transform) {
        const dx = transform.x - this.camera!.x;
        const dy = transform.y - this.camera!.y;
        if (dx * dx + dy * dy <= RADAR_RANGE_SQ) {
          const isSelected = selectedNpcs.includes(entityId);
          const color = isSelected ? 0xFFFF64 : 0xFF6464; // Yellow / Red
          this.renderEntityDot(g, transform.x, transform.y, color);
        }
      }
    });
  }

  private renderPortals(g: Graphics): void {
    const portalEntities = this.ecs.getEntitiesWithComponents(Portal);
    portalEntities.forEach(entityId => {
      const transform = this.ecs.getComponent(entityId, Transform);
      if (transform) {
        const pos = this.minimap.worldToMinimap(transform.x, transform.y);
        const c = this.minimap.getDprCompensation();
        g.circle(pos.x, pos.y, 6 * c);
        g.stroke({ width: 1, color: 0xFFFFFF });
      }
    });
  }

  private renderRemotePlayers(g: Graphics): void {
    if (!this.clientNetworkSystem || !this.camera) return;
    const system = this.clientNetworkSystem.getRemotePlayerSystem();
    if (!system || system.getRemotePlayerCount() === 0) return;

    const RADAR_RANGE_SQ = 1500 * 1500;
    system.getRemotePlayerPositions().forEach((pos: { x: number, y: number }) => {
      const dx = pos.x - this.camera!.x;
      const dy = pos.y - this.camera!.y;
      if (dx * dx + dy * dy <= RADAR_RANGE_SQ) {
        this.renderEntityDot(g, pos.x, pos.y, 0xFFFF00); // Yellow
      }
    });
  }

  private renderEntityDot(g: Graphics, worldX: number, worldY: number, color: number): void {
    const pos = this.minimap.worldToMinimap(worldX, worldY);
    g.circle(pos.x, pos.y, this.minimap.entityDotSize);
    g.fill(color);
    g.stroke({ width: 1, color: 0xFFFFFF, alpha: 0.8 });
  }

  private renderPlayerIndicator(g: Graphics, pos: { x: number, y: number }): void {
    const c = this.minimap.getDprCompensation();
    // Player Triangle
    g.circle(pos.x, pos.y, 4 * c);
    g.fill(0x0088ff);

    // Destination Line
    if (this.destinationX !== null && this.destinationY !== null) {
      const destPos = this.minimap.worldToMinimap(this.destinationX, this.destinationY);
      g.moveTo(pos.x, pos.y);
      g.lineTo(destPos.x, destPos.y);
      g.stroke({ width: 2 * c, color: 'rgba(255, 255, 255, 0.6)' });

      g.circle(destPos.x, destPos.y, 5 * c);
      g.fill({ color: 0xFFFFFF, alpha: 0.2 });
      g.stroke({ width: 1, color: 'rgba(255, 255, 255, 0.6)' });
    }
  }

  private handleResize(): void {
    const { width, height } = DisplayManager.getInstance().getLogicalSize();
    this.minimap.updateViewport(width, height);
  }

  clearDestination(): void {
    this.destinationX = null;
    this.destinationY = null;
  }

  toggleVisibility(): void { this.minimap.visible ? this.hide() : this.show(); }

  show(): void {
    this.minimap.visible = true;
    this.container.visible = true;
    this.fadeStartTime = Date.now();
  }

  hide(): void {
    this.minimap.visible = false;
    this.container.visible = false;
  }

  getMinimap(): Minimap { return this.minimap; }

  // Logic preservation
  isClickInGlassPanel(screenX: number, screenY: number): boolean {
    // Reuse original logic or adapt
    if (!this.minimap.visible) return false;
    const c = this.minimap.getDprCompensation();
    const padding = Math.round(20 * c);
    const headerHeight = Math.round(35 * c);
    const glassX = this.minimap.x - padding;
    const glassY = this.minimap.y - padding - headerHeight;
    const glassW = this.minimap.width + (padding * 2);
    const glassH = this.minimap.height + (padding * 2) + headerHeight;
    return screenX >= glassX && screenX <= glassX + glassW &&
      screenY >= glassY && screenY <= glassY + glassH;
  }

  private isClickInGlassBorders(screenX: number, screenY: number): boolean {
    if (this.isClickInGlassPanel(screenX, screenY)) {
      return !this.minimap.isPointInside(screenX, screenY);
    }
    return false;
  }
}
