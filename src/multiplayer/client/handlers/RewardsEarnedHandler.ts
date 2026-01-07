import { BaseMessageHandler } from './MessageHandler';
import { ClientNetworkSystem } from '../ClientNetworkSystem';

/**
 * Gestisce le notifiche di ricompense guadagnate dal giocatore
 */
export class RewardsEarnedHandler extends BaseMessageHandler {
  constructor() {
    super('rewards_earned');
  }

  handle(message: any, networkSystem: ClientNetworkSystem): void {
    const { rewards, source, totalInventory } = message;

    console.log('🔍 [REWARDS] Messaggio ricevuto:', message);
    console.log('🔍 [REWARDS] totalInventory estratto:', totalInventory);

    // Usa il LogSystem esistente per mostrare le ricompense al giocatore
    const logSystem = networkSystem.getLogSystem();
    if (logSystem) {
      logSystem.logReward(rewards.credits, rewards.cosmos, rewards.experience, rewards.honor);
      if (rewards.skillPoints && rewards.skillPoints > 0) {
        // Log separato per SkillPoints
        console.log(`🎯 Guadagnati ${rewards.skillPoints} SkillPoints!`);
      }
    }

    // AGGIORNA L'ECONOMY SYSTEM DEL CLIENT con le ricompense ricevute
    const economySystem = networkSystem.getEconomySystem();
    if (economySystem) {
      console.log('💰 [ECONOMY] Aggiornando EconomySystem con ricompense ricevute');
      if (rewards.credits && rewards.credits > 0) {
        economySystem.addCredits(rewards.credits, 'npc_kill');
      }
      if (rewards.cosmos && rewards.cosmos > 0) {
        economySystem.addCosmos(rewards.cosmos, 'npc_kill');
      }
      if (rewards.experience && rewards.experience > 0) {
        economySystem.addExperience(rewards.experience, 'npc_kill');
      }
      if (rewards.honor && rewards.honor > 0) {
        economySystem.addHonor(rewards.honor, 'npc_kill');
      }
      if (rewards.skillPoints && rewards.skillPoints > 0) {
        economySystem.addSkillPoints(rewards.skillPoints, 'npc_kill');
      }
      console.log('✅ [ECONOMY] EconomySystem aggiornato con ricompense');
    }

    // Aggiorna il PlayerHUD con i nuovi dati dell'inventario (come backup)
    const uiSystem = networkSystem.getUiSystem();
    if (uiSystem) {
      const playerHUD = uiSystem.getPlayerHUD();
      if (playerHUD) {
        playerHUD.updateData({
          level: 1, // Per ora fisso, possiamo implementare calcolo livello dopo
          credits: totalInventory.credits,
          cosmos: totalInventory.cosmos,
          experience: totalInventory.experience,
          expForNextLevel: 1000, // Placeholder, possiamo calcolare dopo
          honor: totalInventory.honor
        });

        // Forza la visualizzazione dell'HUD se non è già visibile
        playerHUD.show();
        console.log('✅ [HUD] PlayerHUD aggiornato come backup');
      }
    }

    // Mantieni console.log per debug sviluppatori
    console.log(`🎁 Ricompense guadagnate! ${rewards.credits} credits, ${rewards.cosmos} cosmos, ${rewards.experience} XP, ${rewards.honor} honor, ${rewards.skillPoints} skillPoints`);
    console.log(`📊 Inventario totale: ${totalInventory.credits} credits, ${totalInventory.cosmos} cosmos, ${totalInventory.experience} XP, ${totalInventory.honor} honor, ${totalInventory.skillPoints} skillPoints`);

    // Il LogSystem mostra già la notifica, ma puoi aggiungere logica aggiuntiva qui
    // per aggiornare HUD, suonare effetti, ecc.
  }
}
