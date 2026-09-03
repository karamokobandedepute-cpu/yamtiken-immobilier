import prisma from '../lib/prisma.js';
import cron from 'node-cron';
import nodemailer from 'nodemailer';
import notificationService from './notification.service.js';

const { createTransport } = nodemailer.default || nodemailer;

// Configuration email (à adapter selon votre service email)
const transporter = createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

class CronService {
  constructor() {
    this.tasks = [];
  }

  start() {
    console.log('🕐 Démarrage du service CRON...');
    
    // Tâche 1: Générer les alertes automatiques tous les jours à 6h du matin
    const alertTask = cron.schedule('0 6 * * *', async () => {
      console.log('📢 Génération des alertes automatiques...');
      await this.generateAlertesAutomatiques();
    }, {
      scheduled: true,
      timezone: 'Africa/Abidjan'
    });

    // Tâche 2: Envoyer l'email récapitulatif à 7h du matin
    const emailTask = cron.schedule('0 7 * * *', async () => {
      console.log('📧 Envoi de l\'email récapitulatif...');
      await this.sendRecapEmail();
    }, {
      scheduled: true,
      timezone: 'Africa/Abidjan'
    });

    // Tâche 3: Détecter les paiements en retard > 7 jours à 8h
    const retardTask = cron.schedule('0 8 * * *', async () => {
      console.log('⏰ Détection des paiements en retard...');
      await this.detectRetardsPaiement();
    }, {
      scheduled: true,
      timezone: 'Africa/Abidjan'
    });

    this.tasks.push(alertTask, emailTask, retardTask);
    console.log('✅ Service CRON démarré avec succès');
  }

  stop() {
    this.tasks.forEach(task => task.stop());
    console.log('🛑 Service CRON arrêté');
  }

  // Générer les alertes automatiques
  async generateAlertesAutomatiques() {
    try {
      const today = new Date();
      const sevenDaysLater = new Date(today);
      sevenDaysLater.setDate(today.getDate() + 7);
      
      const thirtyDaysLater = new Date(today);
      thirtyDaysLater.setDate(today.getDate() + 30);

      // 1. Alertes pour paiements à échéance (≤ 7 jours)
      const paiementsEcheance = await prisma.lease.findMany({
        where: {
          statut: 'ACTIF',
          payments: {
            none: {
              datePaiement: {
                gte: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 derniers jours
              }
            }
          }
        },
        include: {
          client: true,
          payments: {
            orderBy: { datePaiement: 'desc' },
            take: 1
          }
        }
      });

      for (const lease of paiementsEcheance) {
        const lastPayment = lease.payments[0];
        const daysSinceLastPayment = lastPayment 
          ? Math.floor((today - new Date(lastPayment.datePaiement)) / (1000 * 60 * 60 * 24))
          : 30;

        if (daysSinceLastPayment >= 23) { // Paiement dû dans ≤ 7 jours
          await this.createOrUpdateAlerte({
            type: 'PAIEMENT_ECHEANCE',
            titre: `Paiement dû - ${lease.client?.prenom} ${lease.client?.nom}`,
            description: `Le bail ${lease.numeroBail} n'a pas reçu de paiement depuis ${daysSinceLastPayment} jours. Reste dû: ${lease.montantInitial - (lease.payments.reduce((sum, p) => sum + p.montantVerse, 0))} FCFA`,
            referenceId: lease.id,
            referenceType: 'lease',
            dateEcheance: new Date(today.getTime() + (30 - daysSinceLastPayment) * 24 * 60 * 60 * 1000)
          });
        }
      }

      // 2. Alertes pour baux expirant (≤ 30 jours)
      const bauxExpiration = await prisma.lease.findMany({
        where: {
          statut: 'ACTIF',
          dateFin: {
            not: null,
            lte: thirtyDaysLater,
            gte: today
          }
        },
        include: {
          client: true
        }
      });

      for (const lease of bauxExpiration) {
        const daysUntilExpiry = Math.floor((new Date(lease.dateFin) - today) / (1000 * 60 * 60 * 24));
        
        await this.createOrUpdateAlerte({
          type: 'BAIL_EXPIRATION',
          titre: `Bail expirant dans ${daysUntilExpiry} jours`,
          description: `Le bail ${lease.numeroBail} de ${lease.client?.prenom} ${lease.client?.nom} expire le ${lease.dateFin.toLocaleDateString('fr-FR')}.`,
          referenceId: lease.id,
          referenceType: 'lease',
          dateEcheance: lease.dateFin
        });
      }

      // 3. Alertes pour relances visites prévues aujourd'hui
      const relancesAujourdHui = await prisma.visite.findMany({
        where: {
          relanceSouhait: true,
          statutRelance: 'EN_ATTENTE',
          dateRelance: {
            gte: new Date(today.setHours(0, 0, 0, 0)),
            lte: new Date(today.setHours(23, 59, 59, 999))
          }
        }
      });

      for (const visite of relancesAujourdHui) {
        await this.createOrUpdateAlerte({
          type: 'RELANCE_VISITE',
          titre: `Relance visite - ${visite.prenomVisiteur} ${visite.nomVisiteur}`,
          description: `Relance prévue aujourd'hui pour ${visite.prenomVisiteur} ${visite.nomVisiteur} (${visite.contact}). Motif: ${visite.motif}`,
          referenceId: visite.id,
          referenceType: 'visite',
          dateEcheance: visite.dateRelance
        });
      }

      console.log(`✅ ${paiementsEcheance.length + bauxExpiration.length + relancesAujourdHui.length} alertes générées`);
    } catch (error) {
      console.error('❌ Erreur lors de la génération des alertes:', error);
    }
  }

