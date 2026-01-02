import { System as BaseSystem } from '/src/infrastructure/ecs/System';
import { ECS } from '/src/infrastructure/ecs/ECS';
import { Credits, Cosmos } from '/src/entities/Currency';
import { Experience } from '/src/entities/Experience';
import { Honor } from '/src/entities/Honor';

/**
 * Sistema Economy - gestisce l'economia completa del giocatore
 * Include Credits, Cosmos, Experience Points, Honor Points e progressione
 */
export class EconomySystem extends BaseSystem {
  private playerEntity: any = null;
  private creditsDisplayElement: HTMLElement | null = null;
  private cosmosDisplayElement: HTMLElement | null = null;
  private experienceDisplayElement: HTMLElement | null = null;
  private honorDisplayElement: HTMLElement | null = null;

  private onCreditsChanged?: (newAmount: number, change: number) => void;
  private onCosmosChanged?: (newAmount: number, change: number) => void;
  private onExperienceChanged?: (newAmount: number, change: number, leveledUp: boolean) => void;
  private onHonorChanged?: (newAmount: number, change: number, newRank?: string) => void;

  constructor(ecs: ECS) {
    super(ecs);
  }

  /**
   * Imposta l'entità player per il sistema valuta
   */
  setPlayerEntity(entity: any): void {
    this.playerEntity = entity;
  }

  /**
   * Imposta i callbacks per quando i valori economici cambiano
   */
  setCreditsChangedCallback(callback: (newAmount: number, change: number) => void): void {
    this.onCreditsChanged = callback;
  }

  setCosmosChangedCallback(callback: (newAmount: number, change: number) => void): void {
    this.onCosmosChanged = callback;
  }

  setExperienceChangedCallback(callback: (newAmount: number, change: number, leveledUp: boolean) => void): void {
    this.onExperienceChanged = callback;
  }

  setHonorChangedCallback(callback: (newAmount: number, change: number, newRank?: string) => void): void {
    this.onHonorChanged = callback;
  }

  /**
   * Crea gli elementi UI per mostrare tutte le risorse economiche
   */
  createEconomyDisplays(): void {
    this.createCreditsDisplay();
    this.createCosmosDisplay();
    this.createExperienceDisplay();
    this.createHonorDisplay();
  }

  /**
   * Crea l'elemento UI per i Credits
   */
  private createCreditsDisplay(): void {
    this.removeCreditsDisplay();

    this.creditsDisplayElement = document.createElement('div');
    this.creditsDisplayElement.id = 'credits-display';
    this.creditsDisplayElement.style.cssText = `
      position: fixed;
      top: 60px;
      left: 20px;
      background: rgba(0, 10, 30, 0.9);
      color: #00ff88;
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid #00ff88;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      font-weight: bold;
      z-index: 100;
      display: none;
    `;

    const iconSpan = document.createElement('span');
    iconSpan.textContent = 'CR';
    iconSpan.style.marginRight = '6px';
    iconSpan.style.fontWeight = 'bold';

    const textSpan = document.createElement('span');
    textSpan.id = 'credits-amount';
    textSpan.textContent = '0';

    this.creditsDisplayElement.appendChild(iconSpan);
    this.creditsDisplayElement.appendChild(textSpan);
    document.body.appendChild(this.creditsDisplayElement);
  }

  /**
   * Crea l'elemento UI per i Cosmos
   */
  private createCosmosDisplay(): void {
    this.removeCosmosDisplay();

    this.cosmosDisplayElement = document.createElement('div');
    this.cosmosDisplayElement.id = 'cosmos-display';
    this.cosmosDisplayElement.style.cssText = `
      position: fixed;
      top: 90px;
      left: 20px;
      background: rgba(0, 10, 30, 0.9);
      color: #0088ff;
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid #0088ff;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      font-weight: bold;
      z-index: 100;
      display: none;
    `;

    const iconSpan = document.createElement('span');
    iconSpan.textContent = 'CO';
    iconSpan.style.marginRight = '6px';
    iconSpan.style.fontWeight = 'bold';

    const textSpan = document.createElement('span');
    textSpan.id = 'cosmos-amount';
    textSpan.textContent = '0';

    this.cosmosDisplayElement.appendChild(iconSpan);
    this.cosmosDisplayElement.appendChild(textSpan);
    document.body.appendChild(this.cosmosDisplayElement);
  }

