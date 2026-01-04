/**
 * Configurazione centralizzata dei pannelli UI
 * Definisce dimensioni, posizioni e proprietà di tutti i pannelli dell'applicazione
 * Questo assicura consistenza e facilita la manutenzione
 */

export interface PanelConfig {
  id: string;
  icon: string; // Unicode icon or CSS class
  title: string;
  position: 'top-left' | 'top-right' | 'center-left' | 'center-left-below' | 'center-left-below2' | 'bottom-left' | 'bottom-right';
  size: { width: number; height: number };
}

export const PANEL_CONFIGS = {
  stats: {
    id: 'player-stats',
    icon: '⊞',
    title: 'Player Statistics',
    position: 'center-left' as const,
    size: { width: 1300, height: 750 }
  },

  quest: {
    id: 'quest-panel',
    icon: '⊳',
    title: 'Missions & Quests',
    position: 'center-left-below' as const,
    size: { width: 1300, height: 750 }
  },

  skills: {
    id: 'skills-panel',
    icon: '⊹',
    title: 'Skills & Abilities',
    position: 'center-left-below2' as const,
    size: { width: 1300, height: 750 }
  }
} as const;

/**
 * Tipo per identificare i pannelli disponibili
 */
export type PanelType = keyof typeof PANEL_CONFIGS;

/**
 * Ottiene la configurazione di un pannello specifico
 */
export function getPanelConfig(type: PanelType): PanelConfig {
  return PANEL_CONFIGS[type];
}

/**
 * Ottiene tutte le configurazioni dei pannelli
 */
export function getAllPanelConfigs(): PanelConfig[] {
  return Object.values(PANEL_CONFIGS);
}

/**
 * Dimensioni standard per i pannelli principali
 * Garantisce consistenza tra tutti i pannelli
 */
export const STANDARD_PANEL_SIZE = {
  width: 1300,
  height: 750
} as const;

/**
 * Posizioni disponibili per le icone
 */
export const ICON_POSITIONS = {
  'center-left': 'center-left',
  'center-left-below': 'center-left-below',
  'center-left-below2': 'center-left-below2',
  'top-left': 'top-left',
  'top-right': 'top-right',
  'bottom-left': 'bottom-left',
  'bottom-right': 'bottom-right'
} as const;

export type IconPosition = typeof ICON_POSITIONS[keyof typeof ICON_POSITIONS];
