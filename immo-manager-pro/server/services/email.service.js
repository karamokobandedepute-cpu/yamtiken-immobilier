// Service d'envoi d'emails (placeholder - nécessite configuration SMTP)

export const sendEmail = async ({ to, subject, text, html }) => {
  // Placeholder pour l'envoi d'email
  // En production, utiliser nodemailer ou un service comme SendGrid
  console.log(`📧 Email simulé envoyé à ${to}`);
  console.log(`   Sujet: ${subject}`);
  return { success: true, message: 'Email envoyé (simulation)' };
};

// Envoyer une relance de paiement
export const sendPaymentReminder = async (client, paiement) => {
  const subject = 'Relance de paiement - YAMTIKEN BEHEMOTH';
  const text = `Bonjour ${client.prenom} ${client.nom},

Nous vous rappelons que votre paiement de ${paiement.montant} FCFA est en retard.

Merci de régulariser votre situation dans les plus brefs délais.

Cordialement,
L'équipe YAMTIKEN BEHEMOTH`;

  return sendEmail({ to: client.email, subject, text });
};

// Envoyer confirmation de visite
export const sendVisiteConfirmation = async (client, visite, bien) => {
  const subject = 'Confirmation de visite - YAMTIKEN BEHEMOTH';
  const text = `Bonjour ${client.prenom} ${client.nom},

Nous confirmons votre visite du bien:
${bien.titre}
${bien.adresse}

Date: ${new Date(visite.dateVisite).toLocaleDateString('fr-FR')}
Heure: ${visite.heureVisite || 'À convenir'}

Cordialement,
L'équipe YAMTIKEN BEHEMOTH`;

  return sendEmail({ to: client.email, subject, text });
};

export default {
  sendEmail,
  sendPaymentReminder,
  sendVisiteConfirmation
};
