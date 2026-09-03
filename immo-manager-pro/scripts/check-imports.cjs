const fs = require('fs');
const path = require('path');

function getFiles(dir, extList) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      if (!['node_modules', 'dist', 'dist-electron', '.git', 'android'].includes(file)) {
        results = results.concat(getFiles(full, extList));
      }
    } else {
      if (extList.includes(path.extname(file))) results.push(full);
    }
  });
  return results;
}

const clientFiles = getFiles(path.resolve(__dirname, '../client/src'), ['.js', '.jsx']);
const serverFiles = getFiles(path.resolve(__dirname, '../server'), ['.js', '.mjs']).filter(f => !f.includes('node_modules'));

const allFiles = [...clientFiles, ...serverFiles];
const missingImports = [];
const importRegex = /(?:import|export)\s+(?:[\w*\s{},]*\s+from\s+)?['"](\.[^'"]+)['"]/g;
const dynamicImportRegex = /import\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;

allFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(file);
  let match;
  
  function checkSpec(spec) {
    const candidatePaths = [
      path.resolve(dir, spec),
      path.resolve(dir, spec + '.js'),
      path.resolve(dir, spec + '.jsx'),
      path.resolve(dir, spec + '.json'),
      path.resolve(dir, spec + '/index.js'),
      path.resolve(dir, spec + '/index.jsx')
    ];
    const found = candidatePaths.some(p => fs.existsSync(p));
    if (!found) {
      missingImports.push({ file: path.relative(path.resolve(__dirname, '..'), file), spec });
    }
  }

  while ((match = importRegex.exec(content)) !== null) {
    checkSpec(match[1]);
  }
  while ((match = dynamicImportRegex.exec(content)) !== null) {
    checkSpec(match[1]);
  }
});

console.log('Total files scanned:', allFiles.length);
console.log('Missing imports found:', missingImports.length);
missingImports.forEach(m => console.log('  ❌ In:', m.file, '--> Cannot find:', m.spec));
