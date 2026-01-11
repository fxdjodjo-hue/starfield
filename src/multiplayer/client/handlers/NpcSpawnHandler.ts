import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../../config/NetworkConfig';

/**
 * Gestisce il messaggio npc_spawn quando un NPC viene respawnato dal server
 */
export class NpcSpawnHandler extends BaseMessageHandler {
  constructor() {
    super(MESSAGE_TYPES.NPC_SPAWN);
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    console.log(`[CLIENT] Received npc_spawn: ${message.npc.id} (${message.npc.type}) at ${message.npc.position.x.toFixed(0)},${message.npc.position.y.toFixed(0)}`);

    const remoteNpcSystem = networkSystem.getRemoteNpcSystem();
    if (!remoteNpcSystem) {
      console.error('[CLIENT] RemoteNpcSystem not available for NPC spawn');
      return;
    }

    // Aggiungi il nuovo NPC respawnato al sistema remoto
    const entityId = remoteNpcSystem.addRemoteNpc(
      message.npc.id,
      message.npc.type,
      message.npc.position.x,
      message.npc.position.y,
      message.npc.position.rotation,
      message.npc.health,
      message.npc.shield,
      message.npc.behavior
    );

    if (entityId === -1) {
      console.error(`❌ [CLIENT] Failed to create respawned NPC ${message.npc.id}`);
    } else {
    }
  }
}
