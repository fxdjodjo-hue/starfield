import { System as BaseSystem } from '../infrastructure/ecs/System';
import { ECS } from '../infrastructure/ecs/ECS';
import { Transform } from '../entities/spatial/Transform';
import { Velocity } from '../entities/spatial/Velocity';
import { Health } from '../entities/combat/Health';
import { Shield } from '../entities/combat/Shield';
import { Damage } from '../entities/combat/Damage';
import { Sprite } from '../entities/Sprite';
import { Npc } from '../entities/ai/Npc';
import { CONFIG } from '../utils/config/Config';
import { getNpcDefinition } from '../config/NpcConfig';

/**
 * Sistema Respawn NPC - Gestisce la rigenerazione degli NPC morti
 * Mantiene il gameplay dinamico ricreando NPC in posizioni sicure
 */
export class NpcRespawnSystem extends BaseSystem {
  // Coda di NPC da respawnare
  private respawnQueue: RespawnEntry[] = [];

  // Riferimento ai sistemi necessari
  private playerEntity: any = null;
  private gameContext: any = null;

  constructor(ecs: ECS, gameContext?: any) {
    super(ecs);
    this.gameContext = gameContext;
  }

  /**
   * Imposta il riferimento al player
   */
  setPlayerEntity(playerEntity: any): void {
    this.playerEntity = playerEntity;
  }

  /**
   * Pianifica il respawn di un NPC morto
   */
  scheduleRespawn(npcType: string, deathTime: number): void {
    this.respawnQueue.push({
      npcType,
      deathTime,
      respawnTime: deathTime + CONFIG.NPC_RESPAWN_DELAY
    });

    console.log(`🔄 NPC ${npcType} programmato per respawn tra ${CONFIG.NPC_RESPAWN_DELAY / 1000}s`);
  }

