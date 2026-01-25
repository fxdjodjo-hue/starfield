/**
 * Configurazione versione del gioco Starfield
 * La versione viene iniettata automaticamente da Vite durante la build (da package.json)
 */

declare const __APP_VERSION__: string;

/**
 * Versione corrente del gioco (iniettata da Vite)
 */
export const VERSION = __APP_VERSION__;

/**
 * Restituisce la versione formattata del gioco
 */
export function getFormattedVersion(): string {
  return VERSION;
}

/**
 * Restituisce il nome completo del gioco con versione
 */
export function getFullGameTitle(): string {
  return `STARFIELD v${VERSION}`;
}
