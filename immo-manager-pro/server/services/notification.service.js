/**
 * Service de Notification (Mock / Simulation)
 * 
 * Ce service est conçu pour être "plug-and-play".
 * Il simule actuellement l'envoi de SMS et Emails, et trace l'historique
 * dans les logs de la console. Il suffira d'ajouter vos clés d'API
 * Twilio, SendGrid ou autre dans le futur pour que cela soit réel.
 */

class NotificationService {
  /**
   * Envoie un SMS à un client
   * @param {string} to - Numéro de téléphone cible
   * @param {string} message - Contenu du SMS
   */
  async sendSMS(to, message) {
    try {
      console.log('--------------------------------------------------');
      console.log(`📱 [SIMULATION SMS] Envoi en cours vers ${to}...`);
      console.log(`✉️ Message : "${message}"`);
      
      // TODO: Insérer l'intégration Twilio / Vonage ici plus tard
      // Exemple : await twilioClient.messages.create({ body: message, from: TWILIO_PHONE, to: to });
      
      await new Promise(resolve => setTimeout(resolve, 500)); // Simuler délai réseau
      console.log(`✅ [SIMULATION SMS] Envoyé avec succès !`);
      console.log('--------------------------------------------------');
      return { success: true, method: 'SMS', to };
    } catch (error) {
      console.error(`❌ [ERREUR SMS] Échec de l'envoi vers ${to}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envoie un Email à un client
   * @param {string} to - Adresse email cible
   * @param {string} subject - Sujet de l'email
   * @param {string} htmlContent - Contenu HTML de l'email
   */
  async sendEmail(to, subject, htmlContent) {
    try {
      console.log('--------------------------------------------------');
      console.log(`📧 [SIMULATION EMAIL] Envoi en cours vers ${to}...`);
      console.log(`📌 Sujet : "${subject}"`);
      // console.log(`📄 Contenu : ${htmlContent}`);
      
      // TODO: Insérer l'intégration SendGrid / Nodemailer ici plus tard
      
      await new Promise(resolve => setTimeout(resolve, 800)); // Simuler délai réseau
      console.log(`✅ [SIMULATION EMAIL] Envoyé avec succès !`);
      console.log('--------------------------------------------------');
      return { success: true, method: 'EMAIL', to };
    } catch (error) {
      console.error(`❌ [ERREUR EMAIL] Échec de l'envoi vers ${to}:`, error);
      return { success: false, error: error.message };
    }
  }
}

export default new NotificationService();
