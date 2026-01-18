import { BasePanel } from './FloatingIcon';
import type { PanelConfig } from './PanelConfig';
import type { PanelData } from './UIManager';
import type { ClientNetworkSystem } from '../../multiplayer/client/ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../config/NetworkConfig';

/**
 * Dati per una entry della leaderboard
 */
export interface LeaderboardEntry {
  rank: number;
  playerId: number;
  username: string;
  experience: number;
  honor: number;
  recentHonor: number;
  rankingPoints: number;
  kills: number;
  playTime: number; // in secondi
  level: number;
  rankName: string; // Rank militare (es. "Chief General")
}

/**
 * Dati per il pannello leaderboard
 */
export interface LeaderboardData {
  entries: LeaderboardEntry[];
  sortBy: 'ranking_points' | 'honor' | 'experience' | 'kills';
  playerRank?: number; // Posizione del giocatore corrente
}

/**
 * LeaderboardPanel - Pannello che mostra la classifica globale dei giocatori
 * Implementa l'interfaccia BasePanel per l'integrazione nel sistema UI
 */
export class LeaderboardPanel extends BasePanel {
  private leaderboardData: LeaderboardData = {
    entries: [],
    sortBy: 'ranking_points'
  };
  private refreshButton: HTMLElement | null = null;
  private sortButtons: Map<string, HTMLElement> = new Map();
  private loadingIndicator: HTMLElement | null = null;
  private clientNetworkSystem: ClientNetworkSystem | null = null;

  constructor(config: PanelConfig, clientNetworkSystem?: ClientNetworkSystem | null) {
    super(config);
    this.clientNetworkSystem = clientNetworkSystem || null;
    // Ensure sortButtons is initialized before createPanelContent is called
    if (!this.sortButtons) {
      this.sortButtons = new Map();
    }
  }

  /**
   * Imposta il riferimento al ClientNetworkSystem
   */
  setClientNetworkSystem(clientNetworkSystem: ClientNetworkSystem): void {
    this.clientNetworkSystem = clientNetworkSystem;
  }