  // Créer ou mettre à jour une alerte (éviter les doublons)
  async createOrUpdateAlerte(data) {
    try {
      // Vérifier si une alerte similaire existe déjà et non traitée
      const existingAlerte = await prisma.alerte.findFirst({
        where: {
          type: data.type,
          referenceId: data.referenceId,
          referenceType: data.referenceType,
          estTraitee: false
        }
      });

      if (existingAlerte) {
        // Mettre à jour l'alerte existante
        await prisma.alerte.update({
          where: { id: existingAlerte.id },
          data: {
            titre: data.titre,
            description: data.description,
            dateEcheance: data.dateEcheance,
            estLue: false
          }
        });
      } else {
        // Créer une nouvelle alerte
        await prisma.alerte.create({
          data
        });
      }
    } catch (error) {
      console.error('Erreur lors de la création de l\'alerte:', error);
    }
  }

  // Envoyer l'email récapitulatif
  async sendRecapEmail() {
    try {
      // Récupérer toutes les alertes non lues/non traitées
      const alertes = await prisma.alerte.findMany({
        where: {
          estTraitee: false
        },
        orderBy: { dateEcheance: 'asc' }
      });

      if (alertes.length === 0) {
        console.log('📭 Aucune alerte à signaler aujourd\'hui');
        return;
      }

      // Grouper les alertes par type
      const alertesParType = {
        PAIEMENT_ECHEANCE: alertes.filter(a => a.type === 'PAIEMENT_ECHEANCE'),
        BAIL_EXPIRATION: alertes.filter(a => a.type === 'BAIL_EXPIRATION'),
        RELANCE_VISITE: alertes.filter(a => a.type === 'RELANCE_VISITE')
      };

      // Construire le contenu de l'email
      const emailContent = `
        <h2 style="color: #0D3B1F;">📋 Récapitulatif des alertes - ${new Date().toLocaleDateString('fr-FR')}</h2>
        
        <p>Bonjour,</p>
        <p>Voici le récapitulatif des alertes du jour pour <strong>IMMO MANAGER PRO</strong> :</p>
        
        ${alertesParType.PAIEMENT_ECHEANCE.length > 0 ? `
        <h3 style="color: #DC2626;">💰 Paiements à échéance (${alertesParType.PAIEMENT_ECHEANCE.length})</h3>
        <ul>
          ${alertesParType.PAIEMENT_ECHEANCE.map(a => `<li><strong>${a.titre}</strong> - ${a.description}</li>`).join('')}
        </ul>
        ` : ''}
        
        ${alertesParType.BAIL_EXPIRATION.length > 0 ? `
        <h3 style="color: #C8960C;">🏠 Baux expirant bientôt (${alertesParType.BAIL_EXPIRATION.length})</h3>
        <ul>
          ${alertesParType.BAIL_EXPIRATION.map(a => `<li><strong>${a.titre}</strong> - ${a.description}</li>`).join('')}
        </ul>
        ` : ''}
        
        ${alertesParType.RELANCE_VISITE.length > 0 ? `
        <h3 style="color: #1A6B35;">📞 Relances visites (${alertesParType.RELANCE_VISITE.length})</h3>
        <ul>
          ${alertesParType.RELANCE_VISITE.map(a => `<li><strong>${a.titre}</strong> - ${a.description}</li>`).join('')}
        </ul>
        ` : ''}
        
        <p style="margin-top: 30px; color: #6B7280;">
          <em>Cet email a été généré automatiquement par IMMO MANAGER PRO.</em><br>
          Connectez-vous à votre espace pour traiter ces alertes.
        </p>
      `;

      // Envoyer l'email au responsable
      await transporter.sendMail({
        from: `"IMMO MANAGER PRO" <${process.env.SMTP_USER}>`,
        to: process.env.ALERT_EMAIL || 'responsable@yamtiken-behemoth.ci',
        subject: `📢 ${alertes.length} alerte(s) - IMMO MANAGER PRO`,
        html: emailContent
      });

      // Marquer les alertes comme email envoyé
      await prisma.alerte.updateMany({
        where: {
          estTraitee: false,
          emailEnvoye: false
        },
        data: {
          emailEnvoye: true,
          dateEnvoiEmail: new Date()
        }
      });

      console.log(`✅ Email récapitulatif envoyé avec ${alertes.length} alertes`);
    } catch (error) {
      console.error('❌ Erreur lors de l\'envoi de l\'email:', error);
    }
  }

