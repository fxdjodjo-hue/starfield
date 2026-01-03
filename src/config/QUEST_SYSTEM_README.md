# Sistema Quest Modulare - Guida per Sviluppatori Senior

## 🎯 **Panoramica**

Il sistema quest è stato completamente rifattorizzato per essere **modulare, scalabile e single source of truth**. È progettato per facilitare l'aggiunta di nuove quest senza modificare il codice core.

## 🏗️ **Architettura**

### **Componenti Principali**

1. **`QuestConfig.ts`** - Sistema di configurazione centrale
2. **`QuestTrackingSystem.ts`** - Sistema di tracking basato su eventi
3. **`QuestManager.ts`** - Gestione ciclo di vita quest
4. **`QuestRegistry`** - Repository centralizzato delle configurazioni

### **Pattern Utilizzati**

- **Factory Pattern** per creazione obiettivi e ricompense
- **Registry Pattern** per gestione centralizzata
- **Event-Driven Architecture** per massima scalabilità
- **Configuration over Code** per facilità di manutenzione

## 📝 **Come Aggiungere una Nuova Quest**

### **Passo 1: Registrare la Quest**

```typescript
import { QuestRegistry, ObjectiveType, RewardType } from '../config/QuestConfig';

QuestRegistry.register({
  id: 'my_new_quest',
  title: 'La Mia Nuova Quest',
  description: 'Descrizione dettagliata della quest',
  type: 'custom', // categoria della quest
  objectives: [{
    id: 'objective_1',
    type: ObjectiveType.KILL, // KILL, COLLECT, EXPLORE, INTERACT
    description: 'Uccidi 5 Draghi',
    target: 5,
    targetType: 'dragon' // per KILL
    // targetName: 'gold_coin' // per COLLECT/EXPLORE
  }],
  rewards: [
    { type: RewardType.CREDITS, amount: 1000 },
    { type: RewardType.COSMOS, amount: 200 },
    { type: RewardType.EXPERIENCE, amount: 150 }
  ],
  prerequisites: ['previous_quest_id'], // opzionale
  levelRequirement: 5, // opzionale
  repeatable: false, // opzionale
  timeLimit: 3600 // secondi, opzionale
});
```

### **Passo 2: Triggerare Eventi**

Quando un giocatore compie un'azione rilevante, triggera un evento:

```typescript
import { QuestEventType } from '../config/QuestConfig';

// Esempio: uccisione NPC
const event = {
  type: QuestEventType.NPC_KILLED,
  targetId: 'dragon',
  targetType: 'dragon',
  amount: 1
};

questTrackingSystem.triggerEvent(event);

// Esempio: raccolta item
const collectEvent = {
  type: QuestEventType.ITEM_COLLECTED,
  targetId: 'gold_coin',
  targetType: 'item',
  amount: 5
};

questTrackingSystem.triggerEvent(collectEvent);
```

## 🎮 **Tipi di Obiettivo Supportati**

| Tipo | Descrizione | Esempio |
|------|-------------|---------|
| `KILL` | Uccidere NPC di un tipo specifico | targetType: 'dragon' |
| `COLLECT` | Raccogliere item | targetName: 'gold_coin' |
| `EXPLORE` | Visitare location | targetName: 'hidden_cave' |
| `INTERACT` | Interagire con oggetti/NPC | targetName: 'ancient_rune' |

## 🏆 **Tipi di Ricompensa Supportati**

| Tipo | Descrizione | Note |
|------|-------------|------|
| `CREDITS` | Moneta di gioco principale | Sempre disponibile |
| `COSMOS` | Valuta premium | Sempre disponibile |
| `EXPERIENCE` | Punti esperienza | TODO: implementare sistema exp |
| `HONOR` | Punti onore | TODO: implementare sistema onore |
| `ITEM` | Oggetti specifici | TODO: implementare inventario |

## 🔧 **Estensioni Future**

### **Aggiungere Nuovi Tipi di Obiettivo**

1. Aggiungi il nuovo tipo in `ObjectiveType` enum
2. Implementa la logica in `QuestTrackingSystem.shouldUpdateObjective()`
3. Aggiorna la documentazione

### **Aggiungere Nuovi Tipi di Ricompensa**

1. Aggiungi il nuovo tipo in `RewardType` enum
2. Implementa la logica in `QuestTrackingSystem.applyQuestRewards()`
3. Implementa il sistema di gestione (es. inventario per item)

### **Sistema di Quest Dinamiche**

```typescript
// Esempio: quest generate proceduralmente
function createDynamicQuest(difficulty: number): QuestConfig {
  return {
    id: `dynamic_quest_${Date.now()}`,
    title: `Sfida di Livello ${difficulty}`,
    // ... configurazione basata su difficulty
  };
}
```

## 📊 **Monitoraggio e Debug**

### **Logging Automatico**

Il sistema logga automaticamente:
- ✅ Registrazione quest completate
- ✅ Eventi di quest ricevuti
- ✅ Ricompense assegnate
- ✅ Errori di configurazione

### **API di Debug**

```typescript
// Ottieni suggerimenti quest per un giocatore
const suggestions = questTrackingSystem.getQuestSuggestions(playerLevel, completedQuestIds);

// Valida se una quest è disponibile
const isValid = questTrackingSystem.validateQuest(questId, playerLevel, completedQuestIds);

// Lista tutte le quest registrate
const allQuests = QuestRegistry.getAll();
```

## 🚀 **Vantaggi del Nuovo Sistema**

### **Scalabilità**
- ✅ Aggiungi infinite quest senza modificare codice core
- ✅ Supporto per qualsiasi tipo di NPC/item/location
- ✅ Facile espansione per nuovi tipi di obiettivo

### **Manutenibilità**
- ✅ Single source of truth (QuestRegistry)
- ✅ Configurazione esterna JSON-like
- ✅ Logica centralizzata e testabile

### **Performance**
- ✅ Event-driven (no polling costante)
- ✅ Caricamento lazy delle configurazioni
- ✅ Cache efficiente delle quest attive

### **Estensibilità**
- ✅ Facile aggiungere nuovi tipi di quest
- ✅ Sistema modulare per feature future
- ✅ API chiara per integrazioni

## 🎯 **Best Practices**

1. **Usa ID descrittivi**: `kill_dragons_quest` invece di `q1`
2. **Definisci prerequisiti**: Aiuta con il bilanciamento
3. **Testa gli eventi**: Assicurati che gli eventi vengano triggerati correttamente
4. **Documenta le quest**: Descrizioni chiare per i giocatori
5. **Versiona le config**: Per aggiornamenti sicuri

## 🔍 **Troubleshooting**

### **Quest non appare**
- ✅ Verifica che sia registrata: `QuestRegistry.get(questId)`
- ✅ Controlla prerequisiti e livello richiesto
- ✅ Verifica che `initializeDefaultQuests()` sia chiamato

### **Obiettivi non si aggiornano**
- ✅ Verifica che gli eventi vengano triggerati
- ✅ Controlla che `targetType`/`targetName` corrispondano
- ✅ Debug: `questTrackingSystem.triggerEvent(event)` con logging

### **Ricompense non vengono assegnate**
- ✅ Verifica che `economySystem` sia configurato
- ✅ Controlla che i metodi di assegnazione esistano
- ✅ TODO: Implementare sistemi exp/honor/inventario

Questo sistema è progettato per crescere con il tuo gioco! 🚀✨

