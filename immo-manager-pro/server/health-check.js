#!/usr/bin/env node
/**
 * VÉRIFICATION DE SANTÉ DU SERVEUR
 * S'assure que le backend est toujours accessible
 */

import http from 'http';

const checkServer = () => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/health',
      method: 'GET',
      timeout: 3000
    };

    const req = http.request(options, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
};

const restartServer = async () => {
  console.log('🔄 Redémarrage du serveur...');
  // Logique de redémarrage
  process.exit(1); // Sortie pour permettre au process manager de redémarrer
};

const main = async () => {
  const isHealthy = await checkServer();
  
  if (!isHealthy) {
    console.log('❌ Serveur non accessible');
    await restartServer();
  } else {
    console.log('✅ Serveur opérationnel');
    process.exit(0);
  }
};

main();
