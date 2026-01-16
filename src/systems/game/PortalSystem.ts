import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Transform } from '../../entities/spatial/Transform';
import { Portal } from '../../entities/spatial/Portal';
import { PlayerSystem } from '../player/PlayerSystem';

/**
 * Sistema per gestire i portali
 * Riproduce suoni quando il player si avvicina
 */
export class PortalSystem extends BaseSystem {
  private playerSystem: PlayerSystem;
  private audioSystem: any = null;
  private inputSystem: any = null;
  private portalSoundInstances: Map<number, HTMLAudioElement> = new Map(); // entityId -> audio instance
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
      const dx = playerTransform.x - portalTransform.x;
      const dy = playerTransform.y - portalTransform.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

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

        // Aggiorna volume basato sulla distanza (più vicino = più forte)
        const audioInstance = this.portalSoundInstances.get(portalId);
        if (audioInstance) {
          // Calcola volume: massimo a MAX_VOLUME_DISTANCE, zero a PROXIMITY_DISTANCE
          const distanceFromMax = Math.max(0, distance - this.MAX_VOLUME_DISTANCE);
          const distanceRange = this.PROXIMITY_DISTANCE - this.MAX_VOLUME_DISTANCE;
          const normalizedDistance = distanceRange > 0 ? distanceFromMax / distanceRange : 0;
          const volume = 0.25 * (1 - normalizedDistance); // Volume da 0.25 a 0
          audioInstance.volume = Math.max(0, Math.min(0.25, volume));
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
      // Crea un'istanza audio separata per questo portale per controllo volume individuale
      const audio = new Audio('/assets/audio/effects/portal/portal.mp3');
      audio.loop = true;
      audio.volume = 0.15; // Volume iniziale più basso
      
      // Gestisci errori di riproduzione
      audio.addEventListener('error', (e) => {
        console.warn('[PortalSystem] Error loading portal sound:', e);
      });
      
      audio.play().catch(err => {
        console.warn('[PortalSystem] Error playing portal sound:', err);
        // Rimuovi dalla mappa se non può essere riprodotto
        this.portalSoundInstances.delete(portalId);
      });
      
      this.portalSoundInstances.set(portalId, audio);
    } catch (error) {
      console.warn('[PortalSystem] Error starting portal sound:', error);
    }
  }

  private fadeOutPortalSound(portalId: number): void {
    const audio = this.portalSoundInstances.get(portalId);
    if (!audio) return;

    const startVolume = audio.volume;
    const startTime = Date.now();

    const fadeStep = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / this.FADE_OUT_DURATION, 1);

      // Curva ease-out per fade più naturale
      const easedProgress = 1 - Math.pow(1 - progress, 2);
      audio.volume = startVolume * (1 - easedProgress);

      if (progress < 1) {
        const frameId = requestAnimationFrame(fadeStep);
        this.portalFadeOutAnimations.set(portalId, frameId);
      } else {
        // Fade out completato, ferma il suono
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

    const audio = this.portalSoundInstances.get(portalId);
    if (audio) {
      try {
        // Ferma il suono
        audio.pause();
        audio.currentTime = 0;
        // Imposta volume a 0 per sicurezza
        audio.volume = 0;
        // Rimuovi tutti gli event listener per evitare memory leak
        audio.removeEventListener('error', () => {});
      } catch (error) {
        console.warn('[PortalSystem] Error stopping portal sound:', error);
      } finally {
        // Rimuovi sempre dalla mappa anche se c'è un errore
        this.portalSoundInstances.delete(portalId);
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

      const dx = playerTransform.x - portalTransform.x;
      const dy = playerTransform.y - portalTransform.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

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
        console.log('[PortalSystem] Portal activated - animation speed increased for 3 seconds');
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
    this.audioSystem = null;
  }
}
