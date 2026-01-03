# 🖥️ User Interface Layer

**Sistema UI HTML/CSS per Starfield - Pannelli Flottanti e Interfacce Moderne**

Il layer UI gestisce interfacce utente HTML/CSS sovrapposte al canvas di gioco, fornendo pannelli interattivi accessibili tramite icone flottanti.

## 📋 Componenti UI

### UIManager
**Sistema centrale di gestione UI - Coordina pannelli e icone flottanti**

**File:** `UIManager.ts`

**Responsabilità:**
- Gestione centralizzata di tutti i pannelli UI
- Posizionamento automatico e responsive
- Toggle visibilità collettiva
- Event handling per interazioni esterne

**Caratteristiche:**
- Gestione memoria automatica
- Responsive design
- API unificata per tutti i pannelli

### BasePanel
**Classe astratta base per tutti i pannelli UI**

**File:** `UIManager.ts`

**Metodi astratti:**
- `createPanelContent()`: Definisce il layout specifico del pannello
- `update(data)`: Aggiorna i dati visualizzati

**Caratteristiche ereditate:**
- Centratura automatica al centro schermo
- Animazioni apertura/chiusura
- Event handling integrato
- Styling consistente

### FloatingIcon
**Icone flottanti per accedere ai pannelli**

**File:** `UIManager.ts`

**Posizioni disponibili:**
- `top-left`, `top-right`
- `center-left`, `bottom-left`, `bottom-right`

**Caratteristiche:**
- Hover effects eleganti
- Indicatori stato attivo
- Posizionamento intelligente

### PlayerStatsPanel
**Pannello statistiche giocatore con design moderno**

**File:** `PlayerStatsPanel.ts`

**Statistiche visualizzate:**
- Livello e esperienza (con progress bar)
- Crediti e onore
- Uccisioni totali
- Tempo di gioco

**Design features:**
- Layout a griglia responsive
- Card con hover effects
- Gradienti moderni
- Icone colorate per categoria

## 🎨 Design Principles

### Modern Glass Morphism
```typescript
// Styling moderno con effetti vetro
const PANEL_STYLE = `
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
`;
```

### Scalable Architecture
```typescript
// Creazione pannello semplice
const config = {
  id: 'inventory',
  icon: '🎒',
  title: 'Inventario',
  position: 'bottom-left',
  size: { width: 400, height: 500 }
};

const panel = new InventoryPanel(config);
uiManager.registerPanel(panel);
```

### Responsive & Accessible
- Centratura automatica su qualsiasi risoluzione
- Testo non selezionabile per migliore UX
- Effetti hover e transizioni fluide
- Z-index gerarchico per sovrapposizioni corrette

## 🔗 Integrazione con Game States

### PlayState Integration
```typescript
class PlayState extends GameState {
  private uiManager: UIManager;

  async enter(context: GameContext) {
    // Inizializza sistema UI
    this.initializeUI();

    // Toggle UI con HUD (tasto H)
    this.setupHudToggle();
  }

  private initializeUI(): void {
    // Crea e registra pannelli
    const statsPanel = new PlayerStatsPanel({
      id: 'player-stats',
      icon: '📊',
      title: 'Statistiche Giocatore',
      position: 'center-left',
      size: { width: 1300, height: 750 }
    });

    this.uiManager.registerPanel(statsPanel);
  }

  update(deltaTime: number) {
    // Aggiorna dati pannelli
    this.updateUIPanels();
  }
}
```

## 🎯 UI Architecture Moderna

### Component-Based Design
```typescript
// Ogni pannello è indipendente e modulare
export class InventoryPanel extends BasePanel {
  protected createPanelContent(): HTMLElement {
    // Layout specifico inventario
    return inventoryElement;
  }

  update(data: PanelData): void {
    // Logica aggiornamento inventario
    this.updateInventory(data.items);
  }
}
```

### Single Source of Truth
```typescript
// Configurazione centralizzata per ogni pannello
const panelConfig = {
  id: 'settings',
  icon: '⚙️',
  title: 'Impostazioni',
  position: 'top-right',
  size: { width: 350, height: 450 }
};

// Stessa config per icona e pannello
const panel = new SettingsPanel(panelConfig);
uiManager.registerPanel(panel);
```

### Type-Safe Data Flow
```typescript
interface PlayerStatsData {
  level: number;
  experience: number;
  credits: number;
  honor: number;
  kills: number;
  playtime: number;
}

// Update type-safe
panel.update(playerStatsData);
```

## 🚀 Aggiungere Nuovi Pannelli

### 1. Crea la classe pannello
```typescript
export class InventoryPanel extends BasePanel {
  protected createPanelContent(): HTMLElement {
    // Implementa layout inventario
  }

  update(data: PanelData): void {
    // Implementa logica aggiornamento
  }
}
```

### 2. Definisci configurazione
```typescript
const inventoryConfig = {
  id: 'inventory',
  icon: '🎒',
  title: 'Inventario',
  position: 'bottom-left',
  size: { width: 400, height: 600 }
};
```

### 3. Registra nel PlayState
```typescript
const inventoryPanel = new InventoryPanel(inventoryConfig);
this.uiManager.registerPanel(inventoryPanel);
```

## 📱 Funzionalità Implementate

- ✅ **Icone flottanti responsive**
- ✅ **Pannelli centrati automaticamente**
- ✅ **Design moderno con glass morphism**
- ✅ **Animazioni fluide e hover effects**
- ✅ **Sistema scalabile per nuovi pannelli**
- ✅ **TypeScript con type safety completa**
- ✅ **Cross-browser compatibility**
- ✅ **Gestione memoria automatica**

## 🎮 User Experience

### Interazioni Intuituve
- **Click icone** → apertura pannelli
- **Click esterno** → chiusura pannelli
- **Tasto H** → toggle visibilità UI
- **Hover effects** → feedback visivo

### Design Professionale
- **Gradienti moderni** e sfondi trasparenti
- **Typography gerarchica** e spaziatura consistente
- **Colori coerenti** e palette professionale
- **Animazioni smooth** per transizioni

Questa UI fornisce un'**esperienza moderna e intuitiva** per l'interazione utente in Starfield! 🚀✨
