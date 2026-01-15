import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Entity } from '../../infrastructure/ecs/Entity';
import { Transform } from '../../entities/spatial/Transform';
import { Damage } from '../../entities/combat/Damage';
import { Projectile } from '../../entities/combat/Projectile';
import { Velocity } from '../../entities/spatial/Velocity';
import { ClientNetworkSystem } from '../../multiplayer/client/ClientNetworkSystem';
import { GAME_CONSTANTS } from '../../config/GameConstants';
import { ProjectileFactory } from '../../factories/ProjectileFactory';
import AudioSystem from '../audio/AudioSystem';
import { PlayerSystem } from '../player/PlayerSystem';
import { calculateDirection } from '../../utils/MathUtils';

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
    console.log(`[ProjectileCreation] ⚠️ performAttack called but client no longer creates projectiles`);

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
   */
  private createProjectileAt(attackerEntity: Entity, attackerTransform: Transform, damage: number, directionX: number, directionY: number, targetEntity: Entity): void {
    // Genera ID univoco per il proiettile (per sincronizzazione multiplayer)
    const projectileId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Determina se è il player locale
    const playerEntity = this.playerSystem?.getPlayerEntity();
    const isLocalPlayer = playerEntity && attackerEntity.id === playerEntity.id;

    // Calcola posizione target per la factory
    const targetX = attackerTransform.x + directionX * GAME_CONSTANTS.PROJECTILE.SPAWN_OFFSET * 2;
    const targetY = attackerTransform.y + directionY * GAME_CONSTANTS.PROJECTILE.SPAWN_OFFSET * 2;

    // Crea proiettile usando factory centralizzata
    const projectileEntity = ProjectileFactory.createProjectile(
      this.ecs,
      damage,
      attackerTransform.x,
      attackerTransform.y,
      targetX,
      targetY,
      attackerEntity.id,
      targetEntity.id,
      isLocalPlayer && this.clientNetworkSystem ? this.clientNetworkSystem.getLocalClientId() : `npc_${attackerEntity.id}`
    );

    // Aggiungi ID univoco al proiettile per tracking multiplayer
    const projectileComponent = this.ecs.getComponent(projectileEntity, Projectile);
    if (projectileComponent) {
      (projectileComponent as any).id = projectileId;
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