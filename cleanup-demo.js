const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  console.log('Démarrage du nettoyage des données de démonstration...');
  
  try {
    const models = [
      'alerte', 'notification', 'document', 'relance', 'auditLog', 'depense',
      'payment', 'facture', 'paiement', 'visite', 'commission', 'lease',
      'contrat', 'unite', 'building', 'bien', 'client', 'referrer', 'user'
    ];
    
    for (const modelName of models) {
      if (prisma[modelName]) {
        // Check if model has isDemo by trying to find one
        try {
          const res = await prisma[modelName].deleteMany({
            where: { isDemo: true }
          });
          if (res.count > 0) {
            console.log(- \: \ enregistrement(s) de démo supprimé(s).);
          }
        } catch (err) {
          // Field isDemo might not exist on this model, ignore
        }
      }
    }
    
    console.log('Nettoyage terminé avec succès ! Toutes les données réelles sont conservées.');
  } catch (error) {
    console.error('Erreur globale:', error);
  } finally {
    await prisma.();
  }
}

cleanup();
