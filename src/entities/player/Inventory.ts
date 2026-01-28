import { Component } from '../../infrastructure/ecs/Component';
import { ItemSlot } from '../../config/ItemConfig';

export interface InventoryItem {
    id: string;      // Riferimento a ITEM_REGISTRY
    instanceId: string; // ID univoco per questa istanza dell'oggetto
    acquiredAt: number;
}

/**
 * Componente Inventory - Gestisce gli oggetti posseduti e le parti equipaggiate
 */
export class Inventory extends Component {
    public items: InventoryItem[] = [];
    public equipped: { [key in ItemSlot]?: string } = {}; // Mapping slot -> instanceId

    constructor() {
        super();
        this.items = [];
        this.equipped = {};
    }

    /**
     * Sincronizza l'inventario con i dati dal server (per hydration iniziale o update)
     */
    sync(serverItems: Array<{ id: string; instanceId: string; acquiredAt: number; slot: string | null }>): void {
        this.items = serverItems.map(item => ({
            id: item.id,
            instanceId: item.instanceId,
            acquiredAt: item.acquiredAt
        }));

        // Ricostruisce la mappa equipped dagli slot salvati
        this.equipped = {};
        for (const item of serverItems) {
            if (item.slot && item.slot !== 'null' && item.slot !== 'NONE') {
                this.equipped[item.slot as ItemSlot] = item.instanceId;
            }
        }
    }

    /**
     * Aggiunge un oggetto all'inventario
     */
    addItem(itemId: string): string {
        const instanceId = Math.random().toString(36).substring(2, 9);
        this.items.push({
            id: itemId,
            instanceId,
            acquiredAt: Date.now()
        });
        return instanceId;
    }

    /**
     * Rimuove un oggetto dall'inventario
     */
    removeItem(instanceId: string): void {
        this.items = this.items.filter(item => item.instanceId !== instanceId);

        // Se era equipaggiato, lo rimuove dallo slot
        for (const slot in this.equipped) {
            if (this.equipped[slot as ItemSlot] === instanceId) {
                delete this.equipped[slot as ItemSlot];
            }
        }
    }

    /**
     * Equipaggia un oggetto in uno slot specifico
     */
    equipItem(instanceId: string, slot: ItemSlot): boolean {
        const item = this.items.find(i => i.instanceId === instanceId);
        if (!item || slot === ItemSlot.NONE) return false;

        this.equipped[slot] = instanceId;
        return true;
    }

    /**
     * Rimuove l'equipaggiamento da uno slot
     */
    unequipSlot(slot: ItemSlot): void {
        delete this.equipped[slot];
    }

    /**
     * Ritorna l'ID dell'oggetto (dal registry) equipaggiato in uno slot
     */
    getEquippedItemId(slot: ItemSlot): string | undefined {
        const instanceId = this.equipped[slot];
        if (!instanceId) return undefined;
        return this.items.find(i => i.instanceId === instanceId)?.id;
    }
}
