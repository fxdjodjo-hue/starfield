const { app, BrowserWindow, screen } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;

let splashWindow = null;
let mainWindow = null;

function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 600,
        height: 600,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        icon: path.join(__dirname, '../build/icon.ico'), // Usa icona corretta
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    splashWindow.loadFile(path.join(__dirname, 'splash.html'));
    splashWindow.center();
}

function createWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width: Math.min(1920, width),
        height: Math.min(1080, height),
        minWidth: 1280,
        minHeight: 720,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs'),
        },
        backgroundColor: '#000011',
        autoHideMenuBar: true,
        title: 'StarSpace',
        icon: path.join(__dirname, '../build/icon.ico'), // Usa icona corretta
        fullscreen: true,
        show: false // Non mostrare finché non è pronta
    });

    // Gestione transizione Splash -> Main
    mainWindow.once('ready-to-show', () => {
        // Delay artificiale minimo per mostrare il logo (opzionale, ma bello)
        setTimeout(() => {
            if (splashWindow && !splashWindow.isDestroyed()) {
                splashWindow.close();
            }
            mainWindow.show();

            // Apri DevTools per debug
            if (isDev) {
                // mainWindow.webContents.openDevTools(); // Commentato in attesa di richiesta
            }
        }, 2000); // 2 secondi di splash screen
    });

    if (isDev) {
        // Development: carica da Vite dev server
        mainWindow.loadURL('http://localhost:5173');
    } else {
        // Production: carica i file buildati
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Mantieni titolo custom
    mainWindow.on('page-title-updated', (e) => e.preventDefault());

    // Gestisci link esterni (apri nel browser di default)
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        require('electron').shell.openExternal(url);
        return { action: 'deny' };
    });
}

app.whenReady().then(() => {
    createSplashWindow();

    // Defer main window creation slightly to ensure splash screen renders immediately
    // without contention for resources during the critical startup phase.
    setTimeout(createWindow, 300);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Gestione crash/hang
app.on('render-process-gone', (event, webContents, details) => {
    console.error('Render process gone:', details);
});

app.on('child-process-gone', (event, details) => {
    console.error('Child process gone:', details);
});
