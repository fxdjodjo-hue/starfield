import { System } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { Portal } from '../../entities/spatial/Portal';
import { MathUtils } from '../../core/utils/MathUtils';
import { PlayerSystem } from '../player/PlayerSystem';
import { Sprite } from '../../entities/Sprite';
import { AnimatedSprite } from '../../entities/AnimatedSprite';
import { Health } from '../../entities/combat/Health';
import { Entity } from '../../infrastructure/ecs/Entity';

// Import Types - using type imports to avoid potential circular dependency issues at runtime
// though strict usages might require value imports. We will use value imports for type guards if needed.
import { UiSystem } from '../ui/UiSystem';
import { PlayerControlSystem } from '../input/PlayerControlSystem';
import AudioSystem from '../audio/AudioSystem';
import { InputSystem } from '../input/InputSystem';

/**
 * Sistema per gestire i portali
 * Riproduce suoni quando il player si avvicina
 */
export class PortalSystem extends System {
  private playerSystem: PlayerSystem;
  private audioSystem: AudioSystem | null = null;
  private inputSystem: InputSystem | null = null;
  private clientNetworkSystem: any = null; // Type as any for now as we haven't located the specific definition
  private portalSoundInstances: Map<number, HTMLAudioElement> = new Map(); // entityId -> portal audio instance
  private portalBassdropInstances: Map<number, HTMLAudioElement> = new Map(); // entityId -> bassdrop audio instance
  private portalFadeOutAnimations: Map<number, number> = new Map(); // entityId -> animationFrameId
  private portalProximityState: Map<number, boolean> = new Map(); // entityId -> isPlayerInside state
  private readonly PROXIMITY_DISTANCE = 600; // Distanza per attivare il suono
  private readonly INTERACTION_DISTANCE = 300; // Distanza per interagire con E
  private readonly MAX_VOLUME_DISTANCE = 200; // Distanza per volume massimo
  private readonly FADE_OUT_DURATION = 500; // ms per fade out
  private lastEKeyPress: number = 0; // Timestamp ultimo press E per debouncing
  private readonly E_KEY_DEBOUNCE = 500; // ms tra pressioni E
  private areSoundsDisabled: boolean = false;
  private isTransitioning: boolean = false; // Prevents double activation during fade

  constructor(ecs: ECS, playerSystem: PlayerSystem) {
    super(ecs);
    this.playerSystem = playerSystem;
  }

  setAudioSystem(audioSystem: AudioSystem): void {
    this.audioSystem = audioSystem;
  }

  /**
   * Disabilita/Abilita i suoni dei portali
   * @param disabled true per silenziare, false per riabilitare
   */
  public setSoundsDisabled(disabled: boolean): void {
    this.areSoundsDisabled = disabled;

    if (!disabled) {
      // Re-enable interaction when sounds are enabled (end of transition)
      this.isTransitioning = false;

      // Re-enable Player Input
      const playerControlSystem = this.ecs.getSystems().find((s) => s.constructor.name === 'PlayerControlSystem') as PlayerControlSystem | undefined;
      if (playerControlSystem && typeof playerControlSystem.setInputForcedDisabled === 'function') {
        playerControlSystem.setInputForcedDisabled(false);
      }
    }

    if (disabled) {
      // Usa un fade out molto veloce invece di stop immediato per evitare crackling
      for (const portalId of this.portalSoundInstances.keys()) {
        if (!this.portalFadeOutAnimations.has(portalId)) {
          this.fadeOutPortalSound(portalId, 150); // 150ms fade out veloce
        }
      }
    }
  }

  setInputSystem(inputSystem: InputSystem): void {
    this.inputSystem = inputSystem;
  }

  setClientNetworkSystem(clientNetworkSystem: any): void {
    this.clientNetworkSystem = clientNetworkSystem;
  }

