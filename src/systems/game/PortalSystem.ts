import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { Portal } from '../../entities/spatial/Portal';
import { PlayerSystem } from '../player/PlayerSystem';
import { MathUtils } from '../../core/utils/MathUtils';

/**
 * Sistema per gestire i portali
 * Riproduce suoni quando il player si avvicina
 */
export class PortalSystem extends BaseSystem {
  private playerSystem: PlayerSystem;
  private audioSystem: any = null;
  private inputSystem: any = null;
  private portalSoundInstances: Map<number, HTMLAudioElement> = new Map(); // entityId -> portal audio instance
  private portalBassdropInstances: Map<number, HTMLAudioElement> = new Map(); // entityId -> bassdrop audio instance
  private portalFadeOutAnimations: Map<number, number> = new Map(); // entityId -> animationFrameId
  private readonly PROXIMITY_DISTANCE = 600; // Distanza per attivare il suono
  private readonly INTERACTION_DISTANCE = 300; // Distanza per interagire con E
  private readonly MAX_VOLUME_DISTANCE = 200; // Distanza per volume massimo
  private readonly FADE_OUT_DURATION = 500; // ms per fade out
  private lastEKeyPress: number = 0; // Timestamp ultimo press E per debouncing
  private readonly E_KEY_DEBOUNCE = 500; // ms tra pressioni E

  constructor(ecs: ECS, playerSystem: PlayerSystem) {
    super(ecs);
    this.playerSystem = playerSystem;
  }

  setAudioSystem(audioSystem: any): void {
    this.audioSystem = audioSystem;
  }

  setInputSystem(inputSystem: any): void {
    this.inputSystem = inputSystem;
  }

  update(deltaTime: number): void {
    if (!this.audioSystem) return;

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

      const portalId = portalEntity.id;
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

          const portalVolume = 0.18 * (1 - normalizedDistance); // Volume portale da 0.18 a 0
          const bassdropVolume = 0.15 * (1 - normalizedDistance); // Volume bassdrop da 0.15 a 0

          if (portalAudio) {
            portalAudio.volume = Math.max(0, Math.min(0.18, portalVolume));
          }
          if (bassdropAudio) {
            bassdropAudio.volume = Math.max(0, Math.min(0.15, bassdropVolume));
          }
        }

        // Gestisci interazione con E quando player è abbastanza vicino
        if (distance <= this.INTERACTION_DISTANCE) {
          this.checkPortalInteraction(portalEntity, distance);
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

  private startPortalSound(portalId: number): void {
    try {
      // Crea istanza audio per il suono principale del portale
      const portalAudio = new Audio('/assets/audio/effects/portal/portal.mp3');
      portalAudio.loop = true;
      portalAudio.volume = 0.10; // Volume iniziale più basso

      // Crea istanza audio per il bassdrop
      const bassdropAudio = new Audio('/assets/audio/effects/portal/bassdrop.mp3');
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

  private fadeOutPortalSound(portalId: number): void {
    const portalAudio = this.portalSoundInstances.get(portalId);
    const bassdropAudio = this.portalBassdropInstances.get(portalId);

    if (!portalAudio && !bassdropAudio) return;

    const startTime = Date.now();

    const fadeStep = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / this.FADE_OUT_DURATION, 1);

      // Curva ease-out per fade più naturale
      const easedProgress = 1 - Math.pow(1 - progress, 2);

      if (portalAudio) {
        const portalStartVolume = portalAudio.volume;
        portalAudio.volume = portalStartVolume * (1 - easedProgress);
      }

      if (bassdropAudio) {
        const bassdropStartVolume = bassdropAudio.volume;
        bassdropAudio.volume = bassdropStartVolume * (1 - easedProgress);
      }

      if (progress < 1) {
        const frameId = requestAnimationFrame(fadeStep);
        this.portalFadeOutAnimations.set(portalId, frameId);
      } else {
        // Fade out completato, ferma i suoni
        this.stopPortalSound(portalId);
      }
    };

    fadeStep();
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
        portalAudio.pause();
        portalAudio.currentTime = 0;
        portalAudio.volume = 0;
        portalAudio.removeEventListener('error', () => {});
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
        bassdropAudio.removeEventListener('error', () => {});
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
  private checkPortalInteraction(portalEntity: any, distance: number): void {
    // Verifica se il tasto E è stato premuto
    // Questo verrà chiamato da un callback quando E viene premuto
  }

  /**
   * Chiamato quando il tasto E viene premuto
   */
  handleEKeyPress(): void {
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
    let nearestPortal: any = null;
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

    // Se c'è un portale vicino, attivalo
    if (nearestPortal) {
      const portal = this.ecs.getComponent(nearestPortal, Portal);
      if (portal) {
        portal.activate();
        this.lastEKeyPress = now;
      }
    }
  }

  destroy(): void {
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
    this.audioSystem = null;
  }
}