  /**
   * Crea gli elementi UI per Experience e Level separatamente
   */
  private createExperienceDisplay(): void {
    this.removeExperienceDisplay();

    // Container per entrambi i display
    this.experienceDisplayElement = document.createElement('div');
    this.experienceDisplayElement.id = 'experience-display';
    this.experienceDisplayElement.style.cssText = `
      position: fixed;
      top: 120px;
      left: 20px;
      z-index: 100;
      display: none;
    `;

    // Display Experience
    const expDisplay = document.createElement('div');
    expDisplay.style.cssText = `
      background: rgba(0, 10, 30, 0.9);
      color: #ffff00;
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid #ffff00;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      font-weight: bold;
      margin-bottom: 2px;
    `;

    const expIconSpan = document.createElement('span');
    expIconSpan.textContent = 'XP';
    expIconSpan.style.marginRight = '4px';

    const expAmountSpan = document.createElement('span');
    expAmountSpan.id = 'experience-amount';
    expAmountSpan.textContent = '0/100';

    expDisplay.appendChild(expIconSpan);
    expDisplay.appendChild(expAmountSpan);

    // Display Level
    const levelDisplay = document.createElement('div');
    levelDisplay.style.cssText = `
      background: rgba(0, 10, 30, 0.9);
      color: #ffaa00;
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid #ffaa00;
      font-family: 'Courier New', monospace;
      font-size: 11px;
      font-weight: bold;
    `;

    const levelIconSpan = document.createElement('span');
    levelIconSpan.textContent = 'LV';
    levelIconSpan.style.marginRight = '4px';

    const levelAmountSpan = document.createElement('span');
    levelAmountSpan.id = 'experience-level';
    levelAmountSpan.textContent = '1';

    levelDisplay.appendChild(levelIconSpan);
    levelDisplay.appendChild(levelAmountSpan);

    this.experienceDisplayElement.appendChild(expDisplay);
    this.experienceDisplayElement.appendChild(levelDisplay);
    document.body.appendChild(this.experienceDisplayElement);
  }

  /**
   * Crea l'elemento UI per l'Honor
   */
  private createHonorDisplay(): void {
    this.removeHonorDisplay();

    this.honorDisplayElement = document.createElement('div');
    this.honorDisplayElement.id = 'honor-display';
    this.honorDisplayElement.style.cssText = `
      position: fixed;
      top: 180px;
      left: 20px;
      background: rgba(0, 10, 30, 0.9);
      color: #ff8800;
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid #ff8800;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      font-weight: bold;
      z-index: 100;
      display: none;
    `;

    const iconSpan = document.createElement('span');
    iconSpan.textContent = 'HN';
    iconSpan.style.marginRight = '6px';
    iconSpan.style.fontWeight = 'bold';

    const textSpan = document.createElement('span');
    textSpan.id = 'honor-amount';
    textSpan.textContent = '0';

    this.honorDisplayElement.appendChild(iconSpan);
    this.honorDisplayElement.appendChild(textSpan);
    document.body.appendChild(this.honorDisplayElement);
  }

  /**
   * Rimuove tutti gli elementi UI economici
   */
  removeEconomyDisplays(): void {
    this.removeCreditsDisplay();
    this.removeCosmosDisplay();
    this.removeExperienceDisplay();
    this.removeHonorDisplay();
  }

  private removeCreditsDisplay(): void {
    if (this.creditsDisplayElement && document.body.contains(this.creditsDisplayElement)) {
      document.body.removeChild(this.creditsDisplayElement);
      this.creditsDisplayElement = null;
    }
  }

  private removeCosmosDisplay(): void {
    if (this.cosmosDisplayElement && document.body.contains(this.cosmosDisplayElement)) {
      document.body.removeChild(this.cosmosDisplayElement);
      this.cosmosDisplayElement = null;
    }
  }

  private removeExperienceDisplay(): void {
    if (this.experienceDisplayElement && document.body.contains(this.experienceDisplayElement)) {
      document.body.removeChild(this.experienceDisplayElement);
      this.experienceDisplayElement = null;
    }
  }

  private removeHonorDisplay(): void {
    if (this.honorDisplayElement && document.body.contains(this.honorDisplayElement)) {
      document.body.removeChild(this.honorDisplayElement);
      this.honorDisplayElement = null;
    }
  }

