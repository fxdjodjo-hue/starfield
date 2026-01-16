# Struttura Completa delle Cartelle - Starfield

Documento completo che elenca tutte le cartelle del progetto con la loro posizione gerarchica e una breve spiegazione del contenuto.

## Root Directory

```
Starfield/                          # Directory principale del progetto
├── .dockerignore                   # File da escludere durante build Docker
├── .env                            # Variabili d'ambiente (non committato)
├── .gitignore                      # File da ignorare da Git
├── .github/                        # Configurazione repository GitHub
│   └── workflows/                  # Workflow CI/CD per deployment automatico
│       └── deploy.yml              # Workflow di deployment
├── architecture.md                 # Documentazione architettura del progetto
├── docker-compose.yml              # Configurazione Docker Compose
├── Dockerfile.client               # Dockerfile per build client
├── docs/                           # Documentazione generale del progetto
│   └── README.md                   # Documentazione principale
├── index.html                      # File HTML principale dell'applicazione
├── package.json                    # Configurazione npm e dipendenze
├── package-lock.json               # Lock file delle dipendenze npm
├── README.md                        # Documentazione principale del progetto
├── public/                         # File statici pubblici accessibili dal client
│   └── assets/                     # Risorse grafiche, audio e altri asset del gioco
│       ├── aim/                    # Asset per il mirino di puntamento
│       ├── audio/                  # File audio del gioco (musica, effetti sonori, voci)
│       │   ├── ambient/            # Suoni ambientali di sfondo
│       │   ├── effects/            # Effetti sonori di gioco
│       │   │   ├── engine/         # Suoni dei motori delle navi
│       │   │   ├── explosions/     # Suoni delle esplosioni
│       │   │   └── laser/          # Suoni dei laser e proiettili
│       │   ├── music/              # Musica di sottofondo
│       │   ├── ui/                 # Suoni dell'interfaccia utente
│       │   └── voice/              # Voci e annunci vocali
│       │       └── warning/        # Avvisi vocali di pericolo
│       ├── explosions/             # Sprite e texture per esplosioni
│       │   └── explosions_npc/     # Esplosioni specifiche per NPC
│       ├── laser/                  # Sprite per laser e proiettili
│       │   └── laser1/             # Set di sprite laser tipo 1
│       ├── maps/                   # Immagini delle mappe di gioco
│       │   └── palantir/           # Mappa specifica "Palantir"
│       ├── npc_ships/              # Sprite e texture delle navi NPC
│       │   ├── kronos/             # Nave NPC tipo Kronos/Frigate
│       │   └── scouter/            # Nave NPC tipo Scouter
│       ├── rocket/                 # Sprite per razzi
│       ├── ships/                  # Sprite delle navi giocabili
│       │   └── ship106/             # Nave giocabile modello 106
│       ├── spacestation/           # Sprite per stazioni spaziali
│       └── teleport/               # Sprite per effetti di teletrasporto
│   └── vite.svg                    # Logo Vite (file di default)
├── render.yaml                     # Configurazione deployment Render.com
├── server.cjs                      # Entry point principale del server
├── server/                         # Codice lato server (Node.js)
│   ├── config/                     # File di configurazione del server
│   │   └── README.md               # Documentazione configurazione server
│   ├── core/                       # Moduli core del server (WebSocket, validazione, mappa)
│   │   └── README.md               # Documentazione moduli core
│   ├── logger.cjs                  # Sistema di logging del server
│   ├── logger-README.md            # Documentazione sistema di logging
│   ├── managers/                   # Manager per gestire logica di gioco server-side
│   │   └── README.md               # Documentazione manager
│   └── README.md                   # Documentazione server
├── shared/                         # Codice condiviso tra client e server
├── src/                            # Codice sorgente principale del client (TypeScript)
│   ├── __tests__/                  # Test unitari e di integrazione
│   │   ├── config/                 # Test per file di configurazione
│   │   ├── entities/               # Test per entità e componenti ECS
│   │   │   ├── ai/                 # Test per componenti AI
│   │   │   ├── combat/             # Test per componenti di combattimento
│   │   │   ├── currency/           # Test per componenti di valuta/risorse
│   │   │   ├── player/             # Test per componenti del giocatore
│   │   │   ├── quest/              # Test per componenti delle quest
│   │   │   ├── spatial/            # Test per componenti spaziali
│   │   │   └── Sprite.test.ts      # Test per componente Sprite
│   │   ├── game/                   # Test per logica di gioco
│   │   │   └── states/             # Test per stati del gioco
│   │   ├── infrastructure/        # Test per infrastruttura (ECS, engine)
│   │   │   ├── AssetManager.test.ts # Test per AssetManager
│   │   │   ├── ecs/                # Test per sistema ECS
│   │   │   └── engine/             # Test per game engine
│   │   ├── presentation/           # Test per componenti UI
│   │   │   └── ui/                 # Test per interfacce utente (PanelConfig, PlayerHUD, PlayerStatsPanel, QuestPanel, StartScreen)
│   │   ├── systems/                # Test per sistemi di gioco
│   │   │   ├── ai/                 # Test per sistemi AI
│   │   │   ├── AudioSystem.test.ts # Test per sistema audio
│   │   │   ├── BoundsSystem.test.ts # Test per sistema bounds
│   │   │   ├── combat/             # Test per sistemi di combattimento
│   │   │   ├── EconomySystem.test.ts # Test per sistema economico
│   │   │   ├── GameInitializationSystem.test.ts # Test per inizializzazione gioco
│   │   │   ├── input/              # Test per sistemi di input
│   │   │   ├── NpcSystem.test.ts   # Test per sistema NPC
│   │   │   ├── physics/            # Test per sistemi fisici
│   │   │   ├── PlayerSystem.test.ts # Test per sistema giocatore
│   │   │   ├── QuestManager.test.ts # Test per quest manager
│   │   │   ├── QuestSystem.test.ts  # Test per sistema quest
│   │   │   ├── QuestTrackingSystem.test.ts # Test per tracking quest
│   │   │   ├── RankSystem.test.ts   # Test per sistema ranking
│   │   │   ├── rendering/          # Test per sistemi di rendering
│   │   │   └── RewardSystem.test.ts # Test per sistema ricompense
│   │   └── utils/                  # Test per utility e helper
│   │       └── config/             # Test per configurazioni
│   ├── config/                     # File di configurazione del gioco (AudioConfig, GameConstants, NetworkConfig, NpcConfig, PlayerConfig, QuestConfig, QuestExamples, QUEST_SYSTEM_README.md)
│   ├── entities/                   # Componenti ECS (entità del gioco)
│   │   ├── ai/                     # Componenti per intelligenza artificiale
│   │   ├── AnimatedSprite.ts       # Componente per sprite animate
│   │   ├── combat/                 # Componenti per sistema di combattimento (ChatText, Damage, DamageTaken, DamageText, Explosion, Health, Projectile, ResourceComponent, SelectedNpc, Shield)
│   │   ├── currency/                # Componenti per valuta e risorse (Currency, Experience, Honor, SkillPoints)
│   │   ├── player/                 # Componenti specifici del giocatore (PlayerStats, PlayerUpgrades, RemotePlayer)
│   │   ├── quest/                  # Componenti per sistema di quest (ActiveQuest, Quest)
│   │   ├── spatial/                # Componenti spaziali (Authority, Camera, InterpolationTarget, ParallaxLayer, Transform, Velocity)
│   │   ├── Sprite.ts               # Componente base per sprite
│   │   └── README.md               # Documentazione entità
│   ├── factories/                  # Factory per creare entità e oggetti di gioco
│   ├── game/                       # Logica principale del gioco
│   │   ├── core/                   # Entry point e inizializzazione del gioco
│   │   ├── states/                 # Stati del gioco (Start, Play, etc.)
│   │   └── README.md               # Documentazione logica di gioco
│   ├── infrastructure/             # Infrastruttura di base (ECS, engine, display)
│   │   ├── display/                # Gestione display e configurazione schermo
│   │   ├── ecs/                    # Implementazione Entity-Component-System
│   │   └── engine/                 # Game engine core (game loop, world, context)
│   ├── lib/                        # Librerie esterne e integrazioni
│   ├── managers/                   # Manager per gestire logica specifica
│   ├── multiplayer/                # Codice per funzionalità multiplayer
│   │   └── client/                 # Client-side multiplayer
│   │       ├── handlers/           # Handler per messaggi di rete
│   │       ├── managers/           # Manager per connessioni e sincronizzazione
│   │       └── types/              # Tipi TypeScript per networking
│   ├── presentation/               # Layer di presentazione e UI
│   │   └── ui/                     # Componenti dell'interfaccia utente
│   │       └── README.md           # Documentazione UI
│   ├── systems/                    # Sistemi ECS che processano le entità
│   │   ├── ai/                     # Sistemi per comportamento AI degli NPC
│   │   ├── audio/                  # Sistema di gestione audio
│   │   │   └── README.md           # Documentazione sistema audio
│   │   ├── client/                 # Sistemi specifici del client
│   │   ├── combat/                 # Sistemi per combattimento e danni
│   │   ├── economy/                # Sistema economico del gioco
│   │   ├── game/                   # Sistemi di inizializzazione e gestione gioco
│   │   ├── input/                  # Sistemi per gestione input utente
│   │   ├── multiplayer/            # Sistemi per sincronizzazione multiplayer
│   │   ├── npc/                    # Sistemi per gestione NPC
│   │   ├── physics/                # Sistemi per fisica e movimento
│   │   ├── player/                 # Sistemi per gestione giocatore
│   │   ├── quest/                  # Sistemi per gestione quest
│   │   ├── rendering/              # Sistemi per rendering grafico
│   │   ├── rewards/                # Sistemi per ricompense e progressione
│   │   ├── ui/                     # Sistemi per gestione UI
│   │   └── README.md               # Documentazione sistemi
│   └── utils/                      # Utility e helper functions
│       ├── AtlasParser.ts          # Parser per file atlas sprite
│       ├── config/                 # Utility per gestione configurazioni (Config, ConfigValidator, Version)
│       ├── helpers/                # Helper functions per rendering e calcoli (ExplosionRenderer, HudRenderer, NpcRenderer, PlayerRenderer, ProjectileRenderer, ScreenSpace, SpriteRenderer, SpritesheetRenderer)
│       ├── Logger.ts               # Sistema di logging
│       ├── MathUtils.ts            # Utility matematiche
│       └── README.md               # Documentazione utility
├── supabase/                       # Configurazione e migrazioni database Supabase
│   ├── config.toml                 # Configurazione Supabase locale
│   ├── functions/                  # Edge functions Supabase
│   │   └── game-session-end/       # Function per gestire fine sessione di gioco
│   │       └── index.ts            # Codice della function
│   ├── migrations/                 # Migrazioni database SQL
│   │   └── 20240104120000_initial_schema.sql # Schema iniziale database
│   └── README.md                   # Documentazione Supabase
├── start-both.bat                  # Script per avviare client e server insieme
├── start-client.bat                # Script per avviare solo il client
├── start-server.bat                # Script per avviare solo il server
├── tsconfig.json                   # Configurazione TypeScript
├── vercel.json                     # Configurazione deployment Vercel
├── vite.config.ts                   # Configurazione Vite
└── vitest.config.ts                # Configurazione Vitest per testing
```

