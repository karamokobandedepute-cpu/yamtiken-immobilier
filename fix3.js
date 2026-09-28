const fs = require('fs');

function fixFile(file) {
    let c = fs.readFileSync(file, 'utf8');
    c = c.replace(/deletedAt:\s*null/g, 'deletedAt: null, isDemo: false');
    c = c.replace(/AND "deletedAt" IS NULL/g, 'AND "deletedAt" IS NULL AND is_demo = false');
    fs.writeFileSync(file, c);
}

fixFile('immo-manager-pro/server/routes/dashboard.routes.js');
fixFile('immo-manager-pro/server/routes/recouvrement.routes.js');