  // Détecter les paiements en retard de plus de 7 jours
  async detectRetardsPaiement() {
    try {
      const today = new Date();
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 7);

      // Trouver les baux actifs dont le dernier paiement remonte à +7 jours
      const leasesEnRetard = await prisma.lease.findMany({
        where: {
          statut: 'ACTIF',
          payments: {
            none: {
              datePaiement: {
                gte: sevenDaysAgo
              }
            }
          }
        },
        include: {
          client: true,
          payments: {
            orderBy: { datePaiement: 'desc' },
            take: 1
          }
        }
      });

      let alertesCreees = 0;

      for (const lease of leasesEnRetard) {
        const lastPayment = lease.payments[0];
        const daysSinceLastPayment = lastPayment
          ? Math.floor((today - new Date(lastPayment.datePaiement)) / (1000 * 60 * 60 * 24))
          : 999;

        if (daysSinceLastPayment > 7) {
          const totalPaye = lease.payments.reduce((sum, p) => sum + p.montantVerse, 0);
          const resteDu = lease.montantInitial - totalPaye;

          await this.createOrUpdateAlerte({
            type: 'PAIEMENT_ECHEANCE',
            titre: `RETARD ${daysSinceLastPayment}j - ${lease.client?.prenom} ${lease.client?.nom}`,
            description: `Le bail ${lease.numeroBail} n'a pas été payé depuis ${daysSinceLastPayment} jours. Reste dû: ${Math.round(resteDu).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} FCFA. Dernier paiement: ${lastPayment ? new Date(lastPayment.datePaiement).toLocaleDateString('fr-FR') : 'Aucun'}`,
            referenceId: lease.id,
            referenceType: 'lease',
            dateEcheance: today
          });

          // Créer une notification pour les agents de recouvrement
          const agentsRecouvrement = await prisma.user.findMany({
            where: {
              role: { in: ['SUPER_ADMIN', 'ADMIN', 'AGENT_RECOUVREMENT'] },
              actif: true
            }
          });

          for (const agent of agentsRecouvrement) {
            await prisma.notification.create({
              data: {
                userId: agent.id,
                titre: `Retard paiement - ${lease.client?.prenom} ${lease.client?.nom}`,
                message: `${daysSinceLastPayment} jours de retard sur le bail ${lease.numeroBail}. Reste dû: ${Math.round(resteDu).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')} FCFA`,
                type: 'WARNING',
                lien: `/recouvrement`
              }
            });
          }
          
          // PHASE 2 : Envoi du SMS automatisé au locataire
          if (lease.client?.telephone) {
            const smsMessage = `Bonjour ${lease.client.prenom}, sauf erreur de notre part, votre loyer de ${Math.round(resteDu)} FCFA n'a pas été reçu. Merci de régulariser rapidement. IMMO MANAGER PRO.`;
            await notificationService.sendSMS(lease.client.telephone, smsMessage);
          }

          alertesCreees++;
        }
      }

      console.log(`✅ ${alertesCreees} alertes de retard créées sur ${leasesEnRetard.length} baux vérifiés`);
    } catch (error) {
      console.error('❌ Erreur détection retards:', error);
    }
  }

  // Méthode manuelle pour tester (à utiliser via endpoint admin)
  async generateAlertsManually() {
    await this.generateAlertesAutomatiques();
    return { message: 'Alertes générées manuellement' };
  }
}

export default new CronService();
