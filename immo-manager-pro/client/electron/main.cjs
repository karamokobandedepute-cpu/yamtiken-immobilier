// ==========================================================================
// Electron Main Process - IMMO MANAGER PRO / YAMTIKEN
// ⚠️ RÈGLE DE SÉCURITÉ : AUCUN SECRET NE DOIT ÊTRE ÉCRIT EN CLAIR ICI.
// L'environnement embarqué (SUPABASE, DB URLs, tokens) est lu depuis :
//   1. process.env (priorité)
//   2. fichier .env.local SI présent dans le dossier client/ (seulement DEV)
// ==========================================================================

const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const net = require('net');
const fs = require('fs');
const serve = require('electron-serve');

// Charge dotenv de manière défensive si package présent (dev uniquement)
try {
  const devEnv = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(devEnv)) require('dotenv').config({ path: devEnv });
} catch (_) { /* dotenv n'est pas une dépendance Electron obligatoire */ }

const loadURL = serve({ directory: path.join(__dirname, '../dist') });

// Valeurs NON SENSIBLES par défaut.
// Les valeurs SENSIBLES (mots de passe, tokens) DOIVENT venir de process.env.
function buildEnvFileContent() {
  const SENSITIVES = [
    'DATABASE_URL',
    'DIRECT_URL',
    'SUPABASE_URL',
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_KEY',
    'SUPABASE_ACCESS_TOKEN',
    'JWT_SECRET',
  ];
  const defaults = [
    'PORT=5000',
    'NODE_ENV=production',
    'JWT_EXPIRES_IN=24h',
    'CLIENT_URL=http://localhost:5173',
    'UPLOAD_DIR=./uploads',
  ];
  const lines = [...defaults];
  SENSITIVES.forEach((key) => {
    if (process.env[key]) lines.push(`${key}=${process.env[key]}`);
  });
  return lines.join('\n');
}
const _env = buildEnvFileContent();

// ─── State ───────────────────────────────────────────────────────────────────
let splashWin = null;
let mainWin = null;
let serverProcess = null;
let restartCount = 0;
app.isQuitting = false;

// ─── Chemins ─────────────────────────────────────────────────────────────────
function getServerDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'server')
    : path.join(__dirname, '../../../server');
}

function getNodeExe() {
  const candidates = [
    'C:\\Program Files\\nodejs\\node.exe',
    'C:\\Program Files (x86)\\nodejs\\node.exe',
    process.env.NODE_EXE,
  ].filter(Boolean);
  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch {}
  }
  return 'node';
}

// ─── Auto-deploy .env si absent ──────────────────────────────────────────────
function ensureEnv() {
  const envPath = path.join(getServerDir(), '.env');
  try {
    fs.mkdirSync(path.dirname(envPath), { recursive: true });
    const content = buildEnvFileContent();
    if (!content.includes('DATABASE_URL=')) {
      console.warn('[YAMTIKEN] ⚠ Variables DB/Auth manquantes dans process.env. Définissez-les avant de lancer Electron.');
    }
    fs.writeFileSync(envPath, content, 'utf8');
    console.log('[YAMTIKEN] .env serveur synchronisé ✅');
  } catch (err) {
    console.error('[YAMTIKEN] Impossible de créer .env:', err.message);
  }
}

// ─── Splash screen ───────────────────────────────────────────────────────────
function createSplash() {
  splashWin = new BrowserWindow({
    width: 500,
    height: 320,
    frame: false,
    transparent: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    center: true,
    icon: path.join(__dirname, '../public/icon-512.png'),
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  splashWin.loadFile(path.join(__dirname, 'splash.html'));
  splashWin.center();
}

// ─── Serveur Express avec watchdog infini ────────────────────────────────────
function startServer() {
  if (app.isQuitting) return;
  ensureEnv();
  const serverDir = getServerDir();
  const entry = path.join(serverDir, 'server.js');
  if (!fs.existsSync(entry)) {
    console.warn('[YAMTIKEN] server.js introuvable:', entry);
    return;
  }
  console.log(`[YAMTIKEN] Démarrage serveur API (tentative ${restartCount + 1})…`);
  serverProcess = spawn(getNodeExe(), ['server.js'], {
    cwd: serverDir,
    stdio: 'pipe',
    env: { ...process.env, NODE_ENV: 'production' },
  });
  serverProcess.stdout.on('data', (d) => process.stdout.write('[API] ' + d));
  serverProcess.stderr.on('data', (d) => process.stderr.write('[API ⚠] ' + d));
  serverProcess.on('exit', (code, signal) => {
    if (app.isQuitting || signal === 'SIGTERM') return;
    restartCount++;
    const delay = Math.min(2000 * restartCount, 10000);
    console.log(`[YAMTIKEN] Serveur arrêté (code=${code}). Redémarrage #${restartCount} dans ${delay}ms…`);
    setTimeout(startServer, delay);
  });
}

// ─── Attendre que le port 5000 réponde ───────────────────────────────────────
function waitForPort(port = 5000, timeout = 45000) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeout;
    const probe = () => {
      const s = new net.Socket();
      s.setTimeout(900);
      s.on('connect', () => { s.destroy(); resolve(true); });
      s.on('error', () => s.destroy());
      s.on('timeout', () => s.destroy());
      s.on('close', () => (Date.now() < deadline ? setTimeout(probe, 1200) : resolve(false)));
      s.connect(port, '127.0.0.1');
    };
    probe();
  });
}

// ─── Fenêtre principale ───────────────────────────────────────────────────────
async function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    title: 'YAMTIKEN Immobilier',
    icon: path.join(__dirname, '../public/icon-512.png'),
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });
  mainWin.setMenuBarVisibility(false);

  if (app.isPackaged) {
    await loadURL(mainWin);
  } else {
    await mainWin.loadURL('http://localhost:5173');
    mainWin.webContents.openDevTools({ mode: 'detach' });
  }

  mainWin.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (splashWin && !splashWin.isDestroyed()) {
    splashWin.destroy();
    splashWin = null;
  }
  mainWin.show();
  mainWin.focus();
  console.log('[YAMTIKEN] Application prête ✅');
}

// ─── Boot séquence ────────────────────────────────────────────────────────────
async function boot() {
  createSplash();
  startServer();
  const ready = await waitForPort(5000, 45000);
  if (!ready) console.warn('[YAMTIKEN] Serveur pas encore prêt — ouverture quand même');
  await createMainWindow();
}

app.on('ready', boot);

app.on('before-quit', () => {
  app.isQuitting = true;
  if (serverProcess) serverProcess.kill('SIGTERM');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) boot();
});
