import type { World } from '../../../../infrastructure/engine/World';
import type { GameContext } from '../../../../infrastructure/engine/GameContext';
import type { GameInitializationSystem } from '../../../../systems/game/GameInitializationSystem';
import type { UiSystem } from '../../../../systems/ui/UiSystem';
import type { RemotePlayerSystem } from '../../../../systems/multiplayer/RemotePlayerSystem';
import type { Entity } from '../../../../infrastructure/ecs/Entity';
import { Transform } from '../../../../entities/spatial/Transform';
import { InterpolationTarget } from '../../../../entities/spatial/InterpolationTarget';
import { Sprite } from '../../../../entities/Sprite';
import { AnimatedSprite } from '../../../../entities/AnimatedSprite';
import { Npc } from '../../../../entities/ai/Npc';
import { Authority, AuthorityLevel } from '../../../../entities/spatial/Authority';
import { PlayerRole } from '../../../../entities/player/PlayerRole';
import { Health } from '../../../../entities/combat/Health';
import { PixiRenderSystem } from '../../../../systems/rendering/PixiRenderSystem';

/**
 * Manages PlayState resources: nicknames, entities, cleanup
 */
export class PlayStateResourceManager {
  private nicknameCreated: boolean = false;
  private remotePlayerSpriteUpdated: boolean = false;
  private lastDisplayedRank: string = 'Basic Space Pilot';

  constructor(
    private readonly world: World,
    private readonly context: GameContext,
    private readonly gameInitSystem: GameInitializationSystem,
    private readonly getUiSystem: () => UiSystem | null,
    private readonly getPlayerEntity: () => Entity | null,
    private readonly getRemotePlayerSystem: () => RemotePlayerSystem | null,
    private readonly getCameraSystem: () => any,
    private readonly getMovementSystem: () => any,
    private readonly getEconomySystem: () => any
  ) { }

  /**
   * Gets the current player rank using RankSystem
   */
  getPlayerRank(): string {
    if (!this.gameInitSystem) return 'Basic Space Pilot';

    const systems = this.gameInitSystem.getSystems();
    const rankSystem = systems.rankSystem;

    if (rankSystem && typeof rankSystem.calculateCurrentRank === 'function') {
      const rank = rankSystem.calculateCurrentRank();
      // console.log(`[DEBUG_RANK] PlayStateResourceManager.getPlayerRank: Current rank is ${rank}`); // Added log
      return rank;
    }

    return 'Basic Space Pilot';
  }

