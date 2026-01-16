import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Credits, Cosmos } from '../../entities/currency/Currency';
import { Experience } from '../../entities/currency/Experience';
import { Honor } from '../../entities/currency/Honor';
import { SkillPoints } from '../../entities/currency/SkillPoints';

// Modular architecture managers
import { CurrencyManager } from './managers/CurrencyManager';
import { ProgressionManager } from './managers/ProgressionManager';
import { HonorManager } from './managers/HonorManager';
import { EconomyEventManager } from './managers/EconomyEventManager';
import { EconomyStatusManager } from './managers/EconomyStatusManager';
import { EconomyUIDisplayManager } from './managers/EconomyUIDisplayManager';

/**
 * Sistema Economy - gestisce l'economia completa del giocatore
 * Include Credits, Cosmos, Experience Points, Honor Points e progressione
 */
export class EconomySystem extends BaseSystem {
  private playerEntity: any = null;
  private rankSystem: any = null;

  // Modular architecture managers (lazy initialization)
  private currencyManager!: CurrencyManager;
  private progressionManager!: ProgressionManager;
  private honorManager!: HonorManager;
  private eventManager!: EconomyEventManager;
  private statusManager!: EconomyStatusManager;
  private uiDisplayManager!: EconomyUIDisplayManager;
  private managersInitialized: boolean = false;

  constructor(ecs: ECS) {
    super(ecs);
  }