  update(deltaTime: number): void {
    if (!this.audioSystem || this.areSoundsDisabled) return;

    const playerEntity = this.playerSystem.getPlayerEntity();
    if (!playerEntity) return;

    const playerTransform = this.ecs.getComponent(playerEntity, Transform);
    if (!playerTransform) return;

    // Trova tutti i portali
    const portals = this.ecs.getEntitiesWithComponents(Transform, Portal);

    for (const portalEntity of portals) {
      const portalTransform = this.ecs.getComponent(portalEntity, Transform);
      if (!portalTransform) continue;

      // Calcola distanza tra player e portale
      const distance = MathUtils.calculateDistance(
        playerTransform.x, playerTransform.y,
        portalTransform.x, portalTransform.y
      );

      const portalId = portalEntity.id as number; // EntityId behaves as number
      const isPlaying = this.portalSoundInstances.has(portalId);

      if (distance <= this.PROXIMITY_DISTANCE) {
        // Player è vicino al portale
        if (!isPlaying) {
          // Avvia il suono
          this.startPortalSound(portalId);
        }

        // Se c'è un fade out in corso, cancellalo
        if (this.portalFadeOutAnimations.has(portalId)) {
          const fadeOutFrameId = this.portalFadeOutAnimations.get(portalId);
          if (fadeOutFrameId) {
            cancelAnimationFrame(fadeOutFrameId);
          }
          this.portalFadeOutAnimations.delete(portalId);
        }

        // Aggiorna volume basato sulla distanza per entrambi i suoni (più vicino = più forte)
        const portalAudio = this.portalSoundInstances.get(portalId);
        const bassdropAudio = this.portalBassdropInstances.get(portalId);

        if (portalAudio || bassdropAudio) {
          // Calcola volume: massimo a MAX_VOLUME_DISTANCE, zero a PROXIMITY_DISTANCE
          const distanceFromMax = Math.max(0, distance - this.MAX_VOLUME_DISTANCE);
          const distanceRange = this.PROXIMITY_DISTANCE - this.MAX_VOLUME_DISTANCE;
          const normalizedDistance = distanceRange > 0 ? distanceFromMax / distanceRange : 0;

          // Ottieni volumi globali dall'AudioSystem
          // Use unknown cast to access getConfig safely if type definition is partial
          const config = (this.audioSystem as any)?.getConfig?.() || { masterVolume: 1, effectsVolume: 1 };
          const globalMultiplier = config.masterVolume * config.effectsVolume;

          const portalVolume = 0.18 * (1 - normalizedDistance) * globalMultiplier;
          const bassdropVolume = 0.15 * (1 - normalizedDistance) * globalMultiplier;

          if (portalAudio) {
            portalAudio.volume = Math.max(0, Math.min(1, portalVolume));
          }
          if (bassdropAudio) {
            bassdropAudio.volume = Math.max(0, Math.min(1, bassdropVolume));
          }
        }

        // Gestisci interazione con E quando player è abbastanza vicino
        if (distance <= this.INTERACTION_DISTANCE) {
          this.checkPortalInteraction(portalEntity, distance);
        }

        // 🚀 AUTO-TELEPORT: Edge detection logic
        // Only trigger when entering the zone (isInside && !wasInside)
        const AUTO_TRIGGER_DISTANCE = 80;
        const isInside = distance <= AUTO_TRIGGER_DISTANCE;

        // FIRST RUN CHECK: If state is unknown, initialize it without triggering
        // This handles spawning inside a portal (prevents immediate loop without needing a timer)
        if (!this.portalProximityState.has(portalId)) {
          this.portalProximityState.set(portalId, isInside);
        } else {
          const wasInside = this.portalProximityState.get(portalId) ?? false;
          this.portalProximityState.set(portalId, isInside);

          if (isInside && !wasInside && !this.isTransitioning) {
            // EDGE TRIGGER: Player entered the zone
            this.triggerPortalTransition(portalEntity);
          }
        }
      } else {
        // Player è lontano, avvia fade out graduale
        if (isPlaying) {
          // Se non c'è già un fade out in corso, avvialo
          if (!this.portalFadeOutAnimations.has(portalId)) {
            this.fadeOutPortalSound(portalId);
          }
        }
      }
    }
  }