  /**
   * Updates the position of the player nickname
   */
  updateNicknamePosition(): void {
    const playerEntity = this.getPlayerEntity();
    if (!playerEntity) return;

    const transform = this.world.getECS().getComponent(playerEntity, Transform);
    if (!transform) return;

    const movementSystem = this.getMovementSystem();
    if (!movementSystem) return;

    const nickname = this.context.playerNickname || 'Commander';

    // Ottieni RankSystem per calcolare il rank attuale (SOLO ONORE)
    let rank = 'Basic Space Pilot';
    if (this.gameInitSystem) {
      const systems = this.gameInitSystem.getSystems();
      const rankSystem = systems.rankSystem;

      if (rankSystem && typeof rankSystem.calculateCurrentRank === 'function') {
        rank = rankSystem.calculateCurrentRank();
        // console.log(`[DEBUG_RANK] Polling rank: ${rank}`);
      }
    }

    const uiSystem = this.getUiSystem();
    if (!uiSystem) return;

    // AUTO-RECOVERY: Se pensiamo di aver creato il nickname ma l'elemento è sparito (es. dopo cambio mappa o bug)
    // l'UiSystem dovrebbe idealmente dirci se l'elemento esiste. 
    // Per ora, se siamo qui e nicknameCreated è true, confidiamo nell'updatePosition che internamente controlla l'esistenza.

    // Crea il nickname se non è ancora stato creato (solo una volta)
    if (!this.nicknameCreated) {
      uiSystem.createPlayerNicknameElement(`${nickname}\n[${rank}]`);
      this.nicknameCreated = true;
      this.lastDisplayedRank = rank;
    } else {
      // Aggiorna il contenuto del nickname solo se il rank è cambiato
      if (rank !== this.lastDisplayedRank) {
        uiSystem.updatePlayerNicknameContent(`${nickname}\n[${rank}]`);
        this.lastDisplayedRank = rank;
      }
    }

    const cameraSystem = this.getCameraSystem();
    if (!cameraSystem) return;

    const camera = cameraSystem.getCamera();
    const canvasSize = this.world.getCanvasSize();
    const isZoomAnimating = cameraSystem.isZoomAnimationActive ? cameraSystem.isZoomAnimationActive() : false;

    // FIX LOCAL NICKNAME JITTER:
    // Use the smoothed render position (144Hz) if available, otherwise fallback to physical transform (60Hz)
    // This matches the sprite rendering logic.
    let targetX = transform.x;
    let targetY = transform.y;

    if (PixiRenderSystem.smoothedLocalPlayerPos) {
      targetX = PixiRenderSystem.smoothedLocalPlayerPos.x;
      targetY = PixiRenderSystem.smoothedLocalPlayerPos.y;
    }

    // GESTIONE VISIBILITA NICKNAME
    const sprite = this.world.getECS().getComponent(playerEntity, Sprite);
    const animSprite = this.world.getECS().getComponent(playerEntity, AnimatedSprite);

    // Il nickname deve essere visibile se la nave è visibile
    let isVisible = (sprite && (sprite as any).visible !== false) ||
      (animSprite && (animSprite as any).visible !== false);

    // SICUREZZA: Se il player è vivo (HP > 0) e non siamo in fase di morte, forziamo la visibilità
    // Questo aiuta se lo stato 'visible' dello sprite dovesse rimanere incastrato
    const health = this.world.getECS().getComponent(playerEntity, Health) as Health | undefined;
    if (health && health.currentValue > 0 && !isVisible) {
      // Se siamo vivi ma invisibili, probabilmente è un residuo del vecchio stato di morte
      // Ripristiniamo la visibilità
      if (sprite) (sprite as any).visible = true;
      if (animSprite) (animSprite as any).visible = true;
      isVisible = true;
    }

    // Delega all'UiSystem (Aggiunto parametro isVisible)
    if (typeof (uiSystem as any).updatePlayerNicknamePosition === 'function') {
      (uiSystem as any).updatePlayerNicknamePosition(targetX, targetY, camera, canvasSize, isZoomAnimating, isVisible);
    }
  }

  /**
   * Updates positions and visibility of NPC nicknames
   */
  updateNpcNicknames(): void {
    const movementSystem = this.getMovementSystem();
    const uiSystem = this.getUiSystem();
    if (!movementSystem || !uiSystem) return;

    const cameraSystem = this.getCameraSystem();
    if (!cameraSystem) return;

    const camera = cameraSystem.getCamera();
    const canvasSize = this.world.getCanvasSize();
    const ecs = this.world.getECS();

    // Trova tutti gli NPC nel sistema
    const npcs = ecs.getEntitiesWithComponents(Npc, Transform);

    // Track quali NPC sono ancora visibili per cleanup
    const visibleNpcIds = new Set<number>();

    for (const entity of npcs) {
      const npc = ecs.getComponent(entity, Npc);
      const transform = ecs.getComponent(entity, Transform);

      if (npc && transform) {
        // Per NPC remoti, usa coordinate interpolate se disponibili
        let renderX = transform.x;
        let renderY = transform.y;

        // Controlla se è un NPC remoto con interpolazione
        const authority = ecs.getComponent(entity, Authority);
        const isRemoteNpc = authority && authority.authorityLevel === AuthorityLevel.SERVER_AUTHORITATIVE;

        if (isRemoteNpc) {
          // Usa valori interpolati per NPC remoti
          const interpolationTarget = ecs.getComponent(entity, InterpolationTarget);
          if (interpolationTarget) {
            renderX = interpolationTarget.renderX;
            renderY = interpolationTarget.renderY;
          }
        }

        // Verifica se l'NPC è visibile sulla schermata
        const screenPos = camera.worldToScreen(renderX, renderY, canvasSize.width, canvasSize.height);
        const isVisible = screenPos.x >= -100 && screenPos.x <= canvasSize.width + 100 &&
          screenPos.y >= -100 && screenPos.y <= canvasSize.height + 100;

        if (isVisible) {
          visibleNpcIds.add(entity.id);
          // Crea/assicura elemento nickname + stato
          uiSystem.ensureNpcNicknameElement(entity.id, npc.npcType, npc.behavior);
          // Aggiorna contenuto (nome + behavior) e posizione ogni frame
          uiSystem.updateNpcNicknameContent(entity.id, npc.npcType, npc.behavior);
          uiSystem.updateNpcNicknamePosition(entity.id, screenPos.x, screenPos.y);
        }
      }
    }

    // Rimuovi elementi DOM per NPC non più visibili
    const activeNpcIds = uiSystem.getNpcNicknameEntityIds();
    for (const entityId of activeNpcIds) {
      if (!visibleNpcIds.has(entityId)) {
        uiSystem.removeNpcNicknameElement(entityId);
      }
    }
  }

