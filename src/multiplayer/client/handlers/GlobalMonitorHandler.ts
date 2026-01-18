import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';

/**
 * Gestisce gli aggiornamenti del monitor globale dal server
 * Fornisce dati aggregati per dashboard di monitoraggio
 */
export class GlobalMonitorHandler extends BaseMessageHandler {
  private monitorUI: GlobalMonitorUI | null = null;

  constructor() {
    super('global_monitor_update');
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    const { state } = message;

    if (!this.monitorUI) {
      this.monitorUI = new GlobalMonitorUI();
    }

    this.monitorUI.updateGlobalState(state);
  }
}

/**
 * Classe per gestire l'UI del monitor globale
 * Implementazione base - può essere estesa per dashboard reali
 */
class GlobalMonitorUI {
  private isVisible: boolean = false;

  updateGlobalState(state: any) {
    // Log base per debugging
    console.group('🌍 Global Monitor Update');
    console.log('Server:', state.server);
    console.log('Players:', state.players.length);
    console.log('NPCs:', state.aggressiveNpcs.length);
    console.log('Resources:', state.resourceSummary);

    if (state.criticalEvents.length > 0) {
      console.log('Recent Events:', state.criticalEvents.slice(-5));
    }

    console.groupEnd();

    // Qui puoi implementare l'aggiornamento di una dashboard reale
    // Es: aggiornare elementi DOM, charts, etc.
    this.updateDashboard(state);
  }

  private updateDashboard(state: any) {
    // Placeholder per implementazione dashboard reale
    // Puoi collegare questo a elementi HTML o componenti UI

    if (this.isVisible) {
      // Aggiorna elementi DOM esistenti
      this.updateServerStats(state.server);
      this.updatePlayerList(state.players);
      this.updateNpcList(state.aggressiveNpcs);
      this.updateResourceSummary(state.resourceSummary);
      this.updateEventsList(state.criticalEvents);
    }
  }

  private updateServerStats(server: any) {
    // Implementa aggiornamento UI server stats
    const uptimeEl = document.getElementById('monitor-uptime');
    if (uptimeEl) {
      uptimeEl.textContent = this.formatTime(server.uptime);
    }

    const playerCountEl = document.getElementById('monitor-player-count');
    if (playerCountEl) {
      playerCountEl.textContent = server.totalPlayers;
    }
  }

  private updatePlayerList(players: any[]) {
    // Implementa aggiornamento lista player
    const listEl = document.getElementById('monitor-player-list');
    if (listEl) {
      listEl.innerHTML = players.map(player =>
        `<div class="monitor-player ${player.vitals.isDead ? 'dead' : ''}">
          ${player.nickname}: HP ${player.vitals.health}/${player.vitals.maxHealth}
          ${player.combat.inCombat ? ' [COMBAT]' : ''}
        </div>`
      ).join('');
    }
  }

  private updateNpcList(npcs: any[]) {
    // Implementa aggiornamento lista NPC
    const listEl = document.getElementById('monitor-npc-list');
    if (listEl) {
      listEl.innerHTML = npcs.map(npc =>
        `<div class="monitor-npc">
          ${npc.type}: HP ${npc.vitals.health}/${npc.vitals.maxHealth}
          ${npc.combat.targetPlayer ? `→ ${npc.combat.targetPlayer.nickname}` : ''}
        </div>`
      ).join('');
    }
  }

  private updateResourceSummary(summary: any) {
    // Implementa aggiornamento riepilogo risorse
    const creditsEl = document.getElementById('monitor-total-credits');
    if (creditsEl) {
      creditsEl.textContent = summary.totalCredits;
    }

    const cosmosEl = document.getElementById('monitor-total-cosmos');
    if (cosmosEl) {
      cosmosEl.textContent = summary.totalCosmos;
    }
  }

  private updateEventsList(events: any[]) {
    // Implementa aggiornamento lista eventi
    const listEl = document.getElementById('monitor-events-list');
    if (listEl) {
      listEl.innerHTML = events.slice(-10).reverse().map(event =>
        `<div class="monitor-event ${event.type.includes('DEATH') ? 'critical' : ''}">
          ${new Date(event.timestamp).toLocaleTimeString()}: ${event.type}
        </div>`
      ).join('');
    }
  }

  private formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }

  show() {
    this.isVisible = true;
    // Mostra elementi UI del monitor
  }

  hide() {
    this.isVisible = false;
    // Nasconde elementi UI del monitor
  }
}