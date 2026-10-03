import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import { runIntelligenceEngine } from './services/intelligence.service.js';

const run = async () => {
  await runIntelligenceEngine();
  console.log('Fini');
  process.exit(0);
};

run();
