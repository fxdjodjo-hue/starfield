/**
 * Configurazione versione del gioco Starfield
 */
export const VERSION = {
  major: 0,
  minor: 1,
  patch: 0,
  stage: ''
} as const;

/**
 * Restituisce la versione formattata del gioco
 */
export function getFormattedVersion(): string {
  const { major, minor, patch, stage } = VERSION;
  const stageSuffix = stage ? `-${stage}` : '';
  return `${major}.${minor}.${patch}${stageSuffix}`;
}

/**
 * Restituisce il nome completo del gioco con versione
 */
export function getFullGameTitle(): string {
  return `STARFIELD v${getFormattedVersion()}`;
}
