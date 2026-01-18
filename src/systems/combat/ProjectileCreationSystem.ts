import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { Transform } from '../../entities/spatial/Transform';
import { Damage } from '../../entities/combat/Damage';
import { Projectile } from '../../entities/combat/Projectile';
import { AnimatedSprite } from '../../entities/AnimatedSprite';
import { Velocity } from '../../entities/spatial/Velocity';
import { ClientNetworkSystem } from '../../multiplayer/client/ClientNetworkSystem';
import { GAME_CONSTANTS } from '../../config/GameConstants';
import { ProjectileFactory } from '../../core/domain/ProjectileFactory';
import AudioSystem from '../audio/AudioSystem';
import { PlayerSystem } from '../player/PlayerSystem';
import { calculateDirection } from '../../utils/MathUtils';
import { IDGenerator } from '../../core/utils/IDGenerator';

/**
 * Sistema dedicato alla creazione di proiettili
 * Responsabilità: Creazione e configurazione proiettili, sincronizzazione rete
 * Segue il principio Single Responsibility
 */
export class ProjectileCreationSystem extends BaseSystem {
  private clientNetworkSystem: ClientNetworkSystem | null = null;
  private audioSystem: AudioSystem | null = null;
  private playerSystem: PlayerSystem | null = null;

  constructor(ecs: ECS) {
    super(ecs);
  }

  /**
   * Imposta il sistema di rete per notifiche multiplayer
   */
  setClientNetworkSystem(clientNetworkSystem: ClientNetworkSystem): void {
    this.clientNetworkSystem = clientNetworkSystem;
  }

  /**
   * Imposta il sistema audio per suoni di sparo
   */
  setAudioSystem(audioSystem: AudioSystem): void {
    this.audioSystem = audioSystem;
  }

  /**
   * Imposta il riferimento al player system
   */
  setPlayerSystem(playerSystem: PlayerSystem): void {
    this.playerSystem = playerSystem;
  }

  /**
   * ❌ DEPRECATED: Non creare più proiettili dal client
   * ✅ BEST PRACTICE: Solo il server crea proiettili (server-authoritative)
   * Il client dichiara solo INTENTO di attaccare, non decide quando sparare
   */
  performAttack(attackerEntity: Entity, attackerTransform: Transform, attackerDamage: Damage, targetTransform: Transform, targetEntity: Entity): void {
    // 🚫 CLIENT NON CREA PIÙ PROIETTILI
    // Il server decide quando sparare basandosi su isAttacking state

    // Solo per backward compatibility - non fare nulla
    // I proiettili vengono creati dal SERVER quando riceve start_combat
  }

  /**
   * Crea un singolo laser per il player
   */
  private createSingleLaser(attackerEntity: Entity, attackerTransform: Transform, attackerDamage: Damage, targetTransform: Transform, targetEntity: Entity, directionX: number, directionY: number): void {
    // Crea singolo laser con danno completo
    const laserDamage = attackerDamage.damage;
    this.createProjectileAt(attackerEntity, attackerTransform, laserDamage, directionX, directionY, targetEntity);

    // Registra l'attacco per il cooldown
    attackerDamage.performAttack(Date.now());
  }

  /**
   * Crea un proiettile in una posizione e direzione specifica
   * Crea un singolo proiettile per il player
   */
  private createProjectileAt(attackerEntity: Entity, attackerTransform: Transform, damage: number, directionX: number, directionY: number, targetEntity: Entity): void {
    // Determina se è il player locale
    const playerEntity = this.playerSystem?.getPlayerEntity();
    const isLocalPlayer = playerEntity && attackerEntity.id === playerEntity.id;

    // Ottieni AnimatedSprite se disponibile (per calcolare punto di spawn dalla nave)
    const animatedSprite = this.ecs.getComponent(attackerEntity, AnimatedSprite);

    // Calcola posizione target per la factory
    const targetX = attackerTransform.x + directionX * GAME_CONSTANTS.PROJECTILE.SPAWN_OFFSET * 2;
    const targetY = attackerTransform.y + directionY * GAME_CONSTANTS.PROJECTILE.SPAWN_OFFSET * 2;

    if (isLocalPlayer) {
      // 🚫 PLAYER LOCALE: NON creare proiettili localmente!
      // I proiettili del player vengono creati SOLO dal server (server-authoritative)
      // Il ProjectileFiredHandler li aggiungerà al RemoteProjectileSystem quando arrivano dal server
      return;
    } else {
      // NPC: crea singolo laser
      const projectileId = IDGenerator.generateProjectileId(attackerEntity.id.toString());
      const projectileEntity = ProjectileFactory.createLaser(
        this.ecs,
        damage,
        attackerTransform.x,
        attackerTransform.y,
        targetX,
        targetY,
        attackerEntity.id,
        targetEntity.id,
        isLocalPlayer && this.clientNetworkSystem ? this.clientNetworkSystem.getLocalClientId() : `npc_${attackerEntity.id}`,
        animatedSprite || undefined,
        attackerTransform.rotation
      );
      const projectileComponent = this.ecs.getComponent(projectileEntity, Projectile);
      if (projectileComponent) {
        (projectileComponent as any).id = projectileId;
      }
    }

    // 🚫 CLIENT NON INVIA PIÙ projectile_fired PER IL PLAYER
    // Il server gestisce tutti i proiettili del player in modalità Server Authoritative
    // Solo gli NPC inviano projectile_fired per sincronizzazione
  }

  /**
   * Aggiornamento periodico (implementazione dell'interfaccia System)
   */
  update(deltaTime: number): void {
    // ProjectileCreationSystem non ha aggiornamenti periodici,
    // ma deve implementare l'interfaccia System
  }

  /**
   * Cleanup delle risorse
   */
  public destroy(): void {
    this.clientNetworkSystem = null;
    this.audioSystem = null;
    this.playerSystem = null;
  }
}