import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';
import type { EntityDamagedMessage } from '../../../config/NetworkConfig';
import { Health } from '../../../entities/combat/Health';
import { Shield } from '../../../entities/combat/Shield';
import { Damage } from '../../../entities/combat/Damage';
import { Explosion } from '../../../entities/combat/Explosion';
import { RemotePlayer } from '../../../entities/player/RemotePlayer';
import { Transform } from '../../../entities/spatial/Transform';
import { Sprite } from '../../../entities/Sprite';
import { AnimatedSprite } from '../../../entities/AnimatedSprite';
import { AtlasParser } from '../../../core/utils/AtlasParser';

/**
 * Gestisce i danni ricevuti dalle entità (NPC o giocatori)
 */
export class EntityDamagedHandler extends BaseMessageHandler {
  private static shieldHitFramesCache: HTMLImageElement[] | null = null;
  private static shieldHitFramesPromise: Promise<HTMLImageElement[]> | null = null;

  private readonly shieldStateByEntity: Map<string, number> = new Map();
  private readonly lastShieldHitEffectAtByEntity: Map<string, number> = new Map();
  private readonly SHIELD_HIT_EFFECT_ATLAS_PATH = 'assets/shieldhit/shieldhit.atlas';
  private readonly SHIELD_HIT_EFFECT_FRAME_MS = 28;
  private readonly SHIELD_HIT_EFFECT_COOLDOWN_MS = 90;
  private readonly SHIELD_HIT_EFFECT_RENDER_SCALE = 1.9;
  private readonly SHIELD_HIT_EFFECT_ROTATION_OFFSET = Math.PI;
  private readonly SHIELD_HIT_RING_RATIO = 0.42;
  private readonly SHIELD_HIT_MIN_RADIUS = 34;
  private readonly SHIELD_HIT_MAX_RADIUS = 220;

  constructor() {
    super(MESSAGE_TYPES.ENTITY_DAMAGED);
  }

