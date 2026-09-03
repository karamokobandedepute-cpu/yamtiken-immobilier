const fs = require('fs');
const path = require('path');

const apiFile = path.resolve(__dirname, '../client/src/utils/api.js');
const apiContent = fs.readFileSync(apiFile, 'utf8');

// Extraire les endpoints dans api.js
const regex = /api\.(get|post|put|delete|patch)\s*\(\s*[`'"]([^`'"?]+)/g;
const clientCalls = [];
let match;
while ((match = regex.exec(apiContent)) !== null) {
  clientCalls.push({ method: match[1].toUpperCase(), path: match[2] });
}

// Trouver aussi les appels api dans tous les fichiers client/src
const clientDir = path.resolve(__dirname, '../client/src');
function scanDir(dir) {
  fs.readdirSync(dir).forEach(file => {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) scanDir(full);
    else if (/\.(js|jsx)$/.test(file)) {
      const code = fs.readFileSync(full, 'utf8');
      const r = /api\.(get|post|put|delete|patch)\s*\(\s*[`'"]([^`'"?]+)/g;
      let m;
      while ((m = r.exec(code)) !== null) {
        clientCalls.push({ method: m[1].toUpperCase(), path: m[2], file: path.relative(clientDir, full) });
      }
    }
  });
}
scanDir(clientDir);

// Dédupliquer
const uniqueCalls = {};
clientCalls.forEach(c => {
  const key = `${c.method} ${c.path}`;
  if (!uniqueCalls[key]) uniqueCalls[key] = [];
  uniqueCalls[key].push(c.file || 'utils/api.js');
});

console.log(`Total unique API endpoints called from frontend: ${Object.keys(uniqueCalls).length}`);

// Lire les routes serveur
const routesDir = path.resolve(__dirname, '../server/routes');
const serverRoutes = [];
fs.readdirSync(routesDir).forEach(file => {
  if (file.endsWith('.js')) {
    const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
    const r = /router\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = r.exec(content)) !== null) {
      serverRoutes.push({ routeFile: file, method: m[1].toUpperCase(), route: m[2] });
    }
  }
});

console.log('\n--- Frontend API Calls ---');
Object.keys(uniqueCalls).sort().forEach(k => {
  console.log(`  ${k}`);
});

console.log('\n--- Server Routes Defined in routes/*.js ---');
serverRoutes.forEach(r => {
  console.log(`  [${r.routeFile}] ${r.method} ${r.route}`);
});
