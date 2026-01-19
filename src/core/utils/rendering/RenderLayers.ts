/**
 * Sistema di layer di rendering per garantire ordine corretto degli elementi visivi
 *
 * I layer sono organizzati con valori numerici crescenti:
 * - Layer più bassi vengono renderizzati prima (in background)
 * - Layer più alti vengono renderizzati dopo (in foreground)
 *
 * Ogni layer ha un valore base e può avere sottolayer per elementi specifici
 * all'interno dello stesso layer (es. diversi tipi di effetti).
 */

export enum RenderLayer {
  // Sfondo e elementi ambientali
  BACKGROUND = 0,        // Stelle, nebulose, sfondi statici
  PARALLAX_NEAR = 5,     // Layer parallasse vicini (stelle piccole)
  PARALLAX_FAR = 8,      // Layer parallasse lontani (stelle grandi)

  // Ambiente di gioco
  ENVIRONMENT = 10,      // Asteroidi, stazioni spaziali, portali
  ENVIRONMENT_DECOR = 15, // Decorazioni ambientali (particelle, detriti)

  // Elementi di gioco principali
  PROJECTILES = 20,      // Tutti i proiettili (laser, missili)
  PROJECTILES_BACKGROUND = 22, // Proiettili che dovrebbero apparire dietro le navi
  PROJECTILES_FOREGROUND = 25, // Proiettili che dovrebbero apparire davanti alle navi

  // Navi e personaggi
  SHIPS = 30,           // Navi player e NPC
  SHIPS_DECALS = 35,    // Decals sulle navi (danni, effetti)

  // Effetti visivi
  EFFECTS = 40,         // Esplosioni, riparazioni, particelle
  EFFECTS_OVERLAY = 45, // Effetti che vanno sopra tutto nel layer effects

  // Interfaccia utente
  UI_BACKGROUND = 50,   // Sfondo HUD
  UI = 55,             // Elementi HUD principali
  UI_OVERLAY = 60,     // Menu, popup, notifiche
  UI_FOREGROUND = 65   // Elementi sempre in primo piano
}

/**
 * Utilità per lavorare con i layer di rendering
 */
export class RenderLayerUtils {
  /**
   * Verifica se un layer è valido
   */
  static isValidLayer(layer: number): boolean {
    return Object.values(RenderLayer).includes(layer as RenderLayer);
  }

  /**
   * Ottiene il nome descrittivo di un layer
   */
  static getLayerName(layer: RenderLayer): string {
    const names: Record<RenderLayer, string> = {
      [RenderLayer.BACKGROUND]: 'Background',
      [RenderLayer.PARALLAX_NEAR]: 'Parallax Near',
      [RenderLayer.PARALLAX_FAR]: 'Parallax Far',
      [RenderLayer.ENVIRONMENT]: 'Environment',
      [RenderLayer.ENVIRONMENT_DECOR]: 'Environment Decor',
      [RenderLayer.PROJECTILES]: 'Projectiles',
      [RenderLayer.PROJECTILES_BACKGROUND]: 'Projectiles Background',
      [RenderLayer.PROJECTILES_FOREGROUND]: 'Projectiles Foreground',
      [RenderLayer.SHIPS]: 'Ships',
      [RenderLayer.SHIPS_DECALS]: 'Ships Decals',
      [RenderLayer.EFFECTS]: 'Effects',
      [RenderLayer.EFFECTS_OVERLAY]: 'Effects Overlay',
      [RenderLayer.UI_BACKGROUND]: 'UI Background',
      [RenderLayer.UI]: 'UI',
      [RenderLayer.UI_OVERLAY]: 'UI Overlay',
      [RenderLayer.UI_FOREGROUND]: 'UI Foreground'
    };
    return names[layer] || `Unknown Layer (${layer})`;
  }

  /**
   * Ottiene la priorità di rendering (più alto = renderizzato dopo)
   */
  static getRenderPriority(layer: RenderLayer): number {
    return layer;
  }

  /**
   * Confronta due layer per determinare l'ordine di rendering
   * @returns -1 se layerA viene prima, 1 se layerB viene prima, 0 se uguali
   */
  static compareLayers(layerA: RenderLayer, layerB: RenderLayer): number {
    const priorityA = this.getRenderPriority(layerA);
    const priorityB = this.getRenderPriority(layerB);

    if (priorityA < priorityB) return -1;
    if (priorityA > priorityB) return 1;
    return 0;
  }

  /**
   * Verifica se un layer è relativo all'interfaccia utente
   */
  static isUILayer(layer: RenderLayer): boolean {
    return layer >= RenderLayer.UI_BACKGROUND;
  }

  /**
   * Verifica se un layer è relativo al gameplay (non UI)
   */
  static isGameLayer(layer: RenderLayer): boolean {
    return layer < RenderLayer.UI_BACKGROUND;
  }

  /**
   * Verifica se un layer è relativo ai proiettili
   */
  static isProjectileLayer(layer: RenderLayer): boolean {
    return layer >= RenderLayer.PROJECTILES && layer <= RenderLayer.PROJECTILES_FOREGROUND;
  }

  /**
   * Verifica se un layer è relativo agli effetti
   */
  static isEffectLayer(layer: RenderLayer): boolean {
    return layer >= RenderLayer.EFFECTS && layer <= RenderLayer.EFFECTS_OVERLAY;
  }
}