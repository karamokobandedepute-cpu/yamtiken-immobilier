import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const runIntelligenceEngine = async () => {
  console.log("🧠 [Intelligence Engine] Démarrage de l'analyse financière et stratégique...");
  
  try {
    const today = new Date();
    
    // Récupérer les utilisateurs qui doivent recevoir les insights (Admin, Direction, Secretaire)
    const managers = await prisma.user.findMany({
      where: { role: { in: ['SUPER_ADMIN', 'ADMIN', 'DIRECTION', 'SECRETAIRE'] }, actif: true }
    });

    const notifyManagers = async (titre, message, type = 'IA_SUGGESTION', lien = null) => {
      for (const manager of managers) {
        await prisma.notification.create({
          data: {
            userId: manager.id,
            titre,
            message,
            type,
            lien
          }
        });
      }
    };

    // 1. Optimisation des Vacances Locatives (Manque à gagner)
    const unitesVides = await prisma.unite.findMany({
      where: { statut: 'VACANT' },
      include: { building: true }
    });

    if (unitesVides.length > 0) {
      const manqueAGagner = unitesVides.reduce((sum, u) => sum + parseFloat(u.loyerBase || 0), 0);
      if (manqueAGagner > 0) {
        await notifyManagers(
          '📉 Optimisation des Revenus',
          `Vous avez ${unitesVides.length} unités vides représentant une perte potentielle de ${manqueAGagner.toLocaleString()} FCFA/mois. L'IA suggère d'activer des campagnes promotionnelles sur ces biens.`,
          'IA_STRATEGIE',
          `/biens`
        );
      }
    }

    // 2. Suivi des expirations de baux (Rétention client)
    const dansUnMois = new Date();
    dansUnMois.setMonth(today.getMonth() + 1);

    const bauxAExpirer = await prisma.lease.findMany({
      where: {
        dateFin: {
          lte: dansUnMois,
          gte: today
        },
        statut: 'ACTIF'
      },
      include: { client: true }
    });

    if (bauxAExpirer.length > 0) {
      await notifyManagers(
        '🤝 Fidélisation Locataires',
        `${bauxAExpirer.length} bail(x) expire(nt) dans moins de 30 jours. Programmez des appels dès aujourd'hui pour proposer un renouvellement et sécuriser vos encaissements.`,
        'IA_SUGGESTION',
        `/leases`
      );
    }

    // 3. Rappels de Recouvrement
    // Une alerte générique pour relancer le recouvrement si le jour du mois est entre le 5 et le 10
    if (today.getDate() >= 5 && today.getDate() <= 10) {
        await notifyManagers(
          '🚨 Campagne de Recouvrement',
          `Nous sommes le ${today.getDate()} du mois. L'IA recommande d'analyser le tableau de bord Recouvrement et d'envoyer les pénalités aux locataires retardataires.`,
          'IA_URGENT',
          `/recouvrement`
        );
    }

    console.log("🧠 [Intelligence Engine] Analyse terminée.");
  } catch (error) {
    console.error("❌ Erreur Intelligence Engine:", error);
  }
};
