const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const http = require('http');

const SERVER_DIR = path.join(__dirname, '../server');
const CLIENT_DIR = path.join(__dirname, '../client');

console.log("============================================================");
console.log("  DEMARRAGE SYNCHRONISE: YAMTIKEN BEHEMOTH 2026");
console.log("============================================================\n");

function waitForPort(port, timeout = 30000) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeout;
    const probe = () => {
      const s = new net.Socket();
      s.setTimeout(1000);
      s.on('connect', () => { s.destroy(); resolve(true); });
      s.on('error', () => s.destroy());
      s.on('timeout', () => s.destroy());
      s.on('close', () => {
        if (Date.now() < deadline) {
          setTimeout(probe, 500);
        } else {
          resolve(false);
        }
      });
      s.connect(port, '127.0.0.1');
    };
    probe();
  });
}

async function start() {
  console.log("1. Démarrage du Backend (Serveur API) sur le port 5000...");
  
  const backend = spawn(/^win/.test(process.platform) ? 'npm.cmd' : 'npm', ['start'], {
    cwd: SERVER_DIR,
    stdio: 'ignore', // Ne pas polluer la console, le serveur logge dans error.log
    detached: true
  });
  backend.unref(); // Laisser tourner en arrière-plan

  const isBackendReady = await waitForPort(5000, 30000);
  
  if (!isBackendReady) {
    console.error("❌ ERREUR: Le backend n'a pas pu démarrer sur le port 5000.");
    process.exit(1);
  }
  
  console.log("✅ Backend prêt et connecté (Port 5000) !");
  
  console.log("\n2. Démarrage du Frontend (Client)...");
  const frontend = spawn(/^win/.test(process.platform) ? 'npm.cmd' : 'npm', ['run', 'dev'], {
    cwd: CLIENT_DIR,
    stdio: 'ignore',
    detached: true
  });
  frontend.unref();

  console.log("⏳ Attente de la disponibilité de l'interface...");
  const isFrontendReady = await waitForPort(5173, 30000);
  
  if (!isFrontendReady) {
    console.error("❌ ERREUR: Le frontend n'a pas pu démarrer sur le port 5173.");
    process.exit(1);
  }

  console.log("✅ Frontend prêt et synchronisé (Port 5173) !");
  
  console.log("\n============================================================");
  console.log("  APPLICATION LANCEE ET LIEE AVEC SUCCES !");
  console.log("============================================================");
  
  console.log("🚀 Ouverture de l'application dans votre navigateur...");
  
  const startCmd = process.platform === 'darwin' ? 'open' : (process.platform === 'win32' ? 'start' : 'xdg-open');
  require('child_process').exec(`${startCmd} http://localhost:5173`);
  
  setTimeout(() => {
    process.exit(0);
  }, 2000);
}

start().catch(err => {
  console.error("Erreur fatale:", err);
  process.exit(1);
});
