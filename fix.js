const fs = require('fs');
let content = fs.readFileSync('immo-manager-pro/server/routes/recouvrement.routes.js', 'utf8');

// Fix 1: encaisseMois
content = content.replace('datePaiement: { gte: startOfMonth }', 'datePaiement: { gte: startOfMonth }, deletedAt: null');

// Fix 2: encaisseAnnee
content = content.replace('datePaiement: { gte: startOfYear }', 'datePaiement: { gte: startOfYear }, deletedAt: null');

// Fix 3: dossiersRetard
content = content.replace(/statut:\s*'ACTIF',\s*dateEntree:\s*\{\s*not:\s*null\s*\},\s*payments:/g, 'statut: \'ACTIF\', deletedAt: null, dateEntree: { not: null }, payments:');
content = content.replace(/datePaiement:\s*\{\s*gte:\s*thirtyDaysAgo\s*\}/g, 'datePaiement: { gte: thirtyDaysAgo }, deletedAt: null');

// Fix 4: totalAttenduMois
content = content.replace(/statut:\s*'ACTIF',\s*dateEntree:\s*\{\s*not:\s*null\s*\}/g, 'statut: \'ACTIF\', deletedAt: null, dateEntree: { not: null }');

// Fix 5: statistiques-mensuelles queryRaw
content = content.replace(/WHERE\s*\\"datePaiement\\"\s*>=\s*\\\$\{startOfYear\}/g, 'WHERE \"datePaiement\" >=  AND \"deletedAt\" IS NULL');

fs.writeFileSync('immo-manager-pro/server/routes/recouvrement.routes.js', content, 'utf8');