  /**
   * Updates the AnimatedSprite for remote players if needed
   */
  updateRemotePlayerSpriteImage(): void {
    const remotePlayerSystem = this.getRemotePlayerSystem();
    const playerEntity = this.getPlayerEntity();
    if (!remotePlayerSystem || !playerEntity || this.remotePlayerSpriteUpdated) return;

    const playerAnimatedSprite = this.world.getECS().getComponent(playerEntity, AnimatedSprite);
    if (playerAnimatedSprite && playerAnimatedSprite.isLoaded()) {
      // L'AnimatedSprite del player è caricato, aggiorna l'AnimatedSprite condiviso dei remote player
      remotePlayerSystem.updateSharedAnimatedSprite(playerAnimatedSprite);
      this.remotePlayerSpriteUpdated = true;
    }
  }

  /**
   * Updates positions and contents of remote player nicknames
   */
  updateRemotePlayerNicknames(): void {
    const remotePlayerSystem = this.getRemotePlayerSystem();
    if (!remotePlayerSystem) return;

    const uiSystem = this.getUiSystem();
    if (!uiSystem) return;

    // Controlla se dobbiamo aggiornare l'immagine del sprite condiviso
    this.updateRemotePlayerSpriteImage();

    const cameraSystem = this.getCameraSystem();
    if (!cameraSystem) return;

    const camera = cameraSystem.getCamera();
    const canvasSize = this.world.getCanvasSize();

    // Per ogni remote player attivo
    for (const clientId of remotePlayerSystem.getActiveRemotePlayers()) {
      const entityId = remotePlayerSystem.getRemotePlayerEntity(clientId);
      if (!entityId) continue;

      const entity = this.world.getECS().getEntity(entityId);
      if (!entity) continue;

      const transform = this.world.getECS().getComponent(entity, Transform);
      if (!transform) continue;

      // Use interpolated position if available, otherwise fall back to transform
      const interpolation = this.world.getECS().getComponent(entity, InterpolationTarget);
      const renderX = interpolation ? interpolation.renderX : transform.x;
      const renderY = interpolation ? interpolation.renderY : transform.y;

      // Converti posizione world a schermo
      const screenPos = camera.worldToScreen(renderX, renderY, canvasSize.width, canvasSize.height);

      // Assicura che esista l'elemento DOM per questo remote player
      const playerInfo = remotePlayerSystem.getRemotePlayerInfo(clientId);
      if (playerInfo) {
        uiSystem.ensureRemotePlayerNicknameElement(clientId, playerInfo.nickname, playerInfo.rank);
        uiSystem.updateRemotePlayerNicknamePosition(clientId, screenPos.x, screenPos.y);
      }
    }

    // Rimuovi elementi per remote player che non esistono più
    const activeClientIds = uiSystem.getRemotePlayerNicknameClientIds();
    for (const clientId of activeClientIds) {
      if (!remotePlayerSystem.isRemotePlayer(clientId)) {
        uiSystem.removeRemotePlayerNicknameElement(clientId);
      }
    }
  }

  /**
   * Resets nickname creation flag (for cleanup)
   */
  resetNicknameCreated(): void {
    this.nicknameCreated = false;
  }
}
