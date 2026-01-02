# 🖥️ User Interface Layer

**Interfacce utente e presentazione per Starfield**

Il layer UI gestisce tutto ciò che è visibile all'utente al di fuori del mondo di gioco principale.

## 📋 Componenti UI

### StartScreen
Schermata iniziale del gioco con elementi interattivi.

**File:** `StartScreen.ts`

**Elementi:**
- Titolo del gioco
- Campo input nickname
- Pulsante "Play" per avvio
- Effetti visuali di background

**Responsabilità:** Prima interazione utente e raccolta informazioni iniziali.

## 🎨 Design Principles

### Consistent Styling
```typescript
// Stili coerenti per tutti gli elementi UI
const UI_THEME = {
  colors: {
    primary: '#00ff88',
    secondary: '#0088ff',
    background: '#000011'
  },
  fonts: {
    primary: 'Arial, sans-serif',
    size: {
      title: '24px',
      button: '16px',
      input: '14px'
    }
  }
};
```

### Responsive Design
- Adattabile a diverse dimensioni canvas
- Proporzionale al viewport del browser
- Leggibile su schermi diversi

## 🔗 Integrazione con Game States

### StartState Integration
```typescript
class StartState extends GameState {
  private startScreen: StartScreen;

  async enter(context: GameContext) {
    this.startScreen = new StartScreen();

    // Setup callback per transizione
    this.startScreen.setOnPlayCallback((nickname) => {
      context.playerNickname = nickname;
      // Transizione a PlayState
    });
  }

  render(ctx: CanvasRenderingContext2D) {
    // Render UI sopra canvas
    this.startScreen.render(ctx);
  }
}
```

## 🎯 UI Architecture

### Component-Based UI
```typescript
abstract class UIComponent {
  x: number;
  y: number;
  width: number;
  height: number;

  abstract render(ctx: CanvasRenderingContext2D): void;
  abstract handleInput(event: MouseEvent): boolean;
}
```

### Event-Driven Updates
```typescript
class StartScreen extends UIComponent {
  private nicknameInput: TextInput;
  private playButton: Button;
  private onPlayCallback?: (nickname: string) => void;

  setOnPlayCallback(callback: (nickname: string) => void) {
    this.onPlayCallback = callback;
  }

  handleInput(event: MouseEvent) {
    if (this.playButton.handleClick(event)) {
      this.onPlayCallback?.(this.nicknameInput.getValue());
    }
  }
}
```

## 🚀 Estensioni Future

### HUD System
- Barre salute giocatore
- Mini-mappa
- Inventario
- Menu impostazioni

### Advanced UI Components
- Tooltip informativi
- Animazioni di transizione
- Effetti particellari
- Layout responsive

Questa UI fornisce **interfaccia pulita e intuitiva** per l'esperienza utente di Starfield.