  /**
   * Centralized logic for triggering portal transition (used by both Key Press and Auto-trigger)
   */
  private triggerPortalTransition(portalEntity: Entity): void {
    if (this.isTransitioning) return; // Prevent double activation

    const portal = this.ecs.getComponent(portalEntity, Portal);
    if (portal) {
      this.isTransitioning = true; // LOCK INTERACTION
      portal.activate();

      // --- 1. IMMEDIATELY START AUDIO ---
      const uiSystem = this.ecs.getSystems().find((s) => s.constructor.name === 'UiSystem') as UiSystem | undefined;
      if (uiSystem && typeof uiSystem.playWarpSound === 'function') {
        uiSystem.playWarpSound();
      }

      // --- 2. DELAYED VISUAL TRANSITION (Separate sound from black screen) ---
      // User request: Play sound on entry, not when screen goes black
      // REMOVED DELAY: Delegated to MapChangeHandler or instant
      // However, we want the screen to fade/wormhole immediately now to hide the transition
      /*
      if (uiSystem && typeof uiSystem.playWormholeTransition === 'function') {
         uiSystem.playWormholeTransition();
      }
      */
      // NOTE: We don't trigger it here anymore to avoid the "double video" bug.
      // The server will send MapChange, which triggers the video in MapChangeHandler.
      // OR, if we want it instant on click, we should uncomment it but handle the duplication.
      // Current plan: Delegate to MapChangeHandler which receives the server ack.
      // WAIT - if we rely ONLY on MapChangeHandler, there might be a delay before the screen goes black
      // where the player sees themselves "stuck".
      // Let's trigger it immediately for responsiveness, but MapChangeHandler handles the "Wait" logic.
      // Actually, plan says "Delegate visual transition triggering to MapChangeHandler". 
      // So checking implementation_plan... "Delegate visual transition triggering to MapChangeHandler".
      // OK, commenting out here.

      // --- 2. IMMEDIATELY MUTE PORTAL AMBIENCE ---
      this.setSoundsDisabled(true);

      // --- 3. LOCK INPUT & STOP MOVEMENT ---
      const playerControlSystem = this.ecs.getSystems().find((s) => s.constructor.name === 'PlayerControlSystem') as PlayerControlSystem | undefined;
      if (playerControlSystem && typeof playerControlSystem.forceStopMovement === 'function') {
        playerControlSystem.forceStopMovement();
      }
      if (playerControlSystem && typeof playerControlSystem.setInputForcedDisabled === 'function') {
        playerControlSystem.setInputForcedDisabled(true);
      }

      // --- 4. HIDE PLAYER & MAKE INVULNERABLE (Immediate Local Effect) ---
      const playerEntity = this.playerSystem.getPlayerEntity();
      if (playerEntity) {
        const sprite = this.ecs.getComponent(playerEntity, Sprite);
        if (sprite) {
          sprite.visible = false;
        }
        const animatedSprite = this.ecs.getComponent(playerEntity, AnimatedSprite);
        if (animatedSprite) {
          animatedSprite.visible = false;
        }
        const health = this.ecs.getComponent(playerEntity, Health);
        if (health) {
          health.isInvulnerable = true;
        }
      }

      // --- 5. SERVER NOTIFICATION (IMMEDIATE) ---
      // REMOVED DELAY: Send immediately to avoid "ghosting" to other players
      if (this.clientNetworkSystem && typeof this.clientNetworkSystem.sendMessage === 'function') {
        this.clientNetworkSystem.sendMessage({
          type: 'portal_use',
          portalId: portalEntity.id,
          timestamp: Date.now()
        });
      }
      // Note: isTransitioning stays true. System will be destroyed/reset on map load.
    }
  }

  private startPortalSound(portalId: number): void {
    try {
      // Crea istanza audio per il suono principale del portale
      const portalAudio = new Audio('assets/audio/effects/portal/portal.mp3');
      portalAudio.loop = true;
      portalAudio.volume = 0.10; // Volume iniziale più basso

      // Crea istanza audio per il bassdrop
      const bassdropAudio = new Audio('assets/audio/effects/portal/bassdrop.mp3');
      bassdropAudio.loop = true;
      bassdropAudio.volume = 0.08; // Volume leggermente più basso per il bassdrop

      // Gestisci errori di riproduzione per il portale
      portalAudio.addEventListener('error', (e) => {
        console.warn('[PortalSystem] Error loading portal sound:', e);
      });

      // Gestisci errori di riproduzione per il bassdrop
      bassdropAudio.addEventListener('error', (e) => {
        console.warn('[PortalSystem] Error loading bassdrop sound:', e);
      });

      // Riproduci entrambi i suoni
      const playPromises = [portalAudio.play(), bassdropAudio.play()];

      Promise.all(playPromises).catch(err => {
        console.warn('[PortalSystem] Error playing portal sounds:', err);
        // Rimuovi dalla mappa se non possono essere riprodotti
        this.portalSoundInstances.delete(portalId);
        this.portalBassdropInstances.delete(portalId);
      });

      this.portalSoundInstances.set(portalId, portalAudio);
      this.portalBassdropInstances.set(portalId, bassdropAudio);
    } catch (error) {
      console.warn('[PortalSystem] Error starting portal sounds:', error);
    }
  }

  private fadeOutPortalSound(portalId: number, duration: number = this.FADE_OUT_DURATION): void {
    const portalAudio = this.portalSoundInstances.get(portalId);
    const bassdropAudio = this.portalBassdropInstances.get(portalId);

    if (!portalAudio && !bassdropAudio) return;

    // Se c'è già un fade in corso, cancellalo per ripartire puliti (o potremmo lasciarlo andare, ma reimpostiamo per sicurezza)
    if (this.portalFadeOutAnimations.has(portalId)) {
      cancelAnimationFrame(this.portalFadeOutAnimations.get(portalId)!);
    }

    const startTime = Date.now();
    const startPortalVolume = portalAudio ? portalAudio.volume : 0;
    const startBassdropVolume = bassdropAudio ? bassdropAudio.volume : 0;

    const fadeStep = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Curva ease-out per fade più naturale
      const easedProgress = 1 - Math.pow(1 - progress, 2);

      if (portalAudio) {
        portalAudio.volume = Math.max(0, startPortalVolume * (1 - easedProgress));
      }

      if (bassdropAudio) {
        bassdropAudio.volume = Math.max(0, startBassdropVolume * (1 - easedProgress));
      }

      if (progress < 1) {
        const frameId = requestAnimationFrame(fadeStep);
        this.portalFadeOutAnimations.set(portalId, frameId);
      } else {
        // Fade out completato, ferma i suoni
        this.stopPortalSound(portalId);
      }
    };