  handle(message: EntityDamagedMessage, networkSystem: ClientNetworkSystem): void {
    // Crea damage text per il danno ricevuto
    const ecs = networkSystem.getECS();
    if (!ecs) {
      console.error('[EntityDamagedHandler] ECS not available!');
      return;
    }

    // 🔧 NUOVA LOGICA: Aggiorna il cooldown del laser quando il player locale infligge danno
    // Questo sincronizza l'UI con il cooldown del danno server-authoritative (1500ms)
    // NOTA: I missili sono gestiti in ProjectileFiredHandler (al momento dello sparo)
    const localAuthId = networkSystem.gameContext.authId;
    const localClientId = networkSystem.getLocalClientId();
    const isLocalPlayerAttacker =
      message.attackerId === String(localAuthId) ||
      message.attackerId === String(localClientId);

    if (isLocalPlayerAttacker && message.projectileType === 'laser') {
      // Trova l'entità del player locale e aggiorna lastAttackTime
      const playerSystem = networkSystem.getPlayerSystem();
      if (playerSystem) {
        const playerEntity = playerSystem.getPlayerEntity();
        if (playerEntity) {
          const playerDamage = ecs.getComponent(playerEntity, Damage);
          if (playerDamage) {
            playerDamage.performAttack(Date.now());
          }
        }
      }
    }

    // Trova il CombatSystem per creare i damage text
    const combatSystem = this.findCombatSystem(ecs);

    if (!combatSystem) {
      console.error('[EntityDamagedHandler] CombatSystem not found in ECS!');
      return;
    }

    // CombatSystem trovato e valido (ha il metodo createDamageText), procedi con la creazione dei damage text
    if (combatSystem) {
      // Trova l'entità danneggiata
      let targetEntity = null;

      if (message.entityType === 'npc') {
        // Usa il RemoteNpcSystem per trovare l'entità dell'NPC remoto
        const remoteNpcSystem = networkSystem.getRemoteNpcSystem();
        if (remoteNpcSystem) {
          // FIX: Converti message.entityId a stringa per gli NPC
          const npcId = message.entityId.toString();
          const entityId = remoteNpcSystem.getRemoteNpcEntity(npcId);
          if (entityId !== undefined) {
            // Ottieni l'entità effettiva dall'ECS usando l'entity ID
            targetEntity = ecs.getEntity(entityId);
          }
        } else {
          console.error('[EntityDamagedHandler] RemoteNpcSystem not available!');
        }
      } else if (message.entityType === 'player') {
        if (message.entityId === networkSystem.getLocalClientId()) {
          // Giocatore locale - trova l'entità locale
          const allEntities = ecs.getEntitiesWithComponents(Health, Shield);
          for (const entity of allEntities) {
            if (!ecs.hasComponent(entity, RemotePlayer)) {
              targetEntity = entity;
              break;
            }
          }
        } else {
          // Giocatore remoto - trova l'entità remota
          const allEntities = ecs.getEntitiesWithComponents(Health);
          for (const entity of allEntities) {
            const remotePlayer = ecs.getComponent(entity, RemotePlayer);
            // 🚀 FIX ROBUSTEZZA: Forza il confronto tra stringhe per evitare problemi tra number e string (clientId)
            if (remotePlayer && remotePlayer.clientId.toString() === message.entityId.toString()) {
              targetEntity = entity;
              break;
            }
          }
        }
      }

      const entityKey = `${message.entityType}:${String(message.entityId)}`;
      const trackedShieldBefore = this.shieldStateByEntity.get(entityKey);
      let previousShield = Number.isFinite(Number(trackedShieldBefore))
        ? Number(trackedShieldBefore)
        : null;
      if (targetEntity) {
        const targetShield = ecs.getComponent(targetEntity, Shield);
        if (targetShield) {
          previousShield = Number(targetShield.current);
        }
      }

      const nextShield = Number.isFinite(Number(message.newShield))
        ? Math.max(0, Number(message.newShield))
        : 0;

      if (message.entityType === 'player' && previousShield !== null && previousShield > nextShield) {
        this.triggerShieldHitEffect(
          ecs,
          networkSystem,
          targetEntity,
          message.position,
          message.attackerId,
          entityKey
        );
      }

      // Crea damage text per il danno ricevuto dal server
      if (message.damage > 0) {
        // Per ora mostriamo tutto come danno HP (bianco/rosso)
        // In futuro potremmo migliorare la logica per distinguere shield vs HP
        const isShieldDamage = false;
        const projectileType = message.projectileType;

        // Passa anche la posizione dal server per garantire che il testo appaia anche se l'entità è stata distrutta (es: oneshot)
        combatSystem.createDamageText(targetEntity, message.damage, isShieldDamage, false, projectileType, message.position.x, message.position.y);
      }
    }

    // Nota: l'aggiornamento dei valori health/shield è già stato fatto sopra
    // nella sezione di creazione dei damage text per evitare duplicazioni

    if (message.entityType === 'player') {
      // Controlla se il danno è per il giocatore locale
      if (message.entityId === networkSystem.getLocalClientId()) {
        // Danno al giocatore LOCALE - aggiorna i propri componenti

        // Trova e aggiorna i componenti del giocatore locale
        if (ecs) {
          // Il giocatore locale ha componenti come PlayerUpgrades, PlayerStats, ecc.
          // Cerchiamo entità che hanno Health e Shield ma non RemotePlayer
          const allEntities = ecs.getEntitiesWithComponents(Health, Shield);

          for (const entity of allEntities) {
            // Salta remote players (hanno anche RemotePlayer component)
            if (ecs.hasComponent(entity, RemotePlayer)) continue;

            // Questa dovrebbe essere l'entità del giocatore locale
            const healthComponent = ecs.getComponent(entity, Health);
            const shieldComponent = ecs.getComponent(entity, Shield);

            if (healthComponent && shieldComponent) {
              healthComponent.current = message.newHealth;
              shieldComponent.current = message.newShield;
              break;
            }
          }
        }

        // TODO: Aggiungere effetti visivi di danno per il giocatore locale (screen shake, damage numbers, etc.)
      } else {
        // Danno a giocatore remoto
        const remotePlayerSystem = networkSystem.getRemotePlayerSystem();
        if (remotePlayerSystem) {
          // Per i remote players, usiamo i valori max forniti dal server (se disponibili)
          // Se non disponibili (undefined in message), passiamo undefined per mantenere i valori attuali
          const maxHealth = (message as any).maxHealth;
          const maxShield = (message as any).maxShield;

          remotePlayerSystem.updatePlayerStats(message.entityId.toString(), message.newHealth, maxHealth, message.newShield, maxShield);
        }
      }
    }

    if (message.entityType === 'player') {
      const entityKey = `${message.entityType}:${String(message.entityId)}`;
      const nextShield = Number.isFinite(Number(message.newShield))
        ? Math.max(0, Number(message.newShield))
        : 0;
      this.shieldStateByEntity.set(entityKey, nextShield);
      if (this.shieldStateByEntity.size > 1024) {
        const oldestKey = this.shieldStateByEntity.keys().next().value;
        if (oldestKey) this.shieldStateByEntity.delete(oldestKey);
      }
    }

    // TODO: Aggiungere altri effetti visivi di danno (particle effects, screen shake, etc.)
  }