  /**
   * Initializes managers with dependency injection
   */
  private initializeManagers(): void {
    if (this.managersInitialized) return;

    // Initialize event manager first (independent)
    this.eventManager = new EconomyEventManager();

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
      (newAmount, change, newRank) => this.eventManager.getOnHonorChanged()?.(newAmount, change, newRank),
      (newAmount, change) => this.eventManager.getOnSkillPointsChanged()?.(newAmount, change)
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
      (newAmount, change, newRank) => this.eventManager.getOnHonorChanged()?.(newAmount, change, newRank),
      (newAmount, change) => this.eventManager.getOnSkillPointsChanged()?.(newAmount, change)
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
   * I valori economici sono ora integrati nell'HUD del giocatore
   * @deprecated UI displays are now handled by PlayerHUD
   */
  createEconomyDisplays(): void {
    this.initializeManagers();
    // Delegated to EconomyUIDisplayManager (deprecated)
  }

  /**
   * Rimuove tutti gli elementi UI economici
   * @deprecated UI displays are now handled by PlayerHUD
   */
  removeEconomyDisplays(): void {
    this.initializeManagers();
    // Delegated to EconomyUIDisplayManager (deprecated)
  }

  /**
   * I valori economici sono ora nell'HUD del giocatore
   * @deprecated UI displays are now handled by PlayerHUD
   */
  showEconomyDisplays(): void {
    this.initializeManagers();
    // Delegated to EconomyUIDisplayManager (deprecated)
  }

  /**
   * Nasconde tutti gli elementi UI economici
   * @deprecated UI displays are now handled by PlayerHUD
   */
  hideEconomyDisplays(): void {
    this.initializeManagers();
    // Delegated to EconomyUIDisplayManager (deprecated)
  }

  /**
   * Aggiorna tutti gli elementi UI economici
   * @deprecated UI displays are now handled by PlayerHUD
   */
  updateEconomyDisplays(): void {
    this.initializeManagers();
    // Delegated to EconomyUIDisplayManager (deprecated)
  }

  // ========== REMOVED UI METHODS - Now in EconomyUIDisplayManager (deprecated) ==========
  // All private UI display methods have been removed (deprecated, no longer used):
  // - createCreditsDisplay(), createCosmosDisplay(), createExperienceDisplay(), createHonorDisplay()
  // - removeCreditsDisplay(), removeCosmosDisplay(), removeExperienceDisplay(), removeHonorDisplay()
  // - showCreditsDisplay(), showCosmosDisplay(), showExperienceDisplay(), showHonorDisplay()
  // - hideCreditsDisplay(), hideCosmosDisplay(), hideExperienceDisplay(), hideHonorDisplay()
  // - updateCreditsDisplay(), updateCosmosDisplay(), updateExperienceDisplay(), updateHonorDisplay()
  // These methods are deprecated - UI displays are now handled by PlayerHUD

  /**
   * Ottiene i componenti economici del giocatore
   */
  getPlayerCredits(): Credits | null {
    this.initializeManagers();
    return this.currencyManager.getPlayerCredits();
  }

  getPlayerCosmos(): Cosmos | null {
    this.initializeManagers();
    return this.currencyManager.getPlayerCosmos();
  }

  getPlayerExperience(): Experience | null {
    this.initializeManagers();
    return this.progressionManager.getPlayerExperience();
  }

  getPlayerHonor(): Honor | null {
    this.initializeManagers();
    return this.honorManager.getPlayerHonor();
  }

  // ===== GESTIONE CREDITS =====

  /**
   * Aggiunge Credits al giocatore
   */
  addCredits(amount: number, reason: string = 'unknown'): number {
    this.initializeManagers();
    return this.currencyManager.addCredits(amount, reason);
  }

  /**
   * Rimuove Credits dal giocatore
   */
  removeCredits(amount: number, reason: string = 'unknown'): number {
    this.initializeManagers();
    return this.currencyManager.removeCredits(amount, reason);
  }

  /**
   * Controlla se il giocatore può permettersi un acquisto in Credits
   */
  canAffordCredits(cost: number): boolean {
    this.initializeManagers();
    return this.currencyManager.canAffordCredits(cost);
  }

  /**
   * IMPOSTA direttamente i Credits del giocatore (Server Authoritative)
   */
  setCredits(amount: number, reason: string = 'server_update'): void {
    this.initializeManagers();
    this.currencyManager.setCredits(amount, reason);
  }

  // ===== GESTIONE COSMOS =====

  /**
   * Aggiunge Cosmos al giocatore
   */
  addCosmos(amount: number, reason: string = 'unknown'): number {
    this.initializeManagers();
    return this.currencyManager.addCosmos(amount, reason);
  }

  /**
   * Rimuove Cosmos dal giocatore
   */
  removeCosmos(amount: number, reason: string = 'unknown'): number {
    this.initializeManagers();
    return this.currencyManager.removeCosmos(amount, reason);
  }

  /**
   * Controlla se il giocatore può permettersi un acquisto in Cosmos
   */
  canAffordCosmos(cost: number): boolean {
    this.initializeManagers();
    return this.currencyManager.canAffordCosmos(cost);
  }

  /**
   * IMPOSTA direttamente i Cosmos del giocatore (Server Authoritative)
   */
  setCosmos(amount: number, reason: string = 'server_update'): void {
    this.initializeManagers();
    this.currencyManager.setCosmos(amount, reason);
  }

  // ===== GESTIONE EXPERIENCE =====

  /**
   * Aggiunge Experience Points al giocatore
   */
  addExperience(amount: number, reason: string = 'unknown'): boolean {
    this.initializeManagers();
    return this.progressionManager.addExperience(amount, reason);
  }

  /**
   * Ottiene il livello attuale del giocatore
   */
  getPlayerLevel(): number {
    this.initializeManagers();
    return this.progressionManager.getPlayerLevel();
  }

  /**
   * IMPOSTA direttamente l'Experience del giocatore (Server Authoritative)
   */
  setExperience(totalExp: number, reason: string = 'server_update'): void {
    this.initializeManagers();
    this.progressionManager.setExperience(totalExp, reason);
  }

  // ===== GESTIONE HONOR =====


  /**
   * Imposta lo status di Administrator
   */
  setPlayerAdministrator(isAdmin: boolean): void {
    const honor = this.getPlayerHonor();
    if (honor) {
      honor.setAdministrator(isAdmin);
    }
  }

  /**
   * Aggiunge punti onore (per ricompense NPC)
   */
  addHonor(amount: number, reason: string = 'unknown'): void {
    const honor = this.getPlayerHonor();
    if (honor) {
      const oldAmount = honor.honor;
      honor.addHonor(amount);
      const newAmount = honor.honor;
      const change = newAmount - oldAmount;

      // ✅ FIX: Non chiamare callback se il cambiamento viene dal server per evitare loop infinito
      if (change !== 0 && reason !== 'server_update') {
        const currentRank = this.rankSystem?.calculateCurrentRank() || 'Recruit';
        this.onHonorChanged?.(newAmount, change, currentRank);
      }
    }
  }

  /**
   * Aggiunge punti onore locali (per achievements)
   */
  addLocalHonor(amount: number, reason: string = 'achievement'): void {
    const honor = this.getPlayerHonor();
    if (honor) {
      honor.addHonor(amount);
    }
  }

  /**
   * IMPOSTA direttamente l'Honor del giocatore (Server Authoritative)
   */
  setHonor(amount: number, reason: string = 'server_update'): void {
    const honor = this.getPlayerHonor();
    if (!honor) return;

    const oldAmount = honor.honor;
    const targetAmount = Math.max(0, amount);

    if (targetAmount > oldAmount) {
      honor.addHonor(targetAmount - oldAmount);
    } else if (targetAmount < oldAmount) {
      honor.removeHonor(oldAmount - targetAmount);
    }

    const change = honor.honor - oldAmount;

    // ✅ Chiama sempre il callback per aggiornare l'UI, anche per aggiornamenti dal server
    const currentRank = this.rankSystem?.calculateCurrentRank() || 'Recruit';
    this.onHonorChanged?.(honor.honor, change, currentRank);
  }

  /**
   * Aggiunge SkillPoints al giocatore (per gestione futura - specializzazioni, abilità)
   * Attualmente non utilizzato nel leveling automatico
   */
  addSkillPoints(amount: number, reason: string = 'unknown'): number {
    const skillPoints = this.ecs.getComponent(this.playerEntity, SkillPoints);
    if (!skillPoints) return 0;

    const oldAmount = skillPoints.current;
    skillPoints.addPoints(amount);
    const newAmount = skillPoints.current;
    const added = newAmount - oldAmount;

    // ✅ FIX: Non chiamare callback se il cambiamento viene dal server per evitare loop infinito
    if (added > 0 && reason !== 'server_update') {
      this.onSkillPointsChanged?.(newAmount, added);
    }

    return added;
  }

  /**
   * IMPOSTA direttamente i SkillPoints del giocatore (Server Authoritative)
   * Per gestione futura - specializzazioni e abilità avanzate
   */
  setSkillPoints(amount: number, reason: string = 'server_update'): void {
    const skillPoints = this.ecs.getComponent(this.playerEntity, SkillPoints);
    if (!skillPoints) return;

    const oldAmount = skillPoints.skillPoints;
    skillPoints.setPoints(Math.max(0, amount)); // Usa il metodo esistente

    const change = skillPoints.skillPoints - oldAmount;

    // ✅ FIX: Non chiamare callback se il cambiamento viene dal server per evitare loop infinito
    if (reason !== 'server_update') {
      this.onSkillPointsChanged?.(skillPoints.skillPoints, change);
    }
  }

  /**
   * Rimuove punti onore locali (per penalità)
   */
  removeLocalHonor(amount: number, reason: string = 'penalty'): void {
    const honor = this.getPlayerHonor();
    if (honor) {
      honor.removeHonor(amount);
    }
  }

  // ===== METODI GENERALI =====



  /**
   * Ottiene lo stato economico completo del giocatore
   */
  getPlayerEconomyStatus(): {
    credits: number;
    cosmos: number;
    level: number;
    experience: number;
    expForNextLevel: number;
    honor: number;
    honorRank: string;
  } | null {
    this.initializeManagers();
    return this.statusManager.getPlayerEconomyStatus();
  }

  update(deltaTime: number): void {
    // Il sistema currency non ha aggiornamenti automatici
    // Tutto è gestito tramite chiamate esplicite
  }
}
