import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { ChatText } from '../../entities/combat/ChatText';
import { Transform } from '../../entities/spatial/Transform';
import { DisplayManager } from '../../infrastructure/display';
import { PixiRenderer } from '../../infrastructure/rendering/PixiRenderer';
import { Container, Graphics, Text, TextStyle } from 'pixi.js';

/**
 * ChatTextSystem - PixiJS Version
 * Renderizza i testi dei messaggi di chat usando PixiJS
 */
export class ChatTextSystem extends BaseSystem {
  private cameraSystem: any = null;
  private pixiInitialized: boolean = false;

  // PixiJS elements
  private chatContainer: Container;
  private chatBubbles: Map<number, Container> = new Map(); // entityId -> bubble container

  constructor(ecs: ECS, cameraSystem?: any) {
    super(ecs);
    this.cameraSystem = cameraSystem || this.findCameraSystem();
    this.chatContainer = new Container();
    this.chatContainer.label = 'ChatBubbles';
  }

  private findCameraSystem(): any {
    if (this.ecs && (this.ecs as any).systems) {
      return (this.ecs as any).systems.find((system: any) => typeof system.getCamera === 'function');
    }
    return null;
  }

  /**
   * Inizializza PixiJS container (lazy)
   */
  private initPixi(): void {
    if (this.pixiInitialized) return;

    try {
      const pixiRenderer = PixiRenderer.getInstance();
      // Chat bubbles vanno nel world container (seguono la camera)
      const worldContainer = pixiRenderer.getWorldContainer();
      worldContainer.addChild(this.chatContainer);
      this.chatContainer.zIndex = 500; // Sopra entità, sotto UI
      this.pixiInitialized = true;
    } catch (e) {
      // PixiRenderer non ancora pronto
    }
  }

  private cleanupChatText(chatTextEntity: any): void {
    this.ecs.removeEntity(chatTextEntity);
  }

  /**
   * Crea un bubble container con sfondo glass e testo
   */
  private createChatBubble(message: string): Container {
    const bubble = new Container();

    // Stile testo
    const textStyle = new TextStyle({
      fontFamily: 'Arial',
      fontSize: 18,
      fontWeight: 'bold',
      fill: 'rgba(255, 255, 255, 0.95)',
      dropShadow: {
        color: 'rgba(0, 0, 0, 0.3)',
        blur: 1,
        distance: 1,
        angle: Math.PI / 4,
      },
    });

    const text = new Text({ text: message, style: textStyle });
    text.anchor.set(0.5, 0.5);

    // Calcola dimensioni sfondo
    const padding = 10;
    const rectWidth = text.width + padding * 2;
    const rectHeight = 24 + padding * 2;

    // Sfondo glass
    const bg = new Graphics();

    // Rettangolo semi-trasparente
    bg.rect(-rectWidth / 2, -rectHeight / 2, rectWidth, rectHeight);
    bg.fill({ color: 0x0f172a, alpha: 0.9 }); // Blu scuro

    // Bordo gradiente (simula con colore solido per performance)
    bg.rect(-rectWidth / 2, -rectHeight / 2, rectWidth, rectHeight);
    bg.stroke({ color: 0x3b82f6, alpha: 0.6, width: 1 }); // Blu

    // Effetto luce interna
    bg.rect(-rectWidth / 2 + 1, -rectHeight / 2 + 1, rectWidth - 2, rectHeight - 2);
    bg.stroke({ color: 0xffffff, alpha: 0.1, width: 1 });

    bubble.addChild(bg);
    bubble.addChild(text);

    return bubble;
  }

  update(deltaTime: number): void {
    this.initPixi();

    // Trova camera se non già trovata
    if (!this.cameraSystem) {
      this.cameraSystem = this.findCameraSystem();
    }

    const chatTextEntities = this.ecs.getEntitiesWithComponents(ChatText);

    // Aggiorna lifetime e rimuovi scaduti
    for (const entity of chatTextEntities) {
      const chatText = this.ecs.getComponent(entity, ChatText);
      if (!chatText) continue;

      chatText.currentOffsetY = chatText.initialOffsetY;
      chatText.lifetime -= deltaTime;

      if (chatText.isExpired()) {
        this.cleanupChatText(entity);
      }
    }

    if (!this.pixiInitialized || !this.cameraSystem) return;

    const camera = this.cameraSystem.getCamera();
    if (!camera) return;

    const canvasSize = DisplayManager.getInstance().getLogicalSize();

    // Aggiorna bubble visivi
    const validEntities = this.ecs.getEntitiesWithComponents(ChatText);
    const validIds = new Set<number>();

    for (const entity of validEntities) {
      const entityId = typeof entity === 'number' ? entity : (entity as any).id;
      validIds.add(entityId);

      const chatText = this.ecs.getComponent(entity, ChatText);
      if (!chatText) continue;

      // Calcola posizione mondo
      let worldX: number;
      let worldY: number;

      const targetEntity = this.ecs.getEntity(chatText.targetEntityId);

      if (targetEntity) {
        const targetTransform = this.ecs.getComponent(targetEntity, Transform);
        if (targetTransform) {
          worldX = targetTransform.x + chatText.initialOffsetX;
          worldY = targetTransform.y + chatText.currentOffsetY;
          chatText.lastWorldX = worldX;
          chatText.lastWorldY = worldY;
        } else {
          worldX = chatText.lastWorldX;
          worldY = chatText.lastWorldY;
        }
      } else {
        worldX = chatText.lastWorldX;
        worldY = chatText.lastWorldY;
      }

      // Converti in coordinate schermo
      const screenPos = camera.worldToScreen(worldX, worldY, canvasSize.width, canvasSize.height);

      // Crea o aggiorna bubble
      let bubble = this.chatBubbles.get(entityId);

      if (!bubble) {
        bubble = this.createChatBubble(chatText.message);
        this.chatContainer.addChild(bubble);
        this.chatBubbles.set(entityId, bubble);
      }

      // Aggiorna posizione e alpha
      bubble.position.set(screenPos.x, screenPos.y);
      bubble.alpha = chatText.getAlpha();
    }

    // Rimuovi bubble per entità non più esistenti
    for (const [entityId, bubble] of this.chatBubbles) {
      if (!validIds.has(entityId)) {
        bubble.destroy({ children: true });
        this.chatBubbles.delete(entityId);
      }
    }
  }

  /**
   * Cleanup risorse PixiJS
   */
  destroy(): void {
    for (const bubble of this.chatBubbles.values()) {
      bubble.destroy({ children: true });
    }
    this.chatBubbles.clear();
    if (this.chatContainer) {
      this.chatContainer.destroy({ children: true });
    }
  }
}