  /**
   * Trova il CombatSystem nell'ECS (robusto contro minificazione)
   */
  private findCombatSystem(ecs: any): any {
    // Cerca il sistema che ha il metodo createDamageText (unico del CombatSystem)
    const systems = ecs.getSystems ? ecs.getSystems() : [];
    return systems.find((system: any) => typeof system.createDamageText === 'function');
  }

  private triggerShieldHitEffect(
    ecs: any,
    networkSystem: ClientNetworkSystem,
    targetEntity: any,
    fallbackPosition: { x: number; y: number } | undefined,
    attackerId: unknown,
    entityKey: string
  ): void {
    const now = Date.now();
    const resolvedPosition = this.resolveShieldHitWorldPosition(
      ecs,
      networkSystem,
      targetEntity,
      fallbackPosition,
      attackerId,
      entityKey,
      now
    );
    if (!resolvedPosition) return;
    const x = Number(resolvedPosition.x);
    const y = Number(resolvedPosition.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;

    const lastAt = this.lastShieldHitEffectAtByEntity.get(entityKey) || 0;
    if (now - lastAt < this.SHIELD_HIT_EFFECT_COOLDOWN_MS) {
      return;
    }
    this.lastShieldHitEffectAtByEntity.set(entityKey, now);
    if (this.lastShieldHitEffectAtByEntity.size > 1024) {
      const oldestKey = this.lastShieldHitEffectAtByEntity.keys().next().value;
      if (oldestKey) this.lastShieldHitEffectAtByEntity.delete(oldestKey);
    }

    const rotation = Number.isFinite(Number(resolvedPosition.rotation))
      ? Number(resolvedPosition.rotation)
      : 0;
    void this.spawnShieldHitEffect(ecs, x, y, rotation);
  }

  private resolveShieldHitWorldPosition(
    ecs: any,
    networkSystem: ClientNetworkSystem,
    targetEntity: any,
    fallbackPosition: { x: number; y: number } | undefined,
    attackerId: unknown,
    entityKey: string,
    timeSeedMs: number
  ): { x: number; y: number; rotation: number } | null {
    if (targetEntity && ecs) {
      const transform = ecs.getComponent(targetEntity, Transform);
      if (transform && Number.isFinite(Number(transform.x)) && Number.isFinite(Number(transform.y))) {
        const centerX = Number(transform.x);
        const centerY = Number(transform.y);
        const radius = this.computeTargetShieldRingRadius(ecs, targetEntity);
        const attackerPosition = this.resolveAttackerWorldPosition(ecs, networkSystem, attackerId);
        const direction = this.resolveShieldHitDirection(
          centerX,
          centerY,
          fallbackPosition,
          attackerPosition,
          entityKey,
          timeSeedMs
        );

        return {
          x: centerX + direction.x * radius,
          y: centerY + direction.y * radius,
          rotation: Math.atan2(direction.y, direction.x)
        };
      }
    }

    if (fallbackPosition) {
      const x = Number(fallbackPosition.x);
      const y = Number(fallbackPosition.y);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        return { x, y, rotation: 0 };
      }
    }

    return null;
  }

