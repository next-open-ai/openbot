const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let gatewayProcess;
const GATEWAY_PORT = 38080;

// Start OpenBot Gateway
function startGateway() {
    const gatewayPath = path.join(__dirname, '..', 'dist', 'gateway', 'server.js');

    if (process.env.NODE_ENV !== 'production') {
        // In development, gateway might be running separately, but we can also spawn it if needed.
        // For now, let's assume dev runs it separately or we rely on the one spawned by CLI if we run `openbot gateway`
        console.log('Development mode: Gateway should be started separately or via CLI');
        return;
    }

    console.log('Starting Gateway process...');
    gatewayProcess = spawn('node', [gatewayPath], {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
        env: { ...process.env, PORT: GATEWAY_PORT.toString() }
    });
}

// Wait for Gateway to be ready
function waitForGateway() {
    return new Promise((resolve) => {
        const check = () => {
            const req = http.get(`http://localhost:${GATEWAY_PORT}/health`, (res) => {
                if (res.statusCode === 200) {
                    resolve();
                } else {
                    setTimeout(check, 500);
                }
            });

            req.on('error', () => {
                setTimeout(check, 500);
            });

            req.end();
        };
        check();
    });
}

async function createWindow() {
    // Wait for Gateway before showing window
    if (process.env.NODE_ENV === 'production') {
        process.stdout.write('Waiting for Gateway...');
        await waitForGateway();
        console.log('Gateway is ready!');
    }

    mainWindow = new BrowserWindow({
        width: 1600,
        height: 1000,
        minWidth: 1200,
        minHeight: 700,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        backgroundColor: '#0f0f1e',
        show: false,
        titleBarStyle: 'hiddenInset',
        frame: true,
    });

    // Load the Frontend
    // In development: Vite dev server (5173)
    // In production: Gateway static file serving (38080)
    const isDev = process.env.NODE_ENV !== 'production';
    const startUrl = isDev
        ? 'http://localhost:5173'
        : `http://localhost:${GATEWAY_PORT}`;

    console.log(`Loading URL: ${startUrl}`);
    mainWindow.loadURL(startUrl);

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Open DevTools in development
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// IPC handlers (register in whenReady so they are bound to the same main process that creates the window)
function registerIpcHandlers() {
    ipcMain.handle('get-app-version', () => app.getVersion());
    ipcMain.handle('minimize-window', () => {
        if (mainWindow) mainWindow.minimize();
    });
    ipcMain.handle('maximize-window', () => {
        if (mainWindow) {
            if (mainWindow.isMaximized()) mainWindow.unmaximize();
            else mainWindow.maximize();
        }
    });
    ipcMain.handle('close-window', () => {
        if (mainWindow) mainWindow.close();
    });
    ipcMain.handle('get-user-data-path', () => app.getPath('userData'));
    ipcMain.handle('show-open-directory-dialog', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow || null, {
            title: '选择技能目录',
            properties: ['openDirectory'],
        });
        if (canceled || !filePaths || filePaths.length === 0) return null;
        return filePaths[0];
    });
}

// App lifecycle
app.whenReady().then(() => {
    registerIpcHandlers();
    startGateway();
    createWindow();

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

app.on('before-quit', () => {
    if (gatewayProcess) {
        console.log('Killing Gateway process...');
        gatewayProcess.kill();
    }
});