  /**
   * Mostra tutti gli elementi UI economici
   */
  showEconomyDisplays(): void {
    this.showCreditsDisplay();
    this.showCosmosDisplay();
    this.showExperienceDisplay();
    this.showHonorDisplay();
  }

  private showCreditsDisplay(): void {
    if (this.creditsDisplayElement) {
      this.creditsDisplayElement.style.display = 'flex';
      this.creditsDisplayElement.style.alignItems = 'center';
    }
  }

  private showCosmosDisplay(): void {
    if (this.cosmosDisplayElement) {
      this.cosmosDisplayElement.style.display = 'flex';
      this.cosmosDisplayElement.style.alignItems = 'center';
    }
  }

  private showExperienceDisplay(): void {
    if (this.experienceDisplayElement) {
      this.experienceDisplayElement.style.display = 'flex';
      this.experienceDisplayElement.style.alignItems = 'center';
    }
  }

  private showHonorDisplay(): void {
    if (this.honorDisplayElement) {
      this.honorDisplayElement.style.display = 'flex';
      this.honorDisplayElement.style.alignItems = 'center';
    }
  }

  /**
   * Nasconde tutti gli elementi UI economici
   */
  hideEconomyDisplays(): void {
    this.hideCreditsDisplay();
    this.hideCosmosDisplay();
    this.hideExperienceDisplay();
    this.hideHonorDisplay();
  }

  private hideCreditsDisplay(): void {
    if (this.creditsDisplayElement) {
      this.creditsDisplayElement.style.display = 'none';
    }
  }

  private hideCosmosDisplay(): void {
    if (this.cosmosDisplayElement) {
      this.cosmosDisplayElement.style.display = 'none';
    }
  }

  private hideExperienceDisplay(): void {
    if (this.experienceDisplayElement) {
      this.experienceDisplayElement.style.display = 'none';
    }
  }

  private hideHonorDisplay(): void {
    if (this.honorDisplayElement) {
      this.honorDisplayElement.style.display = 'none';
    }
  }

  /**
   * Aggiorna tutti gli elementi UI economici
   */
  updateEconomyDisplays(): void {
    this.updateCreditsDisplay();
    this.updateCosmosDisplay();
    this.updateExperienceDisplay();
    this.updateHonorDisplay();
  }

  private updateCreditsDisplay(): void {
    if (!this.creditsDisplayElement) return;

    const credits = this.getPlayerCredits();
    if (credits) {
      const amountElement = this.creditsDisplayElement.querySelector('#credits-amount');
      if (amountElement) {
        amountElement.textContent = credits.formatForDisplay();
      }
    }
  }

  private updateCosmosDisplay(): void {
    if (!this.cosmosDisplayElement) return;

    const cosmos = this.getPlayerCosmos();
    if (cosmos) {
      const amountElement = this.cosmosDisplayElement.querySelector('#cosmos-amount');
      if (amountElement) {
        amountElement.textContent = cosmos.formatForDisplay();
      }
    }
  }

  private updateExperienceDisplay(): void {
    if (!this.experienceDisplayElement) return;

    const experience = this.getPlayerExperience();
    if (experience) {
      const levelElement = this.experienceDisplayElement.querySelector('#experience-level');
      const amountElement = this.experienceDisplayElement.querySelector('#experience-amount');

      if (levelElement) {
        levelElement.textContent = experience.level.toString();
      }
      if (amountElement) {
        amountElement.textContent = experience.formatForDisplay();
      }
    }
  }

  private updateHonorDisplay(): void {
    if (!this.honorDisplayElement) return;

    const honor = this.getPlayerHonor();
    if (honor) {
      const amountElement = this.honorDisplayElement.querySelector('#honor-amount');

      if (amountElement) {
        amountElement.textContent = honor.honor.toString();
      }
    }
  }

  /**
   * Ottiene i componenti economici del giocatore
   */
  getPlayerCredits(): Credits | null {
    if (!this.playerEntity) return null;
    return this.ecs.getComponent(this.playerEntity, Credits);
  }

  getPlayerCosmos(): Cosmos | null {
    if (!this.playerEntity) return null;
    return this.ecs.getComponent(this.playerEntity, Cosmos);
  }

  getPlayerExperience(): Experience | null {
    if (!this.playerEntity) return null;
    return this.ecs.getComponent(this.playerEntity, Experience);
  }

