# 🖥️ User Interface Layer

**Sistema UI HTML/CSS per Starfield - Pannelli Flottanti e Interfacce Moderne**

Il layer UI gestisce interfacce utente HTML/CSS sovrapposte al canvas di gioco, fornendo pannelli interattivi accessibili tramite icone flottanti.

## 📋 Componenti UI

### 🏠 StartScreen
**Schermata iniziale del gioco con input nickname**

**File:** `StartScreen.ts`

**Elementi:**
- Titolo del gioco con effetti visivi
- Campo input per nickname giocatore
- Pulsante "Play" per avviare la partita
- Informazioni versione
- Sfondo animato

**Responsabilità:**
- Prima interazione utente
- Raccolta informazioni iniziali (nickname)
- Transizione allo stato di gioco

**Integrazione:**
```typescript
const startScreen = new StartScreen(context);
startScreen.setOnPlayCallback((nickname) => {
  // Transizione a PlayState
});
```

### 📊 PlayerHUD
**HUD del giocatore con statistiche essenziali**

**File:** `PlayerHUD.ts`

**Statistiche visualizzate:**
- Livello giocatore
- Crediti attuali
- Punti Cosmos
- Esperienza (barra progresso)
- Onore accumulato

**Caratteristiche:**
- Posizionato in alto a sinistra
- Design glass morphism
- Aggiornamenti real-time
- Toggle con tasto H

**Architettura:**
- Separazione logica-business/presentazione
- Interfaccia type-safe per dati
- Styling consistente

### 🗺️ Minimap
**Minimappa interattiva per navigazione**

**File:** `Minimap.ts`

**Funzionalità:**
- Overview quadrata del mondo di gioco
- Rappresentazione entità come pallini colorati
- Click-to-move per navigazione rapida
- Zoom e pan configurabili

**Elementi visualizzati:**
- Giocatore (pallino speciale)
- NPC nemici
- NPC selezionati (evidenziati)
- Bordi mondo di gioco

**Configurazione:**
- Dimensioni personalizzabili
- Colori configurabili per ogni tipo entità
- Fattore scala adattivo

### 🎛️ UIManager (Moderno)
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

### 📋 BasePanel
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

### 🎯 FloatingIcon
**Icone flottanti per accedere ai pannelli**

**File:** `UIManager.ts`

**Posizioni disponibili:**
- `top-left`, `top-right`
- `center-left`, `bottom-left`, `bottom-right`

**Caratteristiche:**
- Hover effects eleganti
- Indicatori stato attivo
- Posizionamento intelligente

### 📈 PlayerStatsPanel
**Pannello statistiche giocatore dettagliate**

**File:** `PlayerStatsPanel.ts`

**Statistiche visualizzate:**
- Livello e esperienza (con progress bar animata)
- Crediti e onore
- Uccisioni totali
- Tempo di gioco

**Design features:**
- Layout a griglia responsive (2 colonne)
- Card moderne con hover effects
- Gradienti e glass morphism
- Icone colorate per categoria
- Pulsante chiusura elegante

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

### StartState Integration
```typescript
class StartState extends GameState {
  private startScreen: StartScreen;

  async enter(context: GameContext) {
    // Crea schermata iniziale
    this.startScreen = new StartScreen(context);

    // Callback per transizione a PlayState
    this.startScreen.setOnPlayCallback((nickname) => {
      context.playerNickname = nickname;
      // Transizione a PlayState
    });
  }
}
```

### PlayState Integration
```typescript
class PlayState extends GameState {
  private playerHUD: PlayerHUD;
  private minimap: Minimap;
  private uiManager: UIManager;

  async enter(context: GameContext) {
    // Inizializza componenti UI
    this.playerHUD = new PlayerHUD();
    this.minimap = new Minimap();
    this.uiManager = new UIManager();

    // Setup sistemi UI
    this.initializeUI();
    this.setupHudToggle();
  }

  private initializeUI(): void {
    // Registra pannelli moderni
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
    // Aggiorna HUD e minimappa
    this.updatePlayerHUD();
    this.updateMinimap();

    // Aggiorna pannelli moderni
    this.updateUIPanels();
  }

  private updatePlayerHUD(): void {
    const hudData: PlayerHUDData = {
      level: this.getPlayerLevel(),
      credits: this.getPlayerCredits(),
      cosmos: this.getPlayerCosmos(),
      experience: this.getPlayerExperience(),
      expForNextLevel: this.getExpForNextLevel(),
      honor: this.getPlayerHonor(),
      skillPoints: this.getPlayerSkillPoints()
    };

    this.playerHUD.updateData(hudData);
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

## 🚀 Aggiungere Nuovi Pannelli (UIManager)

### 1. Crea la classe pannello
```typescript
export class InventoryPanel extends BasePanel {
  protected createPanelContent(): HTMLElement {
    // Layout inventario con griglia oggetti
    const inventoryGrid = this.createInventoryGrid();
    return inventoryGrid;
  }

  update(data: PanelData): void {
    // Aggiorna oggetti inventario
    this.updateInventoryItems(data.items);
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
  size: { width: 500, height: 400 }
};
```

### 3. Registra nel PlayState
```typescript
const inventoryPanel = new InventoryPanel(inventoryConfig);
this.uiManager.registerPanel(inventoryPanel);
```

## 🔄 Estensioni Future

### Pannelli UIManager
- **🎒 Inventario** - Gestione oggetti e equipaggiamento
- **⚙️ Impostazioni** - Configurazione audio/video
- **📜 Missioni** - Quest attive e completate
- **👥 Alleanze** - Relazioni diplomatiche
- **🏆 Classifiche** - Leaderboard e achievement
- **💬 Chat** - Comunicazione multiplayer
- **🗺️ Mappa** - Navigazione dettagliata

### Miglioramenti HUD
- **🔄 Modalità compatta/espansa** - Toggle dimensioni
- **📊 Statistiche aggiuntive** - DPS, accuracy, ecc.
- **🎨 Temi personalizzabili** - Cambiamento colori
- **📱 Responsive scaling** - Adattamento dispositivi

### Advanced UI Components
- **💡 Tooltip intelligenti** - Info contestuali
- **🎬 Animazioni avanzate** - Transizioni fluide
- **✨ Effetti particellari** - Feedback visivo
- **🎛️ Layout adattivi** - Comportamento diverso risoluzioni

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