  /**
   * Crea il contenuto del pannello leaderboard
   */
  protected createPanelContent(): HTMLElement {
    // Ensure sortButtons is initialized
    if (!this.sortButtons) {
      this.sortButtons = new Map();
    }
    
    const content = document.createElement('div');
    content.className = 'leaderboard-content';
    content.style.cssText = `
      padding: 24px;
      height: 100%;
      display: flex;
      flex-direction: column;
      gap: 16px;
      position: relative;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 25px;
      overflow-y: auto;
      scrollbar-width: none;
      -ms-overflow-style: none;
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
    `;

    // Hide scrollbar
    const style = document.createElement('style');
    style.textContent = `.leaderboard-content::-webkit-scrollbar { display: none; }`;
    content.appendChild(style);

    // Pulsante di chiusura
    const closeButton = document.createElement('button');
    closeButton.textContent = 'X';
    closeButton.style.cssText = `
      position: absolute;
      top: 16px;
      right: 16px;
      background: rgba(239, 68, 68, 0.9);
      border: 1px solid rgba(239, 68, 68, 0.5);
      color: white;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      padding: 6px 10px;
      border-radius: 8px;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
      transition: all 0.2s ease;
    `;

    closeButton.addEventListener('mouseenter', () => {
      closeButton.style.background = 'rgba(239, 68, 68, 1)';
      closeButton.style.boxShadow = '0 4px 12px rgba(239, 68, 68, 0.4)';
    });

    closeButton.addEventListener('mouseleave', () => {
      closeButton.style.background = 'rgba(239, 68, 68, 0.9)';
      closeButton.style.boxShadow = '0 2px 8px rgba(239, 68, 68, 0.3)';
    });

    closeButton.addEventListener('click', () => {
      this.hide();
    });

    content.appendChild(closeButton);

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      text-align: center;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 8px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
    `;

    const title = document.createElement('h2');
    title.textContent = 'LEADERBOARD';
    title.style.cssText = `
      margin: 0;
      color: rgba(255, 255, 255, 0.95);
      font-size: 22px;
      font-weight: 700;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
      letter-spacing: 2px;
    `;

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Top players ranked by performance';
    subtitle.style.cssText = `
      margin: 4px 0 0 0;
      color: rgba(255, 255, 255, 0.7);
      font-size: 12px;
      font-weight: 400;
    `;

    header.appendChild(title);
    header.appendChild(subtitle);
    content.appendChild(header);

    // Sort buttons container
    const sortContainer = document.createElement('div');
    sortContainer.style.cssText = `
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
      flex-wrap: wrap;
    `;

    const sortOptions = [
      { id: 'ranking_points', label: 'Ranking' },
      { id: 'honor', label: 'Honor' },
      { id: 'experience', label: 'Experience' },
      { id: 'kills', label: 'Kills' }
    ];

    sortOptions.forEach(option => {
      const button = document.createElement('button');
      button.textContent = option.label;
      button.dataset.sortBy = option.id;
      button.style.cssText = `
        padding: 8px 16px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        color: rgba(255, 255, 255, 0.8);
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      `;

      button.addEventListener('mouseenter', () => {
        button.style.background = 'rgba(255, 255, 255, 0.15)';
        button.style.borderColor = 'rgba(255, 255, 255, 0.3)';
      });

      button.addEventListener('mouseleave', () => {
        if (this.leaderboardData.sortBy !== option.id) {
          button.style.background = 'rgba(255, 255, 255, 0.1)';
          button.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        }
      });

      button.addEventListener('click', () => {
        this.setSortBy(option.id as any);
      });

      this.sortButtons.set(option.id, button);
      sortContainer.appendChild(button);
    });

    content.appendChild(sortContainer);

    // Refresh button
    this.refreshButton = document.createElement('button');
    this.refreshButton.textContent = '🔄 Refresh';
    this.refreshButton.style.cssText = `
      padding: 8px 16px;
      background: rgba(0, 255, 136, 0.2);
      border: 1px solid rgba(0, 255, 136, 0.3);
      border-radius: 8px;
      color: #00ff88;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      align-self: flex-start;
    `;

    this.refreshButton.addEventListener('mouseenter', () => {
      if (this.refreshButton) {
        this.refreshButton.style.background = 'rgba(0, 255, 136, 0.3)';
        this.refreshButton.style.borderColor = 'rgba(0, 255, 136, 0.5)';
      }
    });

    this.refreshButton.addEventListener('mouseleave', () => {
      if (this.refreshButton) {
        this.refreshButton.style.background = 'rgba(0, 255, 136, 0.2)';
        this.refreshButton.style.borderColor = 'rgba(0, 255, 136, 0.3)';
      }
    });

    this.refreshButton.addEventListener('click', () => {
      this.requestLeaderboard();
    });

    content.appendChild(this.refreshButton);

    // Loading indicator
    this.loadingIndicator = document.createElement('div');
    this.loadingIndicator.id = 'leaderboard-loading';
    this.loadingIndicator.textContent = 'Loading leaderboard...';
    this.loadingIndicator.style.cssText = `
      text-align: center;
      color: rgba(255, 255, 255, 0.6);
      font-size: 14px;
      padding: 20px;
      display: none;
    `;
    content.appendChild(this.loadingIndicator);

    // Leaderboard table container
    const tableContainer = document.createElement('div');
    tableContainer.id = 'leaderboard-table-container';
    tableContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
    `;

    // Table
    const table = document.createElement('table');
    table.id = 'leaderboard-table';
    table.style.cssText = `
      width: 100%;
      border-collapse: collapse;
      color: rgba(255, 255, 255, 0.9);
    `;

    // Table header
    const thead = document.createElement('thead');
    thead.style.cssText = `
      position: sticky;
      top: 0;
      background: rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
      z-index: 10;
    `;

    const headerRow = document.createElement('tr');
    const headers = [
      { text: '#', align: 'center' },
      { text: 'Player', align: 'left' },
      { text: 'Rank', align: 'left' },
      { text: 'Level', align: 'right' },
      { text: 'Experience', align: 'right' },
      { text: 'Honor', align: 'right' },
      { text: 'Kills', align: 'right' }
    ];
    
    headers.forEach(header => {
      const th = document.createElement('th');
      th.textContent = header.text;
      th.style.cssText = `
        padding: 12px 8px;
        text-align: ${header.align};
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: rgba(255, 255, 255, 0.8);
        border-bottom: 2px solid rgba(255, 255, 255, 0.2);
      `;
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Table body
    const tbody = document.createElement('tbody');
    tbody.id = 'leaderboard-tbody';
    table.appendChild(tbody);

    tableContainer.appendChild(table);
    content.appendChild(tableContainer);

    return content;
  }

  /**
   * Imposta il tipo di ordinamento
   */
  setSortBy(sortBy: 'ranking_points' | 'honor' | 'experience' | 'kills'): void {
    this.leaderboardData.sortBy = sortBy;
    
    // Aggiorna stili dei pulsanti
    this.sortButtons.forEach((button, id) => {
      if (id === sortBy) {
        button.style.background = 'rgba(0, 255, 136, 0.3)';
        button.style.borderColor = 'rgba(0, 255, 136, 0.5)';
        button.style.color = '#00ff88';
      } else {
        button.style.background = 'rgba(255, 255, 255, 0.1)';
        button.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        button.style.color = 'rgba(255, 255, 255, 0.8)';
      }
    });

    // Richiedi nuova leaderboard con ordinamento
    this.requestLeaderboard();
  }

  /**
   * Richiede la leaderboard dal server
   */
  requestLeaderboard(): void {
    if (!this.clientNetworkSystem) {
      console.warn('[LeaderboardPanel] ClientNetworkSystem not available');
      return;
    }

    // Mostra loading
    if (this.loadingIndicator) {
      this.loadingIndicator.style.display = 'block';
    }

    const tbody = this.container.querySelector('#leaderboard-tbody');
    if (tbody) {
      tbody.innerHTML = '';
    }

    // Invia richiesta al server
    this.clientNetworkSystem.sendMessage({
      type: MESSAGE_TYPES.REQUEST_LEADERBOARD,
      sortBy: this.leaderboardData.sortBy,
      limit: 100
    });
  }

  /**
   * Calcola il rank militare basato sui ranking points
   */
  private calculateRankName(rankingPoints: number): string {
    const ranks = [
      { name: 'Chief General', minPoints: 100000 },
      { name: 'General', minPoints: 75000 },
      { name: 'Basic General', minPoints: 50000 },
      { name: 'Chief Colonel', minPoints: 35000 },
      { name: 'Colonel', minPoints: 25000 },
      { name: 'Basic Colonel', minPoints: 15000 },
      { name: 'Chief Major', minPoints: 10000 },
      { name: 'Major', minPoints: 7500 },
      { name: 'Basic Major', minPoints: 5000 },
      { name: 'Chief Captain', minPoints: 3500 },
      { name: 'Captain', minPoints: 2500 },
      { name: 'Basic Captain', minPoints: 1500 },
      { name: 'Chief Lieutenant', minPoints: 1000 },
      { name: 'Lieutenant', minPoints: 750 },
      { name: 'Basic Lieutenant', minPoints: 500 },
      { name: 'Chief Sergeant', minPoints: 350 },
      { name: 'Sergeant', minPoints: 250 },
      { name: 'Basic Sergeant', minPoints: 150 },
      { name: 'Chief Space Pilot', minPoints: 100 },
      { name: 'Space Pilot', minPoints: 50 },
      { name: 'Basic Space Pilot', minPoints: 25 },
      { name: 'Recruit', minPoints: 0 }
    ];

    for (const rank of ranks) {
      if (rankingPoints >= rank.minPoints) {
        return rank.name;
      }
    }

    return 'Recruit';
  }

  /**
   * Aggiorna i dati del pannello
   */
  update(data: PanelData): void {
    const leaderboardData = data as LeaderboardData;

    if (!leaderboardData) {
      console.warn('[LeaderboardPanel] No leaderboard data provided');
      return;
    }

    if (!leaderboardData.entries) {
      console.warn('[LeaderboardPanel] No entries array in leaderboard data');
      leaderboardData.entries = [];
    }

    this.leaderboardData = leaderboardData;
    this.updateDisplay();
  }

  /**
   * Aggiorna la visualizzazione della leaderboard
   */
  private updateDisplay(): void {
    // Nascondi loading
    if (this.loadingIndicator) {
      this.loadingIndicator.style.display = 'none';
    }

    const tbody = this.container.querySelector('#leaderboard-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (this.leaderboardData.entries.length === 0) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = `
        <td colspan="7" style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.5);">
          No players found
        </td>
      `;
      tbody.appendChild(emptyRow);
      return;
    }

    // Crea righe per ogni entry
    this.leaderboardData.entries.forEach((entry, index) => {
      const row = document.createElement('tr');
      const isCurrentPlayer = this.leaderboardData.playerRank === entry.rank;
      
      row.style.cssText = `
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        transition: background 0.2s ease;
        ${isCurrentPlayer ? 'background: rgba(0, 255, 136, 0.1);' : ''}
      `;

      row.addEventListener('mouseenter', () => {
        if (!isCurrentPlayer) {
          row.style.background = 'rgba(255, 255, 255, 0.05)';
        }
      });

      row.addEventListener('mouseleave', () => {
        if (!isCurrentPlayer) {
          row.style.background = 'transparent';
        } else {
          row.style.background = 'rgba(0, 255, 136, 0.1)';
        }
      });

      // Rank position con medaglie per top 3
      const rankCell = document.createElement('td');
      rankCell.style.cssText = `
        padding: 12px 8px;
        font-weight: 700;
        font-size: 14px;
        text-align: center;
        width: 60px;
      `;

      if (entry.rank === 1) {
        rankCell.textContent = '🥇';
        rankCell.style.fontSize = '18px';
      } else if (entry.rank === 2) {
        rankCell.textContent = '🥈';
        rankCell.style.fontSize = '18px';
      } else if (entry.rank === 3) {
        rankCell.textContent = '🥉';
        rankCell.style.fontSize = '18px';
      } else {
        rankCell.textContent = `#${entry.rank}`;
        rankCell.style.color = 'rgba(255, 255, 255, 0.7)';
      }

      // Username
      const usernameCell = document.createElement('td');
      usernameCell.textContent = entry.username || `Player #${entry.playerId}`;
      usernameCell.style.cssText = `
        padding: 12px 8px;
        font-weight: 600;
        color: ${isCurrentPlayer ? '#00ff88' : 'rgba(255, 255, 255, 0.9)'};
        min-width: 150px;
      `;

      // Rank name
      const rankNameCell = document.createElement('td');
      rankNameCell.textContent = entry.rankName || this.calculateRankName(entry.rankingPoints);
      rankNameCell.style.cssText = `
        padding: 12px 8px;
        font-size: 11px;
        color: rgba(255, 255, 255, 0.8);
        min-width: 120px;
      `;

      // Level
      const levelCell = document.createElement('td');
      levelCell.textContent = entry.level.toString();
      levelCell.style.cssText = `
        padding: 12px 8px;
        text-align: right;
        font-variant-numeric: tabular-nums;
        width: 80px;
      `;

      // Experience
      const expCell = document.createElement('td');
      expCell.textContent = entry.experience.toLocaleString();
      expCell.style.cssText = `
        padding: 12px 8px;
        text-align: right;
        font-variant-numeric: tabular-nums;
        color: rgba(255, 255, 255, 0.8);
        width: 140px;
      `;

      // Honor
      const honorCell = document.createElement('td');
      honorCell.textContent = entry.honor.toLocaleString();
      honorCell.style.cssText = `
        padding: 12px 8px;
        text-align: right;
        font-variant-numeric: tabular-nums;
        color: rgba(255, 255, 255, 0.8);
        width: 120px;
      `;

      // Kills
      const killsCell = document.createElement('td');
      killsCell.textContent = entry.kills.toLocaleString();
      killsCell.style.cssText = `
        padding: 12px 8px;
        text-align: right;
        font-variant-numeric: tabular-nums;
        color: rgba(255, 255, 255, 0.8);
        width: 100px;
      `;

      row.appendChild(rankCell);
      row.appendChild(usernameCell);
      row.appendChild(rankNameCell);
      row.appendChild(levelCell);
      row.appendChild(expCell);
      row.appendChild(honorCell);
      row.appendChild(killsCell);

      tbody.appendChild(row);
    });
  }

  /**
   * Callback quando il pannello viene mostrato
   */
  protected onShow(): void {
    // Richiedi leaderboard quando viene mostrato
    this.requestLeaderboard();
  }

  /**
   * Callback quando il pannello viene nascosto
   */
  protected onHide(): void {
    // Cleanup se necessario
  }
}
