const fs = require('fs');
const file = 'immo-manager-pro/server/controllers/client-raw.controller.js';
let c = fs.readFileSync(file, 'utf8');

c = c.replace(/FROM public.leases\s+GROUP BY "clientId"/, 'FROM public.leases WHERE "deletedAt" IS NULL AND is_demo = false GROUP BY "clientId"');
c = c.replace(/WHERE statut = 'ACTIF'::"StatutLease"/, 'WHERE statut = \'ACTIF\'::"StatutLease" AND "deletedAt" IS NULL AND is_demo = false');
c = c.replace(/JOIN public.leases l ON p."leaseId" = l.id\s+GROUP BY l."clientId"/, 'JOIN public.leases l ON p."leaseId" = l.id WHERE p."deletedAt" IS NULL AND p.is_demo = false AND l."deletedAt" IS NULL AND l.is_demo = false GROUP BY l."clientId"');
c = c.replace(/FROM public.clients c\s+LEFT JOIN/, 'FROM public.clients c LEFT JOIN');
c = c.replace(/c.is_demo, c.actif/, 'c.is_demo, c.actif');

// Also need to add WHERE for clients to not include deleted clients!
c = c.replace(/FROM public.clients c\s+LEFT JOIN/, 'FROM public.clients c \n        WHERE c."deletedAt" IS NULL AND c.is_demo = false \n        LEFT JOIN');
// Wait, LEFT JOIN comes BEFORE WHERE in standard SQL!
c = c.replace(/pay_agg ON c.id = pay_agg."clientId"/, 'pay_agg ON c.id = pay_agg."clientId"\n        WHERE c."deletedAt" IS NULL AND c.is_demo = false');

fs.writeFileSync(file, c);
