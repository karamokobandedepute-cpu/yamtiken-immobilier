import { PrismaClient } from '@prisma/client';

// Client Prisma avec gestion résiliente des erreurs DB
const realPrisma = new PrismaClient({
  log: ['error']
});

// Valeurs par défaut pour les méthodes Prisma quand la DB est inaccessible
const defaultReturns = {
  findMany: [],
  findUnique: null,
  findFirst: null,
  count: 0,
  aggregate: { _count: 0, _sum: {}, _avg: {}, _min: {}, _max: {} },
  groupBy: [],
  create: null,
  update: null,
  upsert: null,
  delete: null,
  deleteMany: { count: 0 },
  updateMany: { count: 0 },
  createMany: { count: 0 }
};

// Wrapper récursif pour les modèles
const wrapModel = (model, modelName) => {
  return new Proxy(model, {
    get(target, prop) {
      const original = target[prop];
      if (typeof original !== 'function') return original;
      
      return async (...args) => {
        try {
          return await original.apply(target, args);
        } catch (error) {
          const isDbError = error?.message?.includes('ENOTFOUND') ||
                           error?.message?.includes('ECONNREFUSED') ||
                           error?.message?.includes('ECONNRESET') ||
                           error?.message?.includes('connect ETIMEDOUT') ||
                           error?.message?.includes('FATAL: password authentication') ||
                           error?.code === 'P1001' ||
                           error?.code === 'P1002' ||
                           error?.code === 'P1017';
          
          if (isDbError && prop in defaultReturns) {
            console.warn(`⚠️  DB indisponible pour ${modelName}.${String(prop)} - retour valeur par défaut`);
            return defaultReturns[prop];
          }
          throw error;
        }
      };
    }
  });
};

// Modèle factice qui retourne toujours les valeurs par défaut
const createFakeModel = (modelName) => {
  const fakeMethods = {};
  for (const [method, defaultValue] of Object.entries(defaultReturns)) {
    fakeMethods[method] = async () => {
      console.warn(`⚠️  Modèle ${modelName} inexistant - retour ${method}=defaultValue`);
      return defaultValue;
    };
  }
  return fakeMethods;
};

// Proxy global pour intercepter les modèles
const prisma = new Proxy(realPrisma, {
  get(target, prop) {
    const value = target[prop];
    const propStr = String(prop);
    
    // Si c'est un modèle Prisma (objet avec findMany, etc.)
    if (value && typeof value === 'object' && typeof value.findMany === 'function') {
      return wrapModel(value, propStr);
    }
    // $transaction, $queryRaw, $executeRaw, etc.
    if (typeof value === 'function' && propStr.startsWith('$')) {
      return async (...args) => {
        try {
          return await value.apply(target, args);
        } catch (error) {
          const isDbError = error?.message?.includes('ENOTFOUND') ||
                           error?.message?.includes('ECONNREFUSED') ||
                           error?.message?.includes('ECONNRESET') ||
                           error?.message?.includes('connect ETIMEDOUT') ||
                           error?.code === 'P1001' ||
                           error?.code === 'P1002' ||
                           error?.code === 'P1017';
          if (isDbError) {
            console.warn(`⚠️  DB indisponible pour ${propStr}`);
            return [];
          }
          throw error;
        }
      };
    }
    // Si propriété inexistante et ressemble à un nom de modèle (lowercase, sans $)
    if (value === undefined && /^[a-z]/.test(propStr) && !propStr.startsWith('_')) {
      return createFakeModel(propStr);
    }
    return value;
  }
});

export default prisma;
export { prisma };
