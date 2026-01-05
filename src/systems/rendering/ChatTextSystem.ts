import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { ChatText } from '../../entities/combat/ChatText';
import { Transform } from '../../entities/spatial/Transform';

/**
 * Sistema per il rendering dei testi dei messaggi di chat
 */
export class ChatTextSystem extends BaseSystem {
  private cameraSystem: any = null; // Cache del sistema camera

  constructor(ecs: ECS, cameraSystem?: any) {
    super(ecs);
    // Usa il cameraSystem passato o cercalo
    this.cameraSystem = cameraSystem || this.findCameraSystem();
  }

  /**
   * Trova il sistema camera
   */
  private findCameraSystem(): any {
    // Cerca nei sistemi registrati
    if (this.ecs && (this.ecs as any).systems) {
      return (this.ecs as any).systems.find((system: any) => system.constructor?.name === 'CameraSystem');
    }
    return null;
  }

  /**
   * Rimuove un testo di chat quando scade naturalmente
   */
  private cleanupChatText(chatTextEntity: any): void {
    this.ecs.removeEntity(chatTextEntity);
  }

  /**
   * Aggiorna i testi di chat (lifetime e movimento)
   */
  update(deltaTime: number): void {
    const deltaTimeSeconds = deltaTime / 1000; // Converti in secondi

    // Trova tutte le entità con ChatText
    const chatTextEntities = this.ecs.getEntitiesWithComponents(ChatText);

    for (const entity of chatTextEntities) {
      const chatText = this.ecs.getComponent(entity, ChatText);
      if (!chatText) continue;

      // Il testo appare immediatamente e rimane fisso sopra la barra HP/shield
      chatText.currentOffsetY = chatText.initialOffsetY;

      // Aggiorna lifetime (2.5 secondi totali)
      chatText.lifetime -= deltaTime;

      // Rimuovi testi scaduti
      if (chatText.isExpired()) {
        this.cleanupChatText(entity);
      }
    }
  }

  /**
   * Renderizza i testi dei messaggi di chat
   */
  render(ctx: CanvasRenderingContext2D): void {
    if (!ctx.canvas || !this.cameraSystem) {
      return; // Silenziosamente senza log per evitare spam
    }

    const camera = this.cameraSystem.getCamera();
    if (!camera) return;

    const canvasSize = { width: ctx.canvas.width, height: ctx.canvas.height };
    const chatTextEntities = this.ecs.getEntitiesWithComponents(ChatText);


    for (const entity of chatTextEntities) {
      const chatText = this.ecs.getComponent(entity, ChatText);
      if (!chatText) continue;

      let worldX: number;
      let worldY: number;

      const targetEntity = this.ecs.getEntity(chatText.targetEntityId);

      if (targetEntity) {
        // L'entità target esiste ancora - seguila
        const targetTransform = this.ecs.getComponent(targetEntity, Transform);
        if (targetTransform) {
          worldX = targetTransform.x + chatText.initialOffsetX;
          worldY = targetTransform.y + chatText.currentOffsetY;
          // Salva la posizione per quando l'entità muore
          chatText.lastWorldX = worldX;
          chatText.lastWorldY = worldY;
        } else {
          // Entità senza transform - usa ultima posizione conosciuta
          worldX = chatText.lastWorldX;
          worldY = chatText.lastWorldY;
        }
      } else {
        // Entità morta - usa ultima posizione e lascia il testo lì
        worldX = chatText.lastWorldX;
        worldY = chatText.lastWorldY;
      }

      const screenPos = camera.worldToScreen(worldX, worldY, canvasSize.width, canvasSize.height);

      ctx.save();
      ctx.globalAlpha = chatText.getAlpha();

      // Misura il testo per creare il rettangolo di sfondo
      ctx.font = 'bold 18px Arial';
      const textMetrics = ctx.measureText(chatText.message);
      const textWidth = textMetrics.width;
      const textHeight = 24; // Altezza approssimativa del testo
      const padding = 10;
      const rectX = screenPos.x - textWidth/2 - padding;
      const rectY = screenPos.y - textHeight/2 - padding;
      const rectWidth = textWidth + padding * 2;
      const rectHeight = textHeight + padding * 2;

      // Stile glass: sfondo semi-trasparente con blur simulato
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; // Blu scuro semi-trasparente
      ctx.fillRect(rectX, rectY, rectWidth, rectHeight);

      // Bordo glass con gradiente
      const gradient = ctx.createLinearGradient(rectX, rectY, rectX + rectWidth, rectY + rectHeight);
      gradient.addColorStop(0, 'rgba(59, 130, 246, 0.6)'); // Blu chiaro
      gradient.addColorStop(0.5, 'rgba(147, 51, 234, 0.4)'); // Viola
      gradient.addColorStop(1, 'rgba(59, 130, 246, 0.6)'); // Blu chiaro

      ctx.strokeStyle = gradient;
      ctx.lineWidth = 1;
      ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);

      // Effetto luce interna (simula il glass)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(rectX + 1, rectY + 1, rectWidth - 2, rectHeight - 2);

      // Testo bianco con leggera ombra
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 1;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      ctx.fillText(chatText.message, screenPos.x, screenPos.y);
      ctx.restore();
    }
  }
}
