import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';
import { MESSAGE_TYPES, type CargoBoxRemovedMessage } from '../../../config/NetworkConfig';

export class CargoBoxRemovedHandler extends BaseMessageHandler {
    constructor() {
        super(MESSAGE_TYPES.CARGO_BOX_REMOVED);
    }

    handle(message: CargoBoxRemovedMessage, networkSystem: ClientNetworkSystem): void {
        const cargoBoxId = typeof message?.cargoBoxId === 'string' ? message.cargoBoxId : '';
        if (!cargoBoxId) return;

        const resourceInteractionSystem = networkSystem.getResourceInteractionSystem();
        if (!resourceInteractionSystem) return;

        resourceInteractionSystem.removeCargoBox(cargoBoxId);
    }
}
