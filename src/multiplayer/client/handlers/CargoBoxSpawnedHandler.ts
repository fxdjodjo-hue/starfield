import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES, type CargoBoxSpawnedMessage } from '../../../config/NetworkConfig';

export class CargoBoxSpawnedHandler extends BaseMessageHandler {
    constructor() {
        super(MESSAGE_TYPES.CARGO_BOX_SPAWNED);
    }

    handle(message: CargoBoxSpawnedMessage, networkSystem: ClientNetworkSystem): void {
        const id = typeof message?.id === 'string' ? message.id : '';
        if (!id) return;

        const x = Number(message?.x);
        const y = Number(message?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;

        const resourceInteractionSystem = networkSystem.getResourceInteractionSystem();
        if (!resourceInteractionSystem) return;

        resourceInteractionSystem.addCargoBox({
            id,
            x,
            y,
            npcType: typeof message?.npcType === 'string' ? message.npcType : 'unknown',
            killerClientId: typeof message?.killerClientId === 'string' ? message.killerClientId : undefined,
            exclusiveUntil: Number(message?.exclusiveUntil) || 0,
            expiresAt: Number(message?.expiresAt) || 0
        });
    }
}
