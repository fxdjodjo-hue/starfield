/**
 * Configurazione versione del gioco Starfield
 */
export const VERSION = {
  major: 0,
  minor: 1,
  patch: 0,
  stage: 'alpha'
} as const;

/**
 * Restituisce la versione formattata del gioco
 */
export function getFormattedVersion(): string {
  const { major, minor, patch, stage } = VERSION;
  return `${major}.${minor}.${patch}-${stage}`;
}

/**
 * Restituisce il nome completo del gioco con versione
 */
export function getFullGameTitle(): string {
  return `STARFIELD v${getFormattedVersion()}`;
}
