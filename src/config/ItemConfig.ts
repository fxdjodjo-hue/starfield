/**
 * Definizione del Sistema di Item
 * Centra tutti i dati degli oggetti in gioco e le loro proprietà
 */

export enum ItemType {
    EQUIPMENT = 'EQUIPMENT',
    CONSUMABLE = 'CONSUMABLE',
    RESOURCE = 'RESOURCE'
}

export enum ItemSlot {
    HULL = 'HULL',
    SHIELD = 'SHIELD',
    LASER = 'LASER',
    ENGINE = 'ENGINE',
    MISSILE = 'MISSILE',
    NONE = 'NONE'
}

export interface ItemStats {
    hpBonus?: number;       // Percentuale, es: 0.2 (+20%)
    shieldBonus?: number;   // Percentuale
    damageBonus?: number;   // Percentuale
    missileBonus?: number;  // Percentuale
    speedBonus?: number;    // Percentuale
}

export interface Item {
    id: string;
    name: string;
    description: string;
    type: ItemType;
    slot: ItemSlot;
    icon: string;        // Path all'icona o emoji fallback
    rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'LEGENDARY';
    stats: ItemStats;
}

import itemConfig from '../../shared/item-config.json';

/**
 * Registro degli Item Base (Caricati da configurazione condivisa)
 */
export const ITEM_REGISTRY: { [id: string]: Item } = itemConfig.ITEM_REGISTRY as any;

/**
 * Ottiene un item dal registro tramite ID
 */
export function getItem(id: string): Item | undefined {
    return ITEM_REGISTRY[id];
}

/**
 * Ottiene tutti gli item di un certo slot
 */
export function getItemsBySlot(slot: ItemSlot): Item[] {
    return Object.values(ITEM_REGISTRY).filter(item => item.slot === slot);
}
