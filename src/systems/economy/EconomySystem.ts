import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Credits } from '../../entities/currency/Credits';
import { Cosmos } from '../../entities/currency/Cosmos';
import { Experience } from '../../entities/currency/Experience';
import { Honor } from '../../entities/currency/Honor';
import { PlayerRole } from '../../entities/player/PlayerRole';

// Modular architecture managers
import { CurrencyManager } from '../../core/domain/economy/CurrencyManager';
import { ProgressionManager } from '../../core/domain/economy/ProgressionManager';
import { HonorManager } from '../../core/domain/economy/HonorManager';
import { EconomyEventManager } from '../../core/domain/economy/EconomyEventManager';
import { EconomyStatusManager } from '../../core/domain/economy/EconomyStatusManager';
import { EconomyUIDisplayManager } from '../../core/domain/economy/EconomyUIDisplayManager';

/**
 * Sistema Economy - gestisce l'economia completa del giocatore
 * Include Credits, Cosmos, Experience Points, Honor Points e progressione
 */
export class EconomySystem extends BaseSystem {
  private playerEntity: any = null;
  private rankSystem: any = null;

  // Managers
  private currencyManager!: CurrencyManager;
  private progressionManager!: ProgressionManager;
  private honorManager!: HonorManager;
  private statusManager!: EconomyStatusManager;
  private eventManager: EconomyEventManager;
  private uiDisplayManager!: EconomyUIDisplayManager;

  private managersInitialized: boolean = false;

  constructor(ecs: ECS) {
    super(ecs);
    this.eventManager = new EconomyEventManager();
  }

  /**
   * Inizializza i manager interni (lazy initialization)
   */
  private initializeManagers(): void {
    if (this.managersInitialized) return;

    // Initialize currency manager
    this.currencyManager = new CurrencyManager(
      this.ecs,
      () => this.playerEntity,
      (newAmount, change) => this.eventManager.getOnCreditsChanged()?.(newAmount, change),
      (newAmount, change) => this.eventManager.getOnCosmosChanged()?.(newAmount, change)
    );

    // Initialize progression manager
    this.progressionManager = new ProgressionManager(
      this.ecs,
      () => this.playerEntity,
      (newAmount, change, leveledUp) => this.eventManager.getOnExperienceChanged()?.(newAmount, change, leveledUp)
    );

    // Initialize honor manager
    this.honorManager = new HonorManager(
      this.ecs,
      () => this.playerEntity,
      () => this.rankSystem,
      (newAmount, change, newRank) => this.eventManager.getOnHonorChanged()?.(newAmount, change, newRank)
    );

    // Initialize status manager (depends on other managers)
    this.statusManager = new EconomyStatusManager(
      this.currencyManager,
      this.progressionManager,
      this.honorManager,
      () => this.rankSystem
    );

    // Initialize UI display manager (deprecated)
    this.uiDisplayManager = new EconomyUIDisplayManager();

    this.managersInitialized = true;
  }

  /**
   * Imposta l'entità player per il sistema valuta
   */
  setPlayerEntity(entity: any): void {
    this.playerEntity = entity;
  }

  /**
   * Imposta il riferimento al RankSystem
   */
  setRankSystem(rankSystem: any): void {
    this.rankSystem = rankSystem;
  }

  /**
   * Imposta RecentHonor nel RankSystem (media mobile honor ultimi 30 giorni)
   */
  setRecentHonor(recentHonor: number): void {
    this.initializeManagers();
    this.honorManager.setRecentHonor(recentHonor);
  }

  /**
   * Imposta i callbacks per quando i valori economici cambiano
   */
  setCreditsChangedCallback(callback: (newAmount: number, change: number) => void): void {
    this.initializeManagers();
    this.eventManager.setCreditsChangedCallback(callback);
    // Update currency manager with new callback
    this.currencyManager = new CurrencyManager(
      this.ecs,
      () => this.playerEntity,
      (newAmount, change) => this.eventManager.getOnCreditsChanged()?.(newAmount, change),
      (newAmount, change) => this.eventManager.getOnCosmosChanged()?.(newAmount, change)
    );
  }

  setCosmosChangedCallback(callback: (newAmount: number, change: number) => void): void {
    this.initializeManagers();
    this.eventManager.setCosmosChangedCallback(callback);
    // Update currency manager with new callback
    this.currencyManager = new CurrencyManager(
      this.ecs,
      () => this.playerEntity,
      (newAmount, change) => this.eventManager.getOnCreditsChanged()?.(newAmount, change),
      (newAmount, change) => this.eventManager.getOnCosmosChanged()?.(newAmount, change)
    );
  }

  setExperienceChangedCallback(callback: (newAmount: number, change: number, leveledUp: boolean) => void): void {
    this.initializeManagers();
    this.eventManager.setExperienceChangedCallback(callback);
    // Update progression manager with new callback
    this.progressionManager = new ProgressionManager(
      this.ecs,
      () => this.playerEntity,
      (newAmount, change, leveledUp) => this.eventManager.getOnExperienceChanged()?.(newAmount, change, leveledUp)
    );
  }

