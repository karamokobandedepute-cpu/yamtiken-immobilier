const fs = require('fs');
const path = require('path');

function checkPackage(pkgJsonPath, codeDir) {
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  const deps = new Set([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
    // Built-in node modules
    'fs', 'path', 'url', 'http', 'https', 'crypto', 'child_process', 'os', 'events', 'stream', 'util', 'net', 'tls', 'zlib', 'buffer', 'assert', 'querystring'
  ]);

  function getFiles(dir) {
    let res = [];
    if (!fs.existsSync(dir)) return res;
    fs.readdirSync(dir).forEach(file => {
      const full = path.join(dir, file);
      if (fs.statSync(full).isDirectory()) {
        if (!['node_modules', 'dist', 'dist-electron', '.git', 'android'].includes(file)) {
          res = res.concat(getFiles(full));
        }
      } else if (/\.(jsx?|mjs|cjs)$/.test(file)) res.push(full);
    });
    return res;
  }

  const files = getFiles(codeDir);
  const missing = [];

  const r = /(?:import\s+.*?from\s+['"]([^'".\/][^'"]*)['"]|require\s*\(\s*['"]([^'".\/][^'"]*)['"]\s*\))/g;

  files.forEach(file => {
    const code = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = r.exec(code)) !== null) {
      const rawPkg = m[1] || m[2];
      const pkgName = rawPkg.startsWith('@') 
        ? rawPkg.split('/').slice(0, 2).join('/') 
        : rawPkg.split('/')[0];

      if (!deps.has(pkgName)) {
        missing.push({ file: path.relative(path.dirname(pkgJsonPath), file), pkgName, raw: rawPkg });
      }
    }
  });

  return missing;
}

const clientMissing = checkPackage(
  path.resolve(__dirname, '../client/package.json'),
  path.resolve(__dirname, '../client/src')
);

const serverMissing = checkPackage(
  path.resolve(__dirname, '../server/package.json'),
  path.resolve(__dirname, '../server')
);

console.log('Client missing package dependencies:', clientMissing.length);
clientMissing.forEach(m => console.log('  ❌ In', m.file, '-->', m.pkgName));

console.log('Server missing package dependencies:', serverMissing.length);
serverMissing.forEach(m => console.log('  ❌ In', m.file, '-->', m.pkgName));
