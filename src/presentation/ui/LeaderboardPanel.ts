import { BasePanel } from './FloatingIcon';
import { NumberFormatter } from '../../core/utils/ui/NumberFormatter';
import type { PanelConfig } from './PanelConfig';
import type { PanelData } from './UIManager';
import type { ClientNetworkSystem } from '../../multiplayer/client/ClientNetworkSystem';
import { MESSAGE_TYPES } from '../../config/NetworkConfig';
import { RankSystem } from '../../core/domain/rewards/RankSystem';

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
  playTime: number; // in secondi
  rankName: string; // Rank militare (es. "Chief General")
}

/**
 * Dati per il pannello leaderboard
 */
export interface LeaderboardData {
  entries: LeaderboardEntry[];
  sortBy: 'ranking_points' | 'honor' | 'experience';
  playerRank?: number; // Posizione del giocatore corrente
}

/**
 * LeaderboardPanel - Pannello che mostra la classifica globale dei giocatori
 * Implementa l'interfaccia BasePanel per l'integrazione nel sistema UI
 */
// Palette colori standardizzata - Allineata con ChatUIRenderer e QuestPanel
const THEME = {
  colors: {
    background: {
      panel: 'rgba(0, 0, 0, 0.45)', // Match ChatUI
      header: 'rgba(255, 255, 255, 0.05)',
      rowHover: 'rgba(255, 255, 255, 0.05)',
      rowCurrent: 'rgba(255, 255, 255, 0.1)', // More neutral current row
      buttonDefault: 'rgba(255, 255, 255, 0.05)',
      buttonActive: 'rgba(255, 255, 255, 0.15)',
    },
    border: {
      light: 'rgba(255, 255, 255, 0.08)',
      focus: 'rgba(255, 255, 255, 0.25)',
      separator: 'rgba(255, 255, 255, 0.08)'
    },
    text: {
      primary: 'rgba(255, 255, 255, 0.9)', // Match ChatUI
      secondary: 'rgba(255, 255, 255, 0.6)',
      accent: '#ffffff', // Removed neon green for consistency
      danger: '#ef4444'
    }
  },
  layout: {
    padding: '24px',
    borderRadius: '25px', // Match ChatUI rounded corners
    rowHeight: '48px',
    headerHeight: '40px',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
  }
};

const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * LeaderboardPanel - Pannello che mostra la classifica globale dei giocatori
 * Implementa l'interfaccia BasePanel per l'integrazione nel sistema UI
 */
export class LeaderboardPanel extends BasePanel {
  private leaderboardData: LeaderboardData = {
    entries: [],
    sortBy: 'ranking_points'
  };
  private clientNetworkSystem: ClientNetworkSystem | null = null;
  private autoRefreshIntervalId: number | null = null;

  constructor(config: PanelConfig, clientNetworkSystem?: ClientNetworkSystem | null) {
    super(config);
    this.clientNetworkSystem = clientNetworkSystem || null;
  }

  setClientNetworkSystem(clientNetworkSystem: ClientNetworkSystem): void {
    this.clientNetworkSystem = clientNetworkSystem;
    clientNetworkSystem.onReconnected(() => {
      if (this.isVisible && this.leaderboardData.entries.length === 0) {
        this.requestLeaderboard();
      }
    });

    if (this.autoRefreshIntervalId === null) {
      this.autoRefreshIntervalId = window.setInterval(() => {
        this.requestLeaderboard();
      }, AUTO_REFRESH_INTERVAL_MS);
    }

    if (this.isVisible && this.leaderboardData.entries.length === 0) {
      this.requestLeaderboard();
    }
  }