    const firstFrameId = requestAnimationFrame(fadeStep);
    this.portalFadeOutAnimations.set(portalId, firstFrameId);
  }

  private stopPortalSound(portalId: number): void {
    // Cancella eventuale animazione di fade out
    const fadeOutFrameId = this.portalFadeOutAnimations.get(portalId);
    if (fadeOutFrameId) {
      cancelAnimationFrame(fadeOutFrameId);
      this.portalFadeOutAnimations.delete(portalId);
    }

    // Ferma il suono del portale
    const portalAudio = this.portalSoundInstances.get(portalId);
    if (portalAudio) {
      try {
        // FIX: Zero volume BEFORE pausing to prevent clicking/pop artifacts
        portalAudio.volume = 0;
        portalAudio.pause();
        portalAudio.currentTime = 0;
        portalAudio.removeEventListener('error', () => { });
      } catch (error) {
        console.warn('[PortalSystem] Error stopping portal sound:', error);
      } finally {
        this.portalSoundInstances.delete(portalId);
      }
    }

    // Ferma il suono del bassdrop
    const bassdropAudio = this.portalBassdropInstances.get(portalId);
    if (bassdropAudio) {
      try {
        bassdropAudio.pause();
        bassdropAudio.currentTime = 0;
        bassdropAudio.volume = 0;
        bassdropAudio.removeEventListener('error', () => { });
      } catch (error) {
        console.warn('[PortalSystem] Error stopping bassdrop sound:', error);
      } finally {
        this.portalBassdropInstances.delete(portalId);
      }
    }
  }

  /**
   * Gestisce l'interazione con il portale (tasto E)
   */
  private checkPortalInteraction(portalEntity: Entity, distance: number): void {
    // Verifica se il tasto E è stato premuto
    // Questo verrà chiamato da un callback quando E viene premuto
  }

  /**
   * Chiamato quando il tasto E viene premuto
   */
  handleEKeyPress(): void {
    if (this.isTransitioning) return; // BLOCK INPUT during transition

    const playerEntity = this.playerSystem.getPlayerEntity();
    if (!playerEntity) return;

    const playerTransform = this.ecs.getComponent(playerEntity, Transform);
    if (!playerTransform) return;

    // Verifica debouncing
    const now = Date.now();
    if (now - this.lastEKeyPress < this.E_KEY_DEBOUNCE) {
      return;
    }

    // Trova il portale più vicino
    const portals = this.ecs.getEntitiesWithComponents(Transform, Portal);
    let nearestPortal: Entity | null = null;
    let nearestDistance = Infinity;

    for (const portalEntity of portals) {
      const portalTransform = this.ecs.getComponent(portalEntity, Transform);
      if (!portalTransform) continue;

      const distance = MathUtils.calculateDistance(
        playerTransform.x, playerTransform.y,
        portalTransform.x, portalTransform.y
      );

      if (distance <= this.INTERACTION_DISTANCE && distance < nearestDistance) {
        nearestDistance = distance;
        nearestPortal = portalEntity;
      }
    }

    // Se c'è un portale vicino, attivalo (MANUAL TRIGGER)
    if (nearestPortal) {
      this.lastEKeyPress = now;
      this.triggerPortalTransition(nearestPortal);
    }
  }

  /**
   * Ferma tutti i suoni dei portali (chiamato durante cambio mappa)
   */
  stopAllPortalSounds(): void {
    // Reset proximity state on map change
    this.portalProximityState.clear();

    // Cancella tutte le animazioni di fade out
    for (const frameId of this.portalFadeOutAnimations.values()) {
      cancelAnimationFrame(frameId);
    }
    this.portalFadeOutAnimations.clear();

    // Ferma tutti i suoni dei portali
    for (const portalId of this.portalSoundInstances.keys()) {
      this.stopPortalSound(portalId);
    }
    this.portalSoundInstances.clear();
    this.portalBassdropInstances.clear();

    console.log('[PortalSystem] All portal sounds stopped (map change)');
  }

  destroy(): void {
    this.stopAllPortalSounds();
    this.audioSystem = null;
  }
}
