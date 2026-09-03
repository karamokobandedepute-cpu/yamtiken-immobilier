import cron from 'node-cron';
import prisma from '../lib/prisma.js';
import notificationService from '../services/notification.service.js';

/**
 * Initialise toutes les tâches CRON de l'application
 */
export const initCronJobs = () => {
  console.log('⏰ Initialisation des tâches CRON...');

  // Tous les jours à 08h00 du matin (0 8 * * *)
  cron.schedule('0 8 * * *', async () => {
    console.log('🔄 [CRON] Exécution de la vérification quotidienne des retards de paiement...');
    try {
      const today = new Date();
      
      // 1. Trouver tous les baux actifs avec une date d'entrée (clés remises)
      const leases = await prisma.lease.findMany({
        where: {
          statut: 'ACTIF',
          dateEntree: { not: null }
        },
        include: {
          client: true,
          payments: {
            orderBy: { datePaiement: 'desc' },
            take: 1
          },
          unite: {
            include: { building: true }
          }
        }
      });

      let retardsCount = 0;

      for (const lease of leases) {
        // Logique de calcul des retards (similaire à recouvrement.routes.js)
        let lastPaymentDate = lease.dateEntree;
        if (lease.payments.length > 0) {
          lastPaymentDate = lease.payments[0].datePaiement;
        }

        const diffTime = Math.abs(today - lastPaymentDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Si retard supérieur à 30 jours (ou selon le seuil voulu, ici on prend 31 pour relancer après le mois)
        if (diffDays > 30) {
          retardsCount++;
          const montantMois = lease.montantLoyer || (lease.montantInitial / 12); // Simplification
          
          const message = `Bonjour ${lease.client.prenom}, sauf erreur de notre part, nous n'avons pas reçu votre loyer pour le bail ${lease.numeroBail}. Merci de régulariser la somme de ${montantMois} FCFA. IMMO MANAGER PRO.`;
          
          if (lease.client.telephone) {
            await notificationService.sendSMS(lease.client.telephone, message);
          }
        }
      }
      
      console.log(`✅ [CRON] Vérification terminée. ${retardsCount} relance(s) envoyée(s).`);
    } catch (error) {
      console.error('❌ [CRON] Erreur lors de la vérification des retards :', error);
    }
  });
  
  console.log('⏰ Tâches CRON planifiées avec succès (Vérification retards: 08:00 AM).');
};
