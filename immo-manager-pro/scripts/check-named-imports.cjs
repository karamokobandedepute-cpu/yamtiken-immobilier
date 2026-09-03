const fs = require('fs');
const path = require('path');
const esbuild = require('../client/node_modules/esbuild');

const srcDir = path.resolve(__dirname, '../client/src');

function getFiles(dir) {
  let res = [];
  fs.readdirSync(dir).forEach(file => {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) res = res.concat(getFiles(full));
    else if (/\.(jsx?)$/.test(file)) res.push(full);
  });
  return res;
}

const files = getFiles(srcDir);

// 1. Pour chaque fichier, trouver les exports
const fileExports = {};
files.forEach(file => {
  const code = fs.readFileSync(file, 'utf8');
  const exp = new Set();
  
  // export const/function/class/let name
  const rDecl = /export\s+(?:const|let|var|function|class)\s+([A-Za-z0-9_$]+)/g;
  let m;
  while ((m = rDecl.exec(code)) !== null) exp.add(m[1]);
  
  // export { a, b, c as d }
  const rList = /export\s*\{([^}]+)\}/g;
  while ((m = rList.exec(code)) !== null) {
    m[1].split(',').forEach(item => {
      const parts = item.trim().split(/\s+as\s+/);
      const exportedName = parts[parts.length - 1].trim();
      if (exportedName && !exportedName.includes('/*')) exp.add(exportedName);
    });
  }
  
  // export default
  if (/export\s+default\s+/.test(code)) exp.add('default');
  
  fileExports[file] = exp;
});

// 2. Vérifier les imports de chaque fichier
const brokenImports = [];
files.forEach(file => {
  const code = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(file);
  
  // import { a, b } from './relPath'
  const rImp = /import\s*\{([^}]+)\}\s*from\s*['"](\.[^'"]+)['"]/g;
  let m;
  while ((m = rImp.exec(code)) !== null) {
    const spec = m[2];
    const candidatePaths = [
      path.resolve(dir, spec),
      path.resolve(dir, spec + '.js'),
      path.resolve(dir, spec + '.jsx'),
      path.resolve(dir, spec + '/index.js'),
      path.resolve(dir, spec + '/index.jsx')
    ];
    const target = candidatePaths.find(p => fs.existsSync(p));
    if (!target) continue; // déjà vérifié par check-imports
    
    const targetExp = fileExports[target];
    if (!targetExp) continue;
    
    m[1].split(',').forEach(item => {
      const importedName = item.trim().split(/\s+as\s+/)[0].trim();
      if (!importedName || importedName.startsWith('//') || importedName.startsWith('type ')) return;
      if (!targetExp.has(importedName)) {
        brokenImports.push({
          file: path.relative(srcDir, file),
          importedName,
          target: path.relative(srcDir, target)
        });
      }
    });
  }
});

console.log(`Total broken named imports found: ${brokenImports.length}`);
brokenImports.forEach(b => {
  console.log(`  ❌ In ${b.file}: '${b.importedName}' is not exported by ${b.target}`);
});