## Dettagli per Categoria

### Root Directory
- **Starfield/** - Directory principale del progetto, contiene tutti i file di configurazione e le cartelle principali

### Configurazione e Build
- **.dockerignore** - File da escludere durante build Docker
- **.env** - Variabili d'ambiente (non committato)
- **.gitignore** - File da ignorare da Git
- **.github/** - Configurazione repository GitHub e workflow CI/CD
- **.github/workflows/** - Workflow GitHub Actions per deployment automatico
- **architecture.md** - Documentazione architettura del progetto
- **docker-compose.yml** - Configurazione Docker Compose
- **Dockerfile.client** - Dockerfile per build client
- **index.html** - File HTML principale dell'applicazione
- **package.json** - Configurazione npm e dipendenze
- **package-lock.json** - Lock file delle dipendenze npm
- **render.yaml** - Configurazione deployment Render.com
- **tsconfig.json** - Configurazione TypeScript
- **vercel.json** - Configurazione deployment Vercel
- **vite.config.ts** - Configurazione Vite
- **vitest.config.ts** - Configurazione Vitest per testing
- **start-both.bat** - Script per avviare client e server insieme
- **start-client.bat** - Script per avviare solo il client
- **start-server.bat** - Script per avviare solo il server

### Documentazione
- **README.md** - Documentazione principale del progetto
- **docs/** - Documentazione generale del progetto e guide per sviluppatori
- **docs/README.md** - Documentazione principale

### Asset e Risorse
- **public/** - File statici pubblici serviti direttamente al client
- **public/assets/** - Tutte le risorse grafiche, audio e texture del gioco
- **public/assets/aim/** - Sprite per il mirino di puntamento
- **public/assets/audio/** - Tutti i file audio del gioco organizzati per categoria
- **public/assets/audio/ambient/** - Suoni ambientali di sfondo per atmosfera
- **public/assets/audio/effects/** - Effetti sonori durante il gameplay
- **public/assets/audio/effects/engine/** - Suoni dei motori delle navi spaziali
- **public/assets/audio/effects/explosions/** - Suoni delle esplosioni
- **public/assets/audio/effects/laser/** - Suoni dei laser e proiettili
- **public/assets/audio/music/** - Musica di sottofondo del gioco
- **public/assets/audio/ui/** - Suoni dell'interfaccia utente (click, notifiche)
- **public/assets/audio/voice/** - Voci e annunci vocali
- **public/assets/audio/voice/warning/** - Avvisi vocali di pericolo
- **public/assets/explosions/** - Sprite e texture per effetti di esplosione
- **public/assets/explosions/explosions_npc/** - Esplosioni specifiche per navi NPC
- **public/assets/laser/** - Sprite per laser e proiettili
- **public/assets/laser/laser1/** - Set di sprite laser tipo 1
- **public/assets/maps/** - Immagini di sfondo per le mappe di gioco
- **public/assets/maps/palantir/** - Mappa specifica chiamata "Palantir"
- **public/assets/npc_ships/** - Sprite e texture per tutte le navi NPC
- **public/assets/npc_ships/kronos/** - Nave NPC tipo Kronos (Frigate)
- **public/assets/npc_ships/scouter/** - Nave NPC tipo Scouter
- **public/assets/rocket/** - Sprite per razzi e missili
- **public/assets/ships/** - Sprite delle navi giocabili
- **public/assets/ships/ship106/** - Nave giocabile modello 106
- **public/assets/spacestation/** - Sprite per stazioni spaziali
- **public/assets/teleport/** - Sprite per effetti di teletrasporto

### Server
- **server.cjs** - Entry point principale del server
- **server/** - Codice lato server Node.js per multiplayer
- **server/config/** - File di configurazione e costanti del server
- **server/config/README.md** - Documentazione configurazione server
- **server/core/** - Moduli core del server (WebSocket, validazione input, gestione mappa)
- **server/core/README.md** - Documentazione moduli core
- **server/logger.cjs** - Sistema di logging del server
- **server/logger-README.md** - Documentazione sistema di logging
- **server/managers/** - Manager per gestire logica di gioco server-side (NPC, combattimento, proiettili)
- **server/managers/README.md** - Documentazione manager
- **server/README.md** - Documentazione server

### Codice Condiviso
- **shared/** - Codice condiviso tra client e server (configurazioni, validazioni)

### Client Source Code
- **src/** - Codice sorgente principale del client in TypeScript
- **src/__tests__/** - Test unitari e di integrazione organizzati per categoria
- **src/__tests__/config/** - Test per file di configurazione
- **src/__tests__/entities/** - Test per tutte le entità e componenti ECS
- **src/__tests__/entities/ai/** - Test per componenti di intelligenza artificiale
- **src/__tests__/entities/combat/** - Test per componenti di combattimento
- **src/__tests__/entities/currency/** - Test per componenti di valuta e risorse
- **src/__tests__/entities/player/** - Test per componenti del giocatore
- **src/__tests__/entities/quest/** - Test per componenti delle quest
- **src/__tests__/entities/spatial/** - Test per componenti spaziali
- **src/__tests__/entities/Sprite.test.ts** - Test per componente Sprite
- **src/__tests__/game/** - Test per logica di gioco
- **src/__tests__/game/states/** - Test per stati del gioco
- **src/__tests__/infrastructure/** - Test per infrastruttura di base
- **src/__tests__/infrastructure/AssetManager.test.ts** - Test per AssetManager
- **src/__tests__/infrastructure/ecs/** - Test per sistema Entity-Component-System
- **src/__tests__/infrastructure/engine/** - Test per game engine
- **src/__tests__/presentation/** - Test per componenti UI
- **src/__tests__/presentation/ui/** - Test per interfacce utente (PanelConfig, PlayerHUD, PlayerStatsPanel, QuestPanel, StartScreen)
- **src/__tests__/systems/** - Test per tutti i sistemi di gioco
- **src/__tests__/systems/ai/** - Test per sistemi AI
- **src/__tests__/systems/AudioSystem.test.ts** - Test per sistema audio
- **src/__tests__/systems/BoundsSystem.test.ts** - Test per sistema bounds
- **src/__tests__/systems/combat/** - Test per sistemi di combattimento
- **src/__tests__/systems/EconomySystem.test.ts** - Test per sistema economico
- **src/__tests__/systems/GameInitializationSystem.test.ts** - Test per inizializzazione gioco
- **src/__tests__/systems/input/** - Test per sistemi di input
- **src/__tests__/systems/NpcSystem.test.ts** - Test per sistema NPC
- **src/__tests__/systems/physics/** - Test per sistemi fisici
- **src/__tests__/systems/PlayerSystem.test.ts** - Test per sistema giocatore
- **src/__tests__/systems/QuestManager.test.ts** - Test per quest manager
- **src/__tests__/systems/QuestSystem.test.ts** - Test per sistema quest
- **src/__tests__/systems/QuestTrackingSystem.test.ts** - Test per tracking quest
- **src/__tests__/systems/RankSystem.test.ts** - Test per sistema ranking
- **src/__tests__/systems/rendering/** - Test per sistemi di rendering
- **src/__tests__/systems/RewardSystem.test.ts** - Test per sistema ricompense
- **src/__tests__/utils/** - Test per utility e helper
- **src/__tests__/utils/config/** - Test per configurazioni
- **src/config/** - File di configurazione del gioco (AudioConfig, GameConstants, NetworkConfig, NpcConfig, PlayerConfig, QuestConfig, QuestExamples, QUEST_SYSTEM_README.md)
- **src/entities/** - Componenti ECS che rappresentano entità del gioco
- **src/entities/ai/** - Componenti per intelligenza artificiale (destinazione, comportamento NPC)
- **src/entities/AnimatedSprite.ts** - Componente per sprite animate
- **src/entities/combat/** - Componenti per sistema di combattimento (ChatText, Damage, DamageTaken, DamageText, Explosion, Health, Projectile, ResourceComponent, SelectedNpc, Shield)
- **src/entities/currency/** - Componenti per valuta e risorse (Currency, Experience, Honor, SkillPoints)
- **src/entities/player/** - Componenti specifici del giocatore (statistiche, upgrade, giocatori remoti)
- **src/entities/quest/** - Componenti per sistema di quest (quest attive, definizioni)
- **src/entities/spatial/** - Componenti spaziali (Authority, Camera, InterpolationTarget, ParallaxLayer, Transform, Velocity)
- **src/entities/Sprite.ts** - Componente base per sprite
- **src/entities/README.md** - Documentazione entità
- **src/factories/** - Factory pattern per creare entità e oggetti di gioco
- **src/game/** - Logica principale del gioco e orchestrazione
- **src/game/core/** - Entry point e inizializzazione del gioco
- **src/game/states/** - Stati del gioco (Start, Play, base GameState)
- **src/game/README.md** - Documentazione logica di gioco
- **src/infrastructure/** - Infrastruttura di base del game engine
- **src/infrastructure/display/** - Gestione display e configurazione schermo
- **src/infrastructure/ecs/** - Implementazione Entity-Component-System (Component, Entity, System, ECS)
- **src/infrastructure/engine/** - Game engine core (game loop, world, context, game orchestrator)
- **src/infrastructure/README.md** - Documentazione infrastruttura
- **src/lib/** - Librerie esterne e integrazioni (es. Supabase client)
- **src/managers/** - Manager per gestire logica specifica (es. statistiche NPC)
- **src/multiplayer/** - Codice per funzionalità multiplayer
- **src/multiplayer/client/** - Client-side multiplayer e networking
- **src/multiplayer/client/handlers/** - Handler per processare messaggi di rete dal server
- **src/multiplayer/client/managers/** - Manager per connessioni, sincronizzazione e gestione entità remote
- **src/multiplayer/client/types/** - Tipi TypeScript per networking e messaggi
- **src/presentation/** - Layer di presentazione e UI
- **src/presentation/ui/** - Componenti dell'interfaccia utente (HUD, chat, leaderboard, quest panel, upgrade panel)
- **src/presentation/ui/README.md** - Documentazione UI
- **src/systems/** - Sistemi ECS che processano le entità ogni frame
- **src/systems/ai/** - Sistemi per comportamento AI degli NPC (movimento, selezione, comportamento)
- **src/systems/audio/** - Sistema di gestione audio e riproduzione suoni
- **src/systems/client/** - Sistemi specifici del client (notifiche, esplosioni remote)
- **src/systems/combat/** - Sistemi per combattimento, danni, proiettili ed esplosioni
- **src/systems/economy/** - Sistema economico del gioco
- **src/systems/game/** - Sistemi di inizializzazione e gestione gioco
- **src/systems/input/** - Sistemi per gestione input utente (mouse, tastiera)
- **src/systems/multiplayer/** - Sistemi per sincronizzazione multiplayer (NPC remoti, giocatori remoti, proiettili remoti)
- **src/systems/npc/** - Sistemi per gestione NPC
- **src/systems/physics/** - Sistemi per fisica, movimento, collisioni e interpolazione
- **src/systems/player/** - Sistemi per gestione giocatore e display stato
- **src/systems/quest/** - Sistemi per gestione quest (tracking, completamento, manager)
- **src/systems/rendering/** - Sistemi per rendering grafico (camera, parallasse, minimap, testi danno, log)
- **src/systems/rewards/** - Sistemi per ricompense, progressione e ranking
- **src/systems/ui/** - Sistemi per gestione UI e chat
- **src/systems/README.md** - Documentazione sistemi
- **src/utils/** - Utility e helper functions riutilizzabili
- **src/utils/AtlasParser.ts** - Parser per file atlas sprite
- **src/utils/config/** - Utility per gestione e validazione configurazioni (Config, ConfigValidator, Version)
- **src/utils/helpers/** - Helper functions per rendering, calcoli matematici e utilità varie (ExplosionRenderer, HudRenderer, NpcRenderer, PlayerRenderer, ProjectileRenderer, ScreenSpace, SpriteRenderer, SpritesheetRenderer)
- **src/utils/Logger.ts** - Sistema di logging
- **src/utils/MathUtils.ts** - Utility matematiche
- **src/utils/README.md** - Documentazione utility

### Database
- **supabase/** - Configurazione e migrazioni database Supabase
- **supabase/config.toml** - Configurazione Supabase locale
- **supabase/functions/** - Edge functions Supabase per logica serverless
- **supabase/functions/game-session-end/** - Function per gestire fine sessione di gioco
- **supabase/functions/game-session-end/index.ts** - Codice della function
- **supabase/migrations/** - Migrazioni database SQL per schema e tabelle
- **supabase/migrations/20240104120000_initial_schema.sql** - Schema iniziale database
- **supabase/README.md** - Documentazione Supabase

### Tools e Script
- **tools/** - Script e tool per sviluppo, setup e deployment
