/**
 * CollectionManager - Gestione centralizzata delle collezioni Map/Set
 * Sostituisce new Map(), .set(), .get(), .has() ripetuti in tutto il progetto
 */

export interface CollectionStats {
  size: number;
  keys: string[];
  memoryUsage?: number;
}

export class CollectionManager {
  /**
   * Crea una nuova Map con gestione errori integrata
   */
  static createMap<K, V>(initialEntries?: Iterable<readonly [K, V]>): Map<K, V> {
    try {
      return new Map(initialEntries);
    } catch (error) {
      console.error('CollectionManager: Failed to create Map:', error);
      return new Map();
    }
  }

  /**
   * Crea una nuova Set con gestione errori integrata
   */
  static createSet<T>(initialValues?: Iterable<T>): Set<T> {
    try {
      return new Set(initialValues);
    } catch (error) {
      console.error('CollectionManager: Failed to create Set:', error);
      return new Set();
    }
  }

  /**
   * Imposta un valore in una Map con controllo errori
   */
  static set<K, V>(map: Map<K, V>, key: K, value: V): boolean {
    try {
      map.set(key, value);
      return true;
    } catch (error) {
      console.error('CollectionManager: Failed to set value:', error);
      return false;
    }
  }

  /**
   * Ottiene un valore da una Map con valore di default
   */
  static get<K, V>(map: Map<K, V>, key: K, defaultValue?: V): V | undefined {
    try {
      return map.has(key) ? map.get(key) : defaultValue;
    } catch (error) {
      console.error('CollectionManager: Failed to get value:', error);
      return defaultValue;
    }
  }

  /**
   * Verifica se una chiave esiste in una Map
   */
  static has<K, V>(map: Map<K, V>, key: K): boolean {
    try {
      return map.has(key);
    } catch (error) {
      console.error('CollectionManager: Failed to check key existence:', error);
      return false;
    }
  }

  /**
   * Rimuove una chiave da una Map
   */
  static delete<K, V>(map: Map<K, V>, key: K): boolean {
    try {
      return map.delete(key);
    } catch (error) {
      console.error('CollectionManager: Failed to delete key:', error);
      return false;
    }
  }

  /**
   * Aggiunge un valore a un Set
   */
  static add<T>(set: Set<T>, value: T): boolean {
    try {
      set.add(value);
      return true;
    } catch (error) {
      console.error('CollectionManager: Failed to add value to set:', error);
      return false;
    }
  }

  /**
   * Ottiene tutte le chiavi di una Map come array
   */
  static getKeys<K, V>(map: Map<K, V>): K[] {
    try {
      return Array.from(map.keys());
    } catch (error) {
      console.error('CollectionManager: Failed to get keys:', error);
      return [];
    }
  }

  /**
   * Ottiene tutti i valori di una Map come array
   */
  static getValues<K, V>(map: Map<K, V>): V[] {
    try {
      return Array.from(map.values());
    } catch (error) {
      console.error('CollectionManager: Failed to get values:', error);
      return [];
    }
  }

  /**
   * Ottiene tutte le entries di una Map come array
   */
  static getEntries<K, V>(map: Map<K, V>): [K, V][] {
    try {
      return Array.from(map.entries());
    } catch (error) {
      console.error('CollectionManager: Failed to get entries:', error);
      return [];
    }
  }

  /**
   * Trova il primo elemento che soddisfa una condizione
   */
  static find<K, V>(map: Map<K, V>, predicate: (value: V, key: K) => boolean): V | undefined {
    try {
      for (const [key, value] of map.entries()) {
        if (predicate(value, key)) {
          return value;
        }
      }
      return undefined;
    } catch (error) {
      console.error('CollectionManager: Failed to find element:', error);
      return undefined;
    }
  }

  /**
   * Filtra elementi di una Map
   */
  static filter<K, V>(map: Map<K, V>, predicate: (value: V, key: K) => boolean): Map<K, V> {
    try {
      const result = new Map<K, V>();
      for (const [key, value] of map.entries()) {
        if (predicate(value, key)) {
          result.set(key, value);
        }
      }
      return result;
    } catch (error) {
      console.error('CollectionManager: Failed to filter elements:', error);
      return new Map();
    }
  }

  /**
   * Svuota completamente una Map
   */
  static clear<K, V>(map: Map<K, V>): void {
    try {
      map.clear();
    } catch (error) {
      console.error('CollectionManager: Failed to clear map:', error);
    }
  }

  /**
   * Svuota completamente un Set
   */
  static clearSet<T>(set: Set<T>): void {
    try {
      set.clear();
    } catch (error) {
      console.error('CollectionManager: Failed to clear set:', error);
    }
  }

  /**
   * Ottiene statistiche su una Map
   */
  static getStats<K, V>(map: Map<K, V>): CollectionStats {
    try {
      const keys = this.getKeys(map);
      return {
        size: map.size,
        keys: keys.map(k => String(k))
      };
    } catch (error) {
      console.error('CollectionManager: Failed to get stats:', error);
      return { size: 0, keys: [] };
    }
  }

  /**
   * Clona una Map (shallow copy)
   */
  static cloneMap<K, V>(map: Map<K, V>): Map<K, V> {
    try {
      return new Map(map);
    } catch (error) {
      console.error('CollectionManager: Failed to clone map:', error);
      return new Map();
    }
  }

  /**
   * Clona un Set (shallow copy)
   */
  static cloneSet<T>(set: Set<T>): Set<T> {
    try {
      return new Set(set);
    } catch (error) {
      console.error('CollectionManager: Failed to clone set:', error);
      return new Set();
    }
  }

  /**
   * Unisce due Map (la seconda sovrascrive i valori della prima)
   */
  static mergeMaps<K, V>(map1: Map<K, V>, map2: Map<K, V>): Map<K, V> {
    try {
      const result = this.cloneMap(map1);
      for (const [key, value] of map2.entries()) {
        result.set(key, value);
      }
      return result;
    } catch (error) {
      console.error('CollectionManager: Failed to merge maps:', error);
      return new Map();
    }
  }

  /**
   * Converte una Map in oggetto semplice
   */
  static mapToObject<K extends string | number | symbol, V>(map: Map<K, V>): Record<string, V> {
    try {
      const obj: Record<string, V> = {};
      for (const [key, value] of map.entries()) {
        obj[String(key)] = value;
      }
      return obj;
    } catch (error) {
      console.error('CollectionManager: Failed to convert map to object:', error);
      return {};
    }
  }

  /**
   * Converte un oggetto in Map
   */
  static objectToMap<V>(obj: Record<string, V>): Map<string, V> {
    try {
      return new Map(Object.entries(obj));
    } catch (error) {
      console.error('CollectionManager: Failed to convert object to map:', error);
      return new Map();
    }
  }
}