  private computeTargetShieldRingRadius(ecs: any, targetEntity: any): number {
    const animatedSprite = ecs.getComponent(targetEntity, AnimatedSprite);
    const sprite = ecs.getComponent(targetEntity, Sprite);
    const transform = ecs.getComponent(targetEntity, Transform);

    const baseWidth = animatedSprite
      ? Number(animatedSprite.width)
      : (sprite ? Number(sprite.width) : 0);
    const baseHeight = animatedSprite
      ? Number(animatedSprite.height)
      : (sprite ? Number(sprite.height) : 0);

    const maxBaseSize = Math.max(0, baseWidth, baseHeight);
    const averageTransformScale = transform
      ? (Math.abs(Number(transform.scaleX || 1)) + Math.abs(Number(transform.scaleY || 1))) * 0.5
      : 1;

    const rawRadius = maxBaseSize > 0
      ? maxBaseSize * Math.max(0.25, this.SHIELD_HIT_RING_RATIO) * Math.max(0.5, averageTransformScale)
      : 58;

    return Math.max(this.SHIELD_HIT_MIN_RADIUS, Math.min(this.SHIELD_HIT_MAX_RADIUS, rawRadius));
  }

  private resolveShieldHitDirection(
    centerX: number,
    centerY: number,
    fallbackPosition: { x: number; y: number } | undefined,
    attackerPosition: { x: number; y: number } | null,
    entityKey: string,
    timeSeedMs: number
  ): { x: number; y: number } {
    if (attackerPosition) {
      const dx = Number(attackerPosition.x) - centerX;
      const dy = Number(attackerPosition.y) - centerY;
      const length = Math.hypot(dx, dy);
      if (length > 4) {
        return { x: dx / length, y: dy / length };
      }
    }

    if (fallbackPosition) {
      const dx = Number(fallbackPosition.x) - centerX;
      const dy = Number(fallbackPosition.y) - centerY;
      const length = Math.hypot(dx, dy);
      if (length > 4) {
        return { x: dx / length, y: dy / length };
      }
    }

    // Fallback deterministic direction so the effect stays on the ring even when impact point is not informative.
    const seedSource = `${entityKey}:${Math.floor(timeSeedMs / this.SHIELD_HIT_EFFECT_COOLDOWN_MS)}`;
    let hash = 2166136261;
    for (let i = 0; i < seedSource.length; i++) {
      hash ^= seedSource.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    const normalized = (hash >>> 0) / 4294967295;
    const angle = normalized * Math.PI * 2;

    return { x: Math.cos(angle), y: Math.sin(angle) };
  }

  private resolveAttackerWorldPosition(
    ecs: any,
    networkSystem: ClientNetworkSystem,
    attackerId: unknown
  ): { x: number; y: number } | null {
    const normalizedAttackerId = String(attackerId ?? '').trim();
    if (!normalizedAttackerId) return null;

    // Ignore synthetic/environmental attackers without position context.
    if (
      normalizedAttackerId === 'server' ||
      normalizedAttackerId === 'radiation' ||
      normalizedAttackerId === 'environment'
    ) {
      return null;
    }

    // 1) NPC attacker (most common when local player is being hit).
    const remoteNpcSystem = networkSystem.getRemoteNpcSystem();
    if (remoteNpcSystem) {
      const npcEntityId = remoteNpcSystem.getRemoteNpcEntity(normalizedAttackerId);
      if (npcEntityId !== undefined) {
        const npcEntity = ecs.getEntity(npcEntityId);
        if (npcEntity) {
          const npcTransform = ecs.getComponent(npcEntity, Transform);
          if (npcTransform) {
            return { x: Number(npcTransform.x), y: Number(npcTransform.y) };
          }
        }
      }
    }

    // 2) Player attacker by clientId.
    if (typeof (networkSystem as any).findAnyPlayerEntity === 'function') {
      const attackerEntity = (networkSystem as any).findAnyPlayerEntity(normalizedAttackerId);
      if (attackerEntity) {
        const attackerTransform = ecs.getComponent(attackerEntity, Transform);
        if (attackerTransform) {
          return { x: Number(attackerTransform.x), y: Number(attackerTransform.y) };
        }
      }
    }

    // 3) Local player fallback when attackerId arrives as authId instead of clientId.
    const localAuthId = String(networkSystem.gameContext?.authId ?? '').trim();
    const localClientId = String(networkSystem.getLocalClientId() ?? '').trim();
    if (
      normalizedAttackerId &&
      (normalizedAttackerId === localAuthId || normalizedAttackerId === localClientId)
    ) {
      const localEntity = networkSystem.getPlayerSystem()?.getPlayerEntity();
      if (localEntity) {
        const localTransform = ecs.getComponent(localEntity, Transform);
        if (localTransform) {
          return { x: Number(localTransform.x), y: Number(localTransform.y) };
        }
      }
    }

    return null;
  }

  private async spawnShieldHitEffect(
    ecs: any,
    worldX: number,
    worldY: number,
    rotation: number
  ): Promise<void> {
    if (!ecs) return;
    const frames = await this.loadShieldHitFrames();
    if (!frames || frames.length === 0) return;

    const effectEntity = ecs.createEntity();
    ecs.addComponent(
      effectEntity,
      Transform,
      new Transform(worldX, worldY, rotation, 1, 1)
    );
    ecs.addComponent(
      effectEntity,
      Explosion,
      new Explosion(
        frames,
        this.SHIELD_HIT_EFFECT_FRAME_MS,
        1,
        this.SHIELD_HIT_EFFECT_RENDER_SCALE,
        true,
        this.SHIELD_HIT_EFFECT_ROTATION_OFFSET
      )
    );
  }

  private async loadShieldHitFrames(): Promise<HTMLImageElement[]> {
    if (EntityDamagedHandler.shieldHitFramesCache && EntityDamagedHandler.shieldHitFramesCache.length > 0) {
      return EntityDamagedHandler.shieldHitFramesCache;
    }

    if (!EntityDamagedHandler.shieldHitFramesPromise) {
      EntityDamagedHandler.shieldHitFramesPromise = (async () => {
        try {
          const atlasData = await AtlasParser.parseAtlas(this.SHIELD_HIT_EFFECT_ATLAS_PATH);
          const frames = await AtlasParser.extractFrames(atlasData);
          const validFrames = frames.filter((frame) => frame && frame.complete && frame.naturalWidth > 0);
          EntityDamagedHandler.shieldHitFramesCache = validFrames;
          return validFrames;
        } catch (error) {
          if (import.meta.env.DEV) {
            console.warn('[EntityDamagedHandler] Failed to load shield hit effect atlas', error);
          }
          return [];
        } finally {
          EntityDamagedHandler.shieldHitFramesPromise = null;
        }
      })();
    }

    const frames = await EntityDamagedHandler.shieldHitFramesPromise;
    if (frames && frames.length > 0 && !EntityDamagedHandler.shieldHitFramesCache) {
      EntityDamagedHandler.shieldHitFramesCache = frames;
    }
    return frames || [];
  }
}
