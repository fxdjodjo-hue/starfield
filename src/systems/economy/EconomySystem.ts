import { System as BaseSystem } from '../../infrastructure/ecs/System';
import { ECS } from '../../infrastructure/ecs/ECS';
import { Credits, Cosmos } from '../../entities/currency/Currency';
import { Experience } from '../../entities/currency/Experience';
import { Honor } from '../../entities/currency/Honor';
import { SkillPoints } from '../../entities/currency/SkillPoints';

/**
 * Sistema Economy - gestisce l'economia completa del giocatore
 * Include Credits, Cosmos, Experience Points, Honor Points e progressione
 */
export class EconomySystem extends BaseSystem {
  private playerEntity: any = null;
  private rankSystem: any = null;

  private onCreditsChanged?: (newAmount: number, change: number) => void;
  private onCosmosChanged?: (newAmount: number, change: number) => void;
  private onExperienceChanged?: (newAmount: number, change: number, leveledUp: boolean) => void;
  private onHonorChanged?: (newAmount: number, change: number, newRank?: string) => void;
  private onSkillPointsChanged?: (newAmount: number, change: number) => void;


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
   * Imposta il riferimento al RankSystem
   */
  setRankSystem(rankSystem: any): void {
    this.rankSystem = rankSystem;
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
   * I valori economici sono ora integrati nell'HUD del giocatore
   */
  createEconomyDisplays(): void {
    // Non crea più pannelli separati - i valori sono nell'HUD del PlayState
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
   * I valori economici sono ora nell'HUD del giocatore
   */
  showEconomyDisplays(): void {
    // Non mostra più pannelli separati - i valori sono nell'HUD del PlayState
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
    // I valori economici sono ora aggiornati dall'HUD del PlayState
  }

  private updateCreditsDisplay(): void {
    if (!this.economyPanelElement) return;

    const credits = this.getPlayerCredits();
    if (credits) {
      const amountElement = this.economyPanelElement.querySelector('#credits-amount');
      if (amountElement) {
        amountElement.textContent = credits.formatForDisplay();
      }
    }
  }

  private updateCosmosDisplay(): void {
    if (!this.economyPanelElement) return;

    const cosmos = this.getPlayerCosmos();
    if (cosmos) {
      const amountElement = this.economyPanelElement.querySelector('#cosmos-amount');
      if (amountElement) {
        amountElement.textContent = cosmos.amount.toString();
      }
    }
  }

  private updateExperienceDisplay(): void {
    if (!this.economyPanelElement) return;

    const experience = this.getPlayerExperience();
    if (experience) {
      const levelElement = this.economyPanelElement.querySelector('#experience-level');
      const amountElement = this.economyPanelElement.querySelector('#experience-amount');

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
    return this.ecs.getComponent(this.playerEntity, Credits) || null;
  }

  getPlayerCosmos(): Cosmos | null {
    if (!this.playerEntity) return null;
    return this.ecs.getComponent(this.playerEntity, Cosmos) || null;
  }

  getPlayerExperience(): Experience | null {
    if (!this.playerEntity) return null;
    return this.ecs.getComponent(this.playerEntity, Experience) || null;
  }

  getPlayerHonor(): Honor | null {
    if (!this.playerEntity) return null;
    return this.ecs.getComponent(this.playerEntity, Honor) || null;
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

    // ✅ FIX: Non chiamare callback se il cambiamento viene dal server per evitare loop infinito
    if (added > 0 && reason !== 'server_update') {
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

  /**
   * IMPOSTA direttamente i Credits del giocatore (Server Authoritative)
   */
  setCredits(amount: number, reason: string = 'server_update'): void {
    const credits = this.getPlayerCredits();
    if (!credits) return;

    const oldAmount = credits.credits;
    const targetAmount = Math.max(0, amount);

    if (targetAmount > oldAmount) {
      // Aggiungi la differenza
      credits.addCredits(targetAmount - oldAmount);
    } else if (targetAmount < oldAmount) {
      // Rimuovi la differenza
      credits.removeCredits(oldAmount - targetAmount);
    }
    // Se sono uguali, non fare nulla

    const change = credits.credits - oldAmount;

    // ✅ Chiama sempre il callback per aggiornare l'UI, anche per aggiornamenti dal server
    this.onCreditsChanged?.(credits.credits, change);
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

    // ✅ FIX: Non chiamare callback se il cambiamento viene dal server per evitare loop infinito
    if (added > 0 && reason !== 'server_update') {
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

  /**
   * IMPOSTA direttamente i Cosmos del giocatore (Server Authoritative)
   */
  setCosmos(amount: number, reason: string = 'server_update'): void {
    const cosmos = this.getPlayerCosmos();
    if (!cosmos) return;

    const oldAmount = cosmos.cosmos;
    const targetAmount = Math.max(0, amount);

    if (targetAmount > oldAmount) {
      cosmos.addCosmos(targetAmount - oldAmount);
    } else if (targetAmount < oldAmount) {
      cosmos.removeCosmos(oldAmount - targetAmount);
    }

    const change = cosmos.cosmos - oldAmount;

    // ✅ Chiama sempre il callback per aggiornare l'UI, anche per aggiornamenti dal server
    this.onCosmosChanged?.(cosmos.cosmos, change);
  }

  // ===== GESTIONE EXPERIENCE =====

  /**
   * Aggiunge Experience Points al giocatore
   */
  addExperience(amount: number, reason: string = 'unknown'): boolean {
    const experience = this.getPlayerExperience();
    if (!experience) return false;

    const oldLevel = experience.level;

    // Skill points ora riservati per usi futuri (specializzazioni, abilità, ecc.)
    const leveledUp = experience.addExp(amount);

    // ✅ Chiama sempre il callback per aggiornare l'UI, anche per aggiornamenti dal server
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

  /**
   * IMPOSTA direttamente l'Experience del giocatore (Server Authoritative)
   */
  setExperience(totalExp: number, reason: string = 'server_update'): void {
    const experience = this.getPlayerExperience();
    if (!experience) {
      return;
    }

    const oldTotalExp = experience.totalExpEarned;
    const targetTotalExp = Math.max(0, totalExp);

    // Calcola la differenza e usa addExp per raggiungere il target
    if (targetTotalExp > oldTotalExp) {
      experience.addExp(targetTotalExp - oldTotalExp);
    } else if (targetTotalExp < oldTotalExp) {
      // Per rimuovere esperienza, dovrei implementare un metodo removeExp
      // Per ora, assumiamo che l'esperienza solo aumenti nel server authoritative
    }

    const change = experience.totalExpEarned - oldTotalExp;
    const leveledUp = experience.level > Math.floor(oldTotalExp / 100) + 1;

    // ✅ Chiama sempre il callback per aggiornare l'UI, anche per aggiornamenti dal server
    this.onExperienceChanged?.(experience.totalExpEarned, change, leveledUp);
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
        this.onHonorChanged?.(newAmount, change, honor.getRank());
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
    this.onHonorChanged?.(honor.honor, change, honor.getRank());
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
    const credits = this.getPlayerCredits();
    const cosmos = this.getPlayerCosmos();
    const experience = this.getPlayerExperience();
    const honor = this.getPlayerHonor();

    if (!credits || !cosmos || !experience || !honor) return null;

    const result = {
      credits: credits.credits,
      cosmos: cosmos.cosmos,
      level: experience.level,
      experience: experience.exp,
      expForNextLevel: experience.expForCurrentLevel,
      honor: honor.honor,
      honorRank: this.rankSystem?.calculateCurrentRank() || 'Recruit'
    };

    return result;
  }

  update(deltaTime: number): void {
    // Il sistema currency non ha aggiornamenti automatici
    // Tutto è gestito tramite chiamate esplicite
  }
}