  getPlayerHonor(): Honor | null {
    if (!this.playerEntity) return null;
    return this.ecs.getComponent(this.playerEntity, Honor);
  }

  // ===== GESTIONE CREDITS =====

  /**
   * Aggiunge Credits al giocatore
   */
  addCredits(amount: number, reason: string = 'unknown'): number {
    const credits = this.getPlayerCredits();
    if (!credits) return 0;

    const oldAmount = credits.credits;
    const added = credits.addCredits(amount);

    if (added > 0) {
      console.log(`Credits: +${added} (${reason}) - Total: ${credits.credits}`);
      this.updateCreditsDisplay();
      this.onCreditsChanged?.(credits.credits, added);
    }

    return added;
  }

  /**
   * Rimuove Credits dal giocatore
   */
  removeCredits(amount: number, reason: string = 'unknown'): number {
    const credits = this.getPlayerCredits();
    if (!credits) return 0;

    const oldAmount = credits.credits;
    const removed = credits.removeCredits(amount);

    if (removed > 0) {
      console.log(`Credits: -${removed} (${reason}) - Total: ${credits.credits}`);
      this.updateCreditsDisplay();
      this.onCreditsChanged?.(credits.credits, -removed);
    }

    return removed;
  }

  /**
   * Controlla se il giocatore può permettersi un acquisto in Credits
   */
  canAffordCredits(cost: number): boolean {
    const credits = this.getPlayerCredits();
    return credits ? credits.canAfford(cost) : false;
  }

  // ===== GESTIONE COSMOS =====

  /**
   * Aggiunge Cosmos al giocatore
   */
  addCosmos(amount: number, reason: string = 'unknown'): number {
    const cosmos = this.getPlayerCosmos();
    if (!cosmos) return 0;

    const oldAmount = cosmos.cosmos;
    const added = cosmos.addCosmos(amount);

    if (added > 0) {
      console.log(`Cosmos: +${added} (${reason}) - Total: ${cosmos.cosmos}`);
      this.updateCosmosDisplay();
      this.onCosmosChanged?.(cosmos.cosmos, added);
    }

    return added;
  }

  /**
   * Rimuove Cosmos dal giocatore
   */
  removeCosmos(amount: number, reason: string = 'unknown'): number {
    const cosmos = this.getPlayerCosmos();
    if (!cosmos) return 0;

    const oldAmount = cosmos.cosmos;
    const removed = cosmos.removeCosmos(amount);

    if (removed > 0) {
      console.log(`Cosmos: -${removed} (${reason}) - Total: ${cosmos.cosmos}`);
      this.updateCosmosDisplay();
      this.onCosmosChanged?.(cosmos.cosmos, -removed);
    }

    return removed;
  }

  /**
   * Controlla se il giocatore può permettersi un acquisto in Cosmos
   */
  canAffordCosmos(cost: number): boolean {
    const cosmos = this.getPlayerCosmos();
    return cosmos ? cosmos.canAfford(cost) : false;
  }

  // ===== GESTIONE EXPERIENCE =====

  /**
   * Aggiunge Experience Points al giocatore
   */
  addExperience(amount: number, reason: string = 'unknown'): boolean {
    const experience = this.getPlayerExperience();
    if (!experience) return false;

    const oldLevel = experience.level;
    const leveledUp = experience.addExp(amount);

    console.log(`Experience: +${amount} (${reason}) - Level: ${experience.level}, Exp: ${experience.exp}/${experience.expForNextLevel - experience.getExpRequiredForLevel(experience.level - 1)}`);

    if (leveledUp) {
      console.log(`🎉 LEVEL UP! ${oldLevel} → ${experience.level}`);
    }

    this.updateExperienceDisplay();
    this.onExperienceChanged?.(experience.totalExpEarned, amount, leveledUp);

    return leveledUp;
  }

  /**
   * Ottiene il livello attuale del giocatore
   */
  getPlayerLevel(): number {
    const experience = this.getPlayerExperience();
    return experience ? experience.level : 1;
  }

  // ===== GESTIONE HONOR =====

