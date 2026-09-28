const fs = require('fs');
let c = fs.readFileSync('immo-manager-pro/server/routes/recouvrement.routes.js', 'utf8');
c = c.replace('WHERE "datePaiement" >= $\{startOfYear}', 'WHERE "datePaiement" >= $\{startOfYear} AND "deletedAt" IS NULL');
fs.writeFileSync('immo-manager-pro/server/routes/recouvrement.routes.js', c);