  update(deltaTime: number): void {
    if (!this.playerEntity) return;

    const currentTime = Date.now();

    // Controlla quali NPC sono pronti per il respawn
    const readyForRespawn = this.respawnQueue.filter(
      entry => currentTime >= entry.respawnTime
    );

    // Respawna gli NPC pronti (gestisce async internamente)
    if (readyForRespawn.length > 0) {
      // Avvia tutti i respawn in parallelo senza bloccare il main thread
      Promise.all(
        readyForRespawn.map(entry => this.respawnNpc(entry.npcType))
      ).catch(error => {
        console.error('Error during NPC respawn:', error);
      });

      // Rimuovi dalla coda gli NPC che stiamo respawnando
      this.respawnQueue = this.respawnQueue.filter(
        entry => currentTime < entry.respawnTime
      );
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Sistema puramente logico, nessun rendering necessario
  }

  /**
   * Respawna un NPC in una posizione sicura lontana dal player
   */
  private async respawnNpc(npcType: string): Promise<void> {
    if (!this.playerEntity) return;

    // Ottieni posizione del player
    const playerTransform = this.ecs.getComponent(this.playerEntity, Transform);
    if (!playerTransform) return;

    // Trova una posizione sicura per il respawn
    const spawnPosition = this.findSafeSpawnPosition(playerTransform);

    // Crea il nuovo NPC (ora async per caricare lo sprite)
    await this.createNpcAtPosition(npcType, spawnPosition.x, spawnPosition.y);

    console.log(`✨ Respawned ${npcType} at (${spawnPosition.x.toFixed(0)}, ${spawnPosition.y.toFixed(0)})`);
  }

  /**
   * Trova una posizione sicura per il respawn lontana dal player e da altri NPC
   */
  private findSafeSpawnPosition(playerTransform: Transform): { x: number, y: number } {
    const attempts = 20; // Numero massimo di tentativi

    for (let i = 0; i < attempts; i++) {
      // Genera posizione casuale intorno al player
      const angle = Math.random() * Math.PI * 2;
      const distance = CONFIG.NPC_RESPAWN_DISTANCE_MIN +
                      Math.random() * (CONFIG.NPC_RESPAWN_DISTANCE_MAX - CONFIG.NPC_RESPAWN_DISTANCE_MIN);

      const x = playerTransform.x + Math.cos(angle) * distance;
      const y = playerTransform.y + Math.sin(angle) * distance;

      // Verifica se la posizione è sicura (non troppo vicina ad altri NPC)
      if (this.isPositionSafe(x, y)) {
        return { x, y };
      }
    }

    // Se non trova posizione sicura, usa una posizione di fallback
    console.warn('⚠️ Could not find safe spawn position, using fallback');
    const fallbackAngle = Math.random() * Math.PI * 2;
    const fallbackDistance = CONFIG.NPC_RESPAWN_DISTANCE_MAX;
    return {
      x: playerTransform.x + Math.cos(fallbackAngle) * fallbackDistance,
      y: playerTransform.y + Math.sin(fallbackAngle) * fallbackDistance
    };
  }

  /**
   * Verifica se una posizione è sicura (lontana da altri NPC)
   */
  private isPositionSafe(x: number, y: number): boolean {
    const minDistanceFromOtherNpcs = 200; // Distanza minima da altri NPC

    // Controlla tutti gli NPC esistenti
    const npcs = this.ecs.getEntitiesWithComponents(Npc, Transform);
    for (const npcEntity of npcs) {
      const npcTransform = this.ecs.getComponent(npcEntity, Transform);
      if (!npcTransform) continue;

      const distance = Math.sqrt(
        Math.pow(x - npcTransform.x, 2) + Math.pow(y - npcTransform.y, 2)
      );

      if (distance < minDistanceFromOtherNpcs) {
        return false; // Troppo vicino a un altro NPC
      }
    }

    return true; // Posizione sicura
  }

  /**
   * Crea un NPC in una posizione specifica
   */
  private async createNpcAtPosition(npcType: string, x: number, y: number): Promise<void> {
    const npcDef = getNpcDefinition(npcType);
    if (!npcDef) {
      console.error(`No NPC definition found for type: ${npcType}`);
      return;
    }

    try {
      // Carica lo sprite per questo tipo di NPC
      const spriteImage = await this.loadNpcSprite(npcType);
      const sprite = new Sprite(spriteImage, spriteImage.width * 0.15, spriteImage.height * 0.15);

      // Crea l'entità NPC
      const npcEntity = this.ecs.createEntity();

      // Aggiungi componenti usando la configurazione
      this.ecs.addComponent(npcEntity, Transform, new Transform(x, y, 0));
      this.ecs.addComponent(npcEntity, Velocity, new Velocity(0, 0, 0));
      this.ecs.addComponent(npcEntity, Health, new Health(npcDef.stats.health, npcDef.stats.health));
      this.ecs.addComponent(npcEntity, Shield, new Shield(npcDef.stats.shield, npcDef.stats.shield));
      this.ecs.addComponent(npcEntity, Damage, new Damage(npcDef.stats.damage, npcDef.stats.range, npcDef.stats.cooldown));
      this.ecs.addComponent(npcEntity, Sprite, sprite); // AGGIUNGI LO SPRITE MANCANTE!
      this.ecs.addComponent(npcEntity, Npc, new Npc(npcDef.type, npcDef.defaultBehavior));

    } catch (error) {
      console.error(`Failed to respawn ${npcType}:`, error);
    }
  }

  /**
   * Carica lo sprite per un tipo specifico di NPC
   */
  private async loadNpcSprite(npcType: string): Promise<HTMLImageElement> {
    // Mappa dei percorsi degli sprite per ogni tipo di NPC
    const spritePaths: Record<string, string> = {
      'Scouter': '/assets/npc_ships/scouter/npc_scouter.png',
      // Aggiungi qui altri tipi di NPC quando necessari
    };

    const spritePath = spritePaths[npcType];
    if (!spritePath) {
      throw new Error(`No sprite path defined for NPC type: ${npcType}`);
    }

    return await this.gameContext.assetManager.loadImage(spritePath);
  }

  /**
   * Restituisce informazioni di debug sulla coda respawn
   */
  getRespawnQueueInfo(): { npcType: string, timeUntilRespawn: number }[] {
    const currentTime = Date.now();
    return this.respawnQueue.map(entry => ({
      npcType: entry.npcType,
      timeUntilRespawn: Math.max(0, entry.respawnTime - currentTime)
    }));
  }
}

/**
 * Interfaccia per le entry della coda respawn
 */
interface RespawnEntry {
  npcType: string;
  deathTime: number;
  respawnTime: number;
}
