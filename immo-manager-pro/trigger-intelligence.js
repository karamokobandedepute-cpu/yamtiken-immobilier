import dotenv from 'dotenv';
dotenv.config();

import { runIntelligenceEngine } from './server/services/intelligence.service.js';

const run = async () => {
  await runIntelligenceEngine();
  console.log('Fini');
  process.exit(0);
};

run();