  /**
   * Aggiorna la posizione nel ranking globale del giocatore
   */
  updatePlayerRanking(position: number, totalPlayers: number): string | null {
    const honor = this.getPlayerHonor();
    if (!honor) return null;

    const oldRank = honor.honorRank;
    const newRank = honor.updateRankingPosition(position, totalPlayers);

    console.log(`Ranking updated: Position ${honor.rankingPosition}/${honor.totalPlayers}, Rank: ${honor.honorRank}`);

    if (newRank && newRank !== oldRank) {
      console.log(`🏆 RANK CHANGE! ${oldRank} → ${newRank}`);
    }

    this.updateHonorDisplay();
    this.onHonorChanged?.(honor.honor, 0, newRank || undefined);

    return newRank;
  }

  /**
   * Imposta lo status di Administrator
   */
  setPlayerAdministrator(isAdmin: boolean): void {
    const honor = this.getPlayerHonor();
    if (honor) {
      honor.setAdministrator(isAdmin);
      console.log(`Administrator status: ${isAdmin}`);
      this.updateHonorDisplay();
    }
  }

  /**
   * Aggiunge punti onore locali (per achievements)
   */
  addLocalHonor(amount: number, reason: string = 'achievement'): void {
    const honor = this.getPlayerHonor();
    if (honor) {
      honor.addHonor(amount);
      console.log(`Local Honor: +${amount} (${reason}) - Total: ${honor.honor}`);
      this.updateHonorDisplay();
    }
  }

  /**
   * Rimuove punti onore locali (per penalità)
   */
  removeLocalHonor(amount: number, reason: string = 'penalty'): void {
    const honor = this.getPlayerHonor();
    if (honor) {
      honor.removeHonor(amount);
      console.log(`Local Honor: -${amount} (${reason}) - Total: ${honor.honor}`);
      this.updateHonorDisplay();
    }
  }

  // ===== METODI GENERALI =====

  /**
   * Calcola i rank points totali per il ranking globale
   * Formula: Experience totale + (Honor * 100) + (Livello * 500)
   */
  calculatePlayerRankPoints(): number {
    const experience = this.getPlayerExperience();
    const honor = this.getPlayerHonor();

    if (!experience || !honor) return 0;

    // Rank points base: experience totale
    let rankPoints = experience.totalExpEarned;

    // Bonus/malus da onore (honor può essere negativo)
    rankPoints += honor.honor * 100;

    // Bonus per livello raggiunto (per dare peso ai giocatori esperti)
    rankPoints += experience.level * 500;

    return Math.max(0, rankPoints);
  }

  /**
   * Simula aggiornamento ranking globale (per testing single-player)
   * In produzione questo verrebbe chiamato dal server con dati reali
   */
  simulateRankingUpdate(): void {
    // Simula un ranking globale con posizioni che variano leggermente
    const baseRankPoints = this.calculatePlayerRankPoints();

    // Aggiungi variabilità casuale per simulare altri giocatori
    const randomFactor = (Math.random() - 0.5) * 0.2; // ±10%
    const simulatedRankPoints = baseRankPoints * (1 + randomFactor);

    // Simula numero totale giocatori online (50-200)
    const totalPlayers = 50 + Math.floor(Math.random() * 150);

    // Calcola posizione approssimativa basata sui rank points
    // Più alti i rank points, più alta la posizione
    const position = Math.max(1, Math.floor(totalPlayers * (1 - simulatedRankPoints / (simulatedRankPoints + 10000))));

    // Aggiorna il ranking del giocatore
    this.updatePlayerRanking(position, totalPlayers);

    console.log(`Ranking updated: Rank Points ${Math.floor(simulatedRankPoints)}, Position ${position}/${totalPlayers}`);
  }

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
    rankingRankPoints: number;
    rankingPosition: number;
    totalPlayers: number;
  } | null {
    const credits = this.getPlayerCredits();
    const cosmos = this.getPlayerCosmos();
    const experience = this.getPlayerExperience();
    const honor = this.getPlayerHonor();

    if (!credits || !cosmos || !experience || !honor) return null;

    return {
      credits: credits.credits,
      cosmos: cosmos.cosmos,
      level: experience.level,
      experience: experience.exp,
      expForNextLevel: experience.expForNextLevel,
      honor: honor.honor,
      honorRank: honor.honorRank,
      rankingRankPoints: this.calculatePlayerRankPoints(),
      rankingPosition: honor.rankingPosition,
      totalPlayers: honor.totalPlayers
    };
  }

  update(deltaTime: number): void {
    // Il sistema currency non ha aggiornamenti automatici
    // Tutto è gestito tramite chiamate esplicite
  }
}
