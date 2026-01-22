import { Component } from '../../infrastructure/ecs/Component';

/**
 * Livelli di autorità per il multiplayer
 * Usa const object invece di enum per compatibilità con erasableSyntaxOnly
 */
export const AuthorityLevel = {
  SERVER_AUTHORITATIVE: 'server_authoritative',    // Solo server decide (movimento, combattimento)
  CLIENT_PREDICTIVE: 'client_predictive',          // Client predice, server corregge (input)
  CLIENT_LOCAL: 'client_local'                     // Solo client (UI, suoni, effetti locali)
} as const;

export type AuthorityLevel = typeof AuthorityLevel[keyof typeof AuthorityLevel];

/**
 * Componente Authority - definisce chi ha l'autorità su questa entity nel multiplayer
 */
export class Authority extends Component {
  public ownerId: string;                    // ID del giocatore che "possiede" questa entity
  public authorityLevel: AuthorityLevel;     // Livello di autorità
  public lastAuthorityUpdate: number;        // Timestamp ultima update di autorità
  public isPredicted: boolean;               // Se lo stato corrente è predetto (non confermato)

  constructor(ownerId: string, authorityLevel: AuthorityLevel = AuthorityLevel.SERVER_AUTHORITATIVE) {
    super();
    this.ownerId = ownerId;
    this.authorityLevel = authorityLevel;
    this.lastAuthorityUpdate = Date.now();
    this.isPredicted = false;
  }

  /**
   * Verifica se questa entity può essere controllata dal client locale
   */
  canBeControlledBy(localClientId: string): boolean {
    switch (this.authorityLevel) {
      case AuthorityLevel.CLIENT_LOCAL:
        return this.ownerId === localClientId;
      case AuthorityLevel.CLIENT_PREDICTIVE:
        return this.ownerId === localClientId;
      case AuthorityLevel.SERVER_AUTHORITATIVE:
      default:
        return false; // Solo server ha autorità
    }
  }

  /**
   * Verifica se questa entity deve essere sincronizzata con il server
   */
  needsSynchronization(): boolean {
    return this.authorityLevel !== AuthorityLevel.CLIENT_LOCAL;
  }

  /**
   * Aggiorna il timestamp dell'ultima modifica di autorità
   */
  updateAuthority(): void {
    this.lastAuthorityUpdate = Date.now();
  }

  /**
   * Marca lo stato come predetto (in attesa di conferma server)
   */
  markAsPredicted(): void {
    this.isPredicted = true;
    this.updateAuthority();
  }

  /**
   * Conferma lo stato dal server
   */
  confirmFromServer(): void {
    this.isPredicted = false;
    this.updateAuthority();
  }
}
