/**
 * Configurazione centralizzata dei pannelli UI
 * Definisce dimensioni, posizioni e proprietà di tutti i pannelli dell'applicazione
 * Supporta dimensioni responsive basate sulla viewport
 */

import { DisplayManager } from '../../infrastructure/display';

/**
 * Dimensioni di riferimento per il design (base 1920x1080)
 */
const DESIGN_REFERENCE = {
  width: 1920,
  height: 1080,
} as const;

/**
 * Dimensioni base dei pannelli (riferimento per 1920x1080)
 */
const BASE_PANEL_SIZE = {
  width: 1500,
  height: 850,
} as const;

/**
 * Dimensioni speciali per pannelli che necessitano più spazio verticale
 */
const LARGE_PANEL_SIZE = {
  width: 1500,
  height: 1000, // 150px più alto per mostrare più righe leaderboard
} as const;

export interface PanelConfig {
  id: string;
  icon: string; // Unicode icon or CSS class (fallback)
  svgPath?: string; // Percorso per l'asset SVG
  title: string;
  position: 'top-left' | 'top-right' | 'center-left' | 'center-left-below' | 'center-left-below2' | 'center-left-below3' | 'center-left-below4' | 'center-left-below5' | 'center-left-col2' | 'center-left-col2-below' | 'center-left-col2-below2' | 'center-left-col2-below3' | 'center-left-col2-below4' | 'center-left-col2-below5' | 'bottom-left' | 'bottom-right';
  size: { width: number; height: number };
}

/**
 * Configurazioni base dei pannelli (dimensioni di riferimento)
 */
const PANEL_CONFIGS_BASE = {
  stats: {
    id: 'leaderboard',
    icon: '🏆',
    svgPath: 'assets/svg/gameUi/leaderboard-svgrepo-com.svg',
    title: 'Leaderboard',
    position: 'center-left' as const,
    size: { ...LARGE_PANEL_SIZE }
  },

  quest: {
    id: 'quest-panel',
    icon: '📜',
    svgPath: 'assets/svg/gameUi/dart-mission-goal-success-svgrepo-com.svg',
    title: 'Missions',
    position: 'center-left-below' as const,
    size: { ...LARGE_PANEL_SIZE }
  },

  upgrade: {
    id: 'upgrade-panel',
    icon: '⏫',
    svgPath: 'assets/svg/gameUi/upgrade-svgrepo-com.svg',
    title: 'Upgrade',
    position: 'center-left-below2' as const,
    size: { ...LARGE_PANEL_SIZE }
  },

  settings: {
    id: 'settings-panel',
    icon: '⚙️',
    svgPath: 'assets/svg/gameUi/settings-svgrepo-com.svg',
    title: 'Settings',
    position: 'center-left-below3' as const,
    size: { ...LARGE_PANEL_SIZE }
  },
  inventory: {
    id: 'inventory-panel',
    icon: '📦',
    svgPath: 'assets/svg/gameUi/spaceship-svgrepo-com.svg',
    title: 'Ship',
    position: 'center-left-below4' as const,
    size: { ...LARGE_PANEL_SIZE }
  },
  crafting: {
    id: 'crafting-panel',
    icon: '🛠️',
    svgPath: 'assets/svg/gameUi/craft-float-icon.png',
    title: 'Crafting',
    position: 'center-left-col2' as const,
    size: { ...LARGE_PANEL_SIZE }
  },
  pet: {
    id: 'pet-panel',
    icon: 'P',
    svgPath: 'assets/svg/gameUi/pet-float-icon.png',
    title: 'Pet',
    position: 'center-left-col2-below' as const,
    size: { ...LARGE_PANEL_SIZE }
  },
  logs: {
    id: 'log-panel',
    icon: 'L',
    title: 'Logs',
    position: 'center-left-col2-below2' as const,
    size: { ...BASE_PANEL_SIZE }
  }
} as const;

/**
 * Tipo per identificare i pannelli disponibili
 */
export type PanelType = keyof typeof PANEL_CONFIGS_BASE;

/**
 * Calcola le dimensioni scalate per un pannello basandosi sulla viewport corrente
 * Mantiene le proporzioni ma scala per adattarsi a schermi diversi
 * I pannelli modali NON necessitano compensazione DPR perché sono già dimensionati
 * in percentuale della viewport logica
 */
export function getScaledPanelSize(baseSize: { width: number; height: number }): { width: number; height: number } {
  const displayManager = DisplayManager.getInstance();
  const { width: viewportWidth, height: viewportHeight } = displayManager.getLogicalSize();

  // Calcola fattori di scala separati per width e height
  const scaleX = viewportWidth / DESIGN_REFERENCE.width;
  const scaleY = viewportHeight / DESIGN_REFERENCE.height;

  // Usa il fattore di scala minore per mantenere il pannello visibile
  // ma limita tra 0.6 e 1.2 per evitare estremi
  const scale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.6), 1.2);

  // Assicura che il pannello non superi l'85% della viewport
  const maxWidth = viewportWidth * 0.85;
  const maxHeight = viewportHeight * 0.85;

  const scaledWidth = Math.min(baseSize.width * scale, maxWidth);
  const scaledHeight = Math.min(baseSize.height * scale, maxHeight);

  return {
    width: Math.round(scaledWidth),
    height: Math.round(scaledHeight)
  };
}

/**
 * Ottiene la configurazione di un pannello con dimensioni scalate per la viewport corrente
 */
export function getPanelConfig(type: PanelType): PanelConfig {
  const baseConfig = PANEL_CONFIGS_BASE[type];
  return {
    ...baseConfig,
    size: getScaledPanelSize(baseConfig.size)
  };
}

/**
 * Ottiene tutte le configurazioni dei pannelli con dimensioni scalate
 */
export function getAllPanelConfigs(): PanelConfig[] {
  return (Object.keys(PANEL_CONFIGS_BASE) as PanelType[]).map(type => getPanelConfig(type));
}

/**
 * Ottiene le dimensioni standard scalate per i pannelli principali
 */
export function getStandardPanelSize(): { width: number; height: number } {
  return getScaledPanelSize(BASE_PANEL_SIZE);
}

/**
 * Esporta PANEL_CONFIGS per retrocompatibilità (usa dimensioni base)
 * Per dimensioni responsive, usa getPanelConfig() invece
 */
export const PANEL_CONFIGS = PANEL_CONFIGS_BASE;

/**
 * Dimensioni standard per i pannelli principali (base, non scalate)
 * Per dimensioni scalate usa getStandardPanelSize()
 */
export const STANDARD_PANEL_SIZE = BASE_PANEL_SIZE;

/**
 * Posizioni disponibili per le icone
 */
export const ICON_POSITIONS = {
  'center-left': 'center-left',
  'center-left-below': 'center-left-below',
  'center-left-below2': 'center-left-below2',
  'center-left-below3': 'center-left-below3',
  'center-left-below4': 'center-left-below4',
  'center-left-below5': 'center-left-below5',
  'center-left-col2': 'center-left-col2',
  'center-left-col2-below': 'center-left-col2-below',
  'center-left-col2-below2': 'center-left-col2-below2',
  'center-left-col2-below3': 'center-left-col2-below3',
  'center-left-col2-below4': 'center-left-col2-below4',
  'center-left-col2-below5': 'center-left-col2-below5',
  'top-left': 'top-left',
  'top-right': 'top-right',
  'bottom-left': 'bottom-left',
  'bottom-right': 'bottom-right'
} as const;

export type IconPosition = typeof ICON_POSITIONS[keyof typeof ICON_POSITIONS];
