# 🛠️ Utility Tools Layer

**Utility trasversali e helper condivisi per Starfield**

Il layer utils contiene funzioni e classi di supporto riutilizzabili in tutto il progetto.

## 📋 Struttura Utility

### ⚙️ **config/** - Configurazioni Globali
Valori costanti e impostazioni del gioco.

**File:** `Config.ts`

**Configurazioni:**
- Dimensioni canvas e mondo
- Parametri di gioco (FPS, timing)
- Colori e temi visuali
- Debug flags

### 🎨 **rendering/** - Utility Rendering
Helper per operazioni di disegno Canvas.

**File:** `CanvasRenderer.ts`, `MouseInput.ts`

**Utility:**
- `CanvasRenderer`: Wrapper per API Canvas 2D
- `MouseInput`: Gestione input mouse e coordinate

## 🔧 Design Principles

### Pure Functions Priority
```typescript
// Utility come funzioni pure quando possibile
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
```

### Specific Purpose Naming
```typescript
// Nomi che riflettono scopo specifico
export class CanvasRenderer {
  // Specifico per rendering Canvas
}

export class MouseInput {
  // Specifico per input mouse
}
```

### Zero Dependencies from Domain
```typescript
// Utils indipendenti dalla logica di gioco
// Non importano da entities/, systems/, game/
import { CONFIG } from './config/Config'; // OK - altra utility

// ❌ Non importare da game/ o entities/
```

## 🎯 Utilizzo nei Sistemi

### Config Usage
```typescript
import { CONFIG } from '../utils/config/Config';

// Utilizzo valori di configurazione
const worldWidth = CONFIG.WORLD_WIDTH;
const targetFps = CONFIG.TARGET_FPS;
```

### CanvasRenderer Usage
```typescript
import { CanvasRenderer } from '../utils/rendering/CanvasRenderer';

const renderer = new CanvasRenderer(canvasContext);

// Operazioni di disegno semplificate
renderer.setFillColor('#00ff88');
renderer.fillCircle(x, y, radius);
```

### MouseInput Usage
```typescript
import { MouseInput } from '../utils/rendering/MouseInput';

const mouse = new MouseInput(canvas);

// Coordinate mouse relative al canvas
const position = mouse.getPosition();
const leftClick = mouse.isLeftButtonPressed();
```

## 📊 Organization Rules

### Single Responsibility per File
- **Config.ts**: Solo costanti e configurazioni
- **CanvasRenderer.ts**: Solo utility disegno
- **MouseInput.ts**: Solo gestione mouse

### Group Related Utilities
```
utils/
├── config/      # Configurazioni
├── rendering/   # Canvas e input helpers
└── future: math/ # Utility matematiche
```

### Import Hierarchy
```
Systems → Utils (OK - dipendenza downward)
Utils → Config (OK - altra utility)
Utils → Domain (❌ - violazione architettura)
```

## 🚀 Estensioni Future

### Nuove Categorie Utility
- `math/` - Funzioni matematiche avanzate
- `storage/` - Local storage e persistenza
- `network/` - Utility comunicazione (futuro multiplayer)
- `debug/` - Strumenti di sviluppo e logging

### Quality Standards
- **Test Coverage**: 100% per funzioni critiche
- **Performance**: Nessun allocation in hot paths
- **Documentation**: JSDoc completo per API pubblica

Questo layer utils garantisce **codice DRY e riutilizzabile** mantenendo **performance ottimali** e **facilità d'uso** in tutto il progetto.