  protected createPanelContent(): HTMLElement {
    const content = document.createElement('div');
    content.className = 'leaderboard-content';
    content.style.cssText = `
      position: absolute;
      inset: 0;
      padding: ${THEME.layout.padding};
      display: flex;
      flex-direction: column;
      gap: 16px;
      background: ${THEME.colors.background.panel};
      backdrop-filter: blur(20px) saturate(160%);
      -webkit-backdrop-filter: blur(20px) saturate(160%);
      border: 1px solid ${THEME.colors.border.light};
      border-radius: ${THEME.layout.borderRadius};
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.05);
      box-sizing: border-box;
      user-select: none;
      font-family: ${THEME.layout.fontFamily};
    `;

    // Hide scrollbar style & Animation
    const style = document.createElement('style');
    style.textContent = `
      .leaderboard-content::-webkit-scrollbar { display: none; }
      .leaderboard-table-container::-webkit-scrollbar { width: 6px; }
      .leaderboard-table-container::-webkit-scrollbar-track { background: transparent; }
      .leaderboard-table-container::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
      .leaderboard-table-container::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      
      @keyframes leaderboard-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    content.appendChild(style);

    // Header Section (Title + Subtitle + Close)
    const headerSection = document.createElement('div');
    headerSection.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 16px; 
      border-bottom: 1px solid ${THEME.colors.border.light};
    `;

    const titleGroup = document.createElement('div');
    const title = document.createElement('h2');
    title.textContent = 'LEADERBOARD';
    title.style.cssText = `
      margin: 0;
      color: ${THEME.colors.text.primary};
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 3px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
    `;

    const subtitle = document.createElement('p');
    subtitle.textContent = 'ELITE PILOT RANKINGS';
    subtitle.style.cssText = `
      margin: 4px 0 0 0;
      color: ${THEME.colors.text.secondary};
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
    `;

    titleGroup.appendChild(title);
    titleGroup.appendChild(subtitle);

    const closeButton = this.createCloseButton();
    headerSection.appendChild(titleGroup);
    headerSection.appendChild(closeButton);
    content.appendChild(headerSection);

    // Table Container
    const tableContainer = document.createElement('div');
    tableContainer.className = 'leaderboard-table-container';
    tableContainer.style.cssText = `
      flex: 1;
      position: relative;
      overflow-y: auto;
      border-radius: 8px;
    `;

    const table = document.createElement('table');
    table.style.cssText = `
      width: 100%;
      border-collapse: collapse;
      color: ${THEME.colors.text.primary};
    `;

    // Header row (sticky behavior is applied on each TH for reliable cross-browser rendering)
    const thead = document.createElement('thead');
    thead.style.cssText = `
      position: relative;
      z-index: 20;
    `;

    const headerRow = document.createElement('tr');
    const columns = [
      { text: '#', align: 'center', width: '10%' },
      { text: 'PILOT', align: 'left', width: '40%' },
      { text: 'RANK', align: 'center', width: '15%' },
      { text: 'EXP', align: 'right', width: '17%' },
      { text: 'HONOR', align: 'right', width: '18%' }
    ];

    columns.forEach(col => {
      const th = document.createElement('th');
      th.textContent = col.text;
      th.style.cssText = `
        padding: 16px 8px;
        position: sticky;
        top: 0;
        z-index: 21;
        background: rgba(10, 14, 24, 0.94);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        text-align: ${col.align};
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 1px;
        color: ${THEME.colors.text.secondary};
        border-bottom: 1px solid ${THEME.colors.border.separator};
        width: ${col.width};
        box-sizing: border-box;
      `;
      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    tbody.id = 'leaderboard-tbody';
    table.appendChild(tbody);
    tableContainer.appendChild(table);
    content.appendChild(tableContainer);

    // Loading Spinner
    content.appendChild(this.createLoadingSpinner());

    return content;
  }

  private createCloseButton(): HTMLElement {
    const button = document.createElement('button');
    button.textContent = '×';
    button.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      border: none;
      color: ${THEME.colors.text.secondary};
      font-size: 24px;
      line-height: 1;
      cursor: pointer;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    `;
    button.addEventListener('mouseenter', () => {
      button.style.background = 'rgba(239, 68, 68, 0.2)';
      button.style.color = THEME.colors.text.danger;
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = 'rgba(255, 255, 255, 0.05)';
      button.style.color = THEME.colors.text.secondary;
    });
    button.addEventListener('click', () => this.hide());
    return button;
  }

  private createLoadingSpinner(): HTMLElement {
    const spinner = document.createElement('div');
    spinner.id = 'leaderboard-loading-spinner';
    spinner.style.cssText = `
      position: absolute;
      inset: 0;
      display: none;
      z-index: 50;
      background: rgba(0,0,0,0.6); // Denser background for better visibility
      backdrop-filter: blur(4px);
      align-items: center;
      justify-content: center;
    `;
    // Use white spinner for the new neutral theme
    spinner.innerHTML = `
      <div style="border: 3px solid rgba(255,255,255,0.1); border-top-color: #ffffff; border-radius: 50%; width: 48px; height: 48px; animation: leaderboard-spin 1s linear infinite;"></div>
    `;
    return spinner;
  }

  private getLoadingSpinner(): HTMLElement | null {
    return this.container.querySelector('#leaderboard-loading-spinner');
  }


  private requestLeaderboardWithRetry(retryCount: number = 0): void {
    if (this.clientNetworkSystem) {
      this.requestLeaderboard();
    } else if (retryCount < 5) {
      setTimeout(() => this.requestLeaderboardWithRetry(retryCount + 1), Math.min(100 * Math.pow(2, retryCount), 1000));
    } else {
      // Failed to get network system, hide spinner or show error
      const spinner = this.getLoadingSpinner();
      if (spinner) spinner.style.display = 'none';
      console.warn('Leaderboard: Failed to connect to network system for request');
    }
  }

  requestLeaderboard(): void {
    if (!this.clientNetworkSystem?.isConnected()) return;
    const tbody = this.container.querySelector('#leaderboard-tbody');
    if (tbody) tbody.innerHTML = '';

    // Show spinner
    const spinner = this.getLoadingSpinner();
    if (spinner) spinner.style.display = 'flex';

    this.clientNetworkSystem.sendMessage({
      type: MESSAGE_TYPES.REQUEST_LEADERBOARD,
      sortBy: this.leaderboardData.sortBy,
      limit: 100
    });
  }

  update(data: PanelData): void {
    const leaderboardData = data as LeaderboardData;
    if (!leaderboardData) return;
    this.leaderboardData = leaderboardData;
    if (!this.leaderboardData.entries) this.leaderboardData.entries = [];
    this.updateDisplay();
  }

  private updateDisplay(): void {
    const spinner = this.getLoadingSpinner();
    if (spinner) spinner.style.display = 'none';
    const tbody = this.container.querySelector('#leaderboard-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (this.leaderboardData.entries.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="padding: 40px; text-align: center; color: ${THEME.colors.text.secondary}">No active pilots found</td></tr>`;
      return;
    }

    this.leaderboardData.entries.forEach((entry, index) => {
      const row = document.createElement('tr');
      const isCurrentPlayer = this.leaderboardData.playerRank === entry.rank;

      row.style.cssText = `
        border-bottom: 1px solid ${THEME.colors.border.separator};
        background: ${isCurrentPlayer ? THEME.colors.background.rowCurrent : 'transparent'};
        transition: background 0.15s ease;
      `;

      if (!isCurrentPlayer) {
        row.addEventListener('mouseenter', () => row.style.background = THEME.colors.background.rowHover);
        row.addEventListener('mouseleave', () => row.style.background = 'transparent');
      }

      // 1. Rank #
      const rankCell = document.createElement('td');
      rankCell.style.cssText = `padding: 12px 8px; text-align: center; font-weight: 700; width: 10%; box-sizing: border-box;`;

      if (entry.rank <= 3) {
        rankCell.innerHTML = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉';
        rankCell.style.fontSize = '18px';
      } else {
        rankCell.textContent = `#${entry.rank}`;
        rankCell.style.color = THEME.colors.text.secondary;
        rankCell.style.fontSize = '13px';
      }

      // 2. Player Name
      const usernameCell = document.createElement('td');
      usernameCell.textContent = entry.username || `Unknown Pilot`;
      usernameCell.style.cssText = `
        padding: 12px 8px;
        text-align: left;
        font-weight: 700;
        font-size: 13px;
        color: ${isCurrentPlayer ? '#ffffff' : THEME.colors.text.primary}; /* Keep white even for current user, maybe just bold/bg differs */
        width: 40%;
        box-sizing: border-box;
      `;

      // 3. Rank Icon (CRITICAL FIX PRESERVED)
      const rankIconCell = document.createElement('td');
      const resolvedRankName = entry.rankName || 'Space Pilot';
      const isChiefGeneral = resolvedRankName.toLowerCase().includes('chief general');

      // The container uses inline-flex for perfect centering in the cell
      const iconContainer = document.createElement('div');
      iconContainer.style.cssText = `
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 44px;
        height: 24px;
      `;

      const rankIcon = document.createElement('img');
      rankIcon.src = this.getRankIconPath(resolvedRankName);
      rankIcon.title = resolvedRankName;
      // Precise styles from user feedback iteration
      rankIcon.style.cssText = `
        max-height: 18px;
        max-width: 38px;
        width: auto;
        height: auto;
        display: block;
        object-fit: contain;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
        ${isChiefGeneral ? 'margin-left: 10px;' : ''}
      `;

      iconContainer.appendChild(rankIcon);
      rankIconCell.appendChild(iconContainer);
      rankIconCell.style.cssText = `padding: 8px 0; text-align: center; width: 15%; box-sizing: border-box;`;

      // 4. Exp
      const expCell = document.createElement('td');
      expCell.textContent = NumberFormatter.format(entry.experience);
      expCell.style.cssText = `padding: 12px 8px; text-align: right; font-family: monospace; font-size: 12px; color: ${THEME.colors.text.secondary}; width: 17%; box-sizing: border-box;`;

      // 5. Honor
      const honorCell = document.createElement('td');
      honorCell.textContent = NumberFormatter.format(entry.honor);
      honorCell.style.cssText = `padding: 12px 8px; text-align: right; font-family: monospace; font-size: 12px; color: ${THEME.colors.text.secondary}; width: 18%; box-sizing: border-box;`;

      row.appendChild(rankCell);
      row.appendChild(usernameCell);
      row.appendChild(rankIconCell);
      row.appendChild(expCell);
      row.appendChild(honorCell);
      tbody.appendChild(row);
    });
  }

  protected onShow(): void {
    const spinner = this.getLoadingSpinner();
    if (spinner) spinner.style.display = 'flex';
    setTimeout(() => this.requestLeaderboardWithRetry(), 50);
  }

  private getRankIconPath(rankName: string): string {
    const fileName = rankName.toLowerCase().replace(/\s+/g, '') + '.png';
    return `assets/playerRanks/${fileName}`;
  }

  protected onHide(): void { }
}