  setHonorChangedCallback(callback: (newAmount: number, change: number, newRank?: string) => void): void {
    this.initializeManagers();
    this.eventManager.setHonorChangedCallback(callback);
    // Update honor manager with new callback
    this.honorManager = new HonorManager(
      this.ecs,
      () => this.playerEntity,
      () => this.rankSystem,
      (newAmount, change, newRank) => this.eventManager.getOnHonorChanged()?.(newAmount, change, newRank)
    );
    // Update status manager with new honor manager
    this.statusManager = new EconomyStatusManager(
      this.currencyManager,
      this.progressionManager,
      this.honorManager,
      () => this.rankSystem
    );
  }


  /**
   * AGGIORNA lo stato dell'economia (chiamato dall'ECS)
   */
  update(deltaTime: number): void {
    if (!this.playerEntity) return;
    this.initializeManagers();

    // Aggiorna logicamente i componenti (solo se necessario)
  }

  /**
   * RESTITUISCE i crediti attuali del giocatore
   */
  getCredits(): number {
    this.initializeManagers();
    const credits = this.currencyManager.getPlayerCredits();
    return credits ? credits.credits : 0;
  }

  /**
   * AGGIUNGE crediti al giocatore
   */
  addCredits(amount: number, reason: string = 'unknown'): number {
    this.initializeManagers();
    return this.currencyManager.addCredits(amount, reason);
  }

  /**
   * IMPOSTA direttamente i crediti del giocatore
   */
  setCredits(amount: number, reason: string = 'server_update'): void {
    this.initializeManagers();
    this.currencyManager.setCredits(amount, reason);
  }

  /**
   * RESTITUISCE i Cosmos attuali del giocatore
   */
  getCosmos(): number {
    this.initializeManagers();
    const cosmos = this.currencyManager.getPlayerCosmos();
    return cosmos ? cosmos.cosmos : 0;
  }

  /**
   * AGGIUNGE Cosmos al giocatore
   */
  addCosmos(amount: number, reason: string = 'unknown'): number {
    this.initializeManagers();
    return this.currencyManager.addCosmos(amount, reason);
  }

  /**
   * IMPOSTA direttamente i Cosmos del giocatore
   */
  setCosmos(amount: number, reason: string = 'server_update'): void {
    this.initializeManagers();
    this.currencyManager.setCosmos(amount, reason);
  }

  /**
   * RESTITUISCE l'esperienza attuale del giocatore
   */
  getExperience(): number {
    this.initializeManagers();
    const experience = this.progressionManager.getPlayerExperience();
    return experience ? experience.totalExpEarned : 0;
  }

  /**
   * AGGIUNGE esperienza al giocatore
   */
  addExperience(amount: number, reason: string = 'unknown'): void {
    this.initializeManagers();
    this.progressionManager.addExperience(amount, reason);
  }

  /**
   * IMPOSTA direttamente l'esperienza del giocatore
   */
  setExperience(amount: number, reason: string = 'server_update'): void {
    this.initializeManagers();
    this.progressionManager.setExperience(amount, reason);
  }

  /**
   * RESTITUISCE l'onore attuale del giocatore
   */
  getHonor(): number {
    this.initializeManagers();
    const honor = this.honorManager.getPlayerHonor();
    return honor ? honor.honor : 0;
  }

  /**
   * AGGIUNGE onore al giocatore
   */
  addHonor(amount: number, reason: string = 'unknown'): number {
    this.initializeManagers();
    this.honorManager.addHonor(amount, reason);
    return 0; // addHonor is void in HonorManager
  }

  /**
   * IMPOSTA direttamente l'onore del giocatore
   */
  setHonor(amount: number, reason: string = 'server_update'): void {
    this.initializeManagers();
    this.honorManager.setHonor(amount, reason);
  }


  /**
   * Rimuove punti onore locali (per penalità)
   */
  removeHonor(amount: number, reason: string = 'penalty'): void {
    this.initializeManagers();
    this.honorManager.removeLocalHonor(amount, reason);
  }

  /**
   * Controlla se il giocatore è un amministratore
   */
  isAdministrator(): boolean {
    this.initializeManagers();
    const playerEntity = this.playerEntity;
    if (!playerEntity) return false;
    const playerRole = this.ecs.getComponent(playerEntity, PlayerRole);
    return playerRole ? playerRole.isAdministrator : false;
  }

  /**
   * Imposta lo status di amministratore
   */
  setAdministrator(value: boolean): void {
    this.initializeManagers();
    const playerEntity = this.playerEntity;
    if (!playerEntity) return;
    let playerRole = this.ecs.getComponent(playerEntity, PlayerRole);
    if (!playerRole) {
      playerRole = new PlayerRole();
      this.ecs.addComponent(playerEntity, PlayerRole, playerRole);
    }
    playerRole.setAdministrator(value);
  }

  /**
   * RESTITUISCE lo stato economico completo per l'HUD
   */
  getPlayerEconomyStatus(): any {
    this.initializeManagers();
    return this.statusManager.getPlayerEconomyStatus();
  }
}
