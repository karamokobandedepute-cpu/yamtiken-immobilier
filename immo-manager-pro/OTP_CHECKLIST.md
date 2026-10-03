# CHECKLIST OTP : MISE EN PRODUCTION DES EMAILS 🚀

Félicitations, votre système d'OTP est intégralement codé dans votre application !
Cependant, pour que les emails soient **réellement envoyés** et ne finissent **jamais dans les spams**, vous devez configurer le fournisseur de messagerie.

Voici les 4 étapes exactes que **VOUS** devez faire :

## 1. Créer un compte d'email transactionnel
Ne passez **jamais** par Gmail pour envoyer des OTP en production (Gmail bloquera votre compte pour spam/robots). 
Je vous recommande **Resend**, **Brevo** ou **Postmark**. 
👉 *Exemple avec Brevo (ex-Sendinblue) qui offre 300 emails gratuits par jour.*
- Créez un compte sur [brevo.com](https://www.brevo.com/fr/).
- Allez dans `Transactionnel` > `Paramètres` > `SMTP et API`.

## 2. Authentifier votre Nom de Domaine
C'est le plus important. Si votre app est sur `yamtiken.com`, vous devez envoyer les emails depuis `@yamtiken.com`.
- Dans Brevo, allez dans `Expéditeurs et IP` > `Domaines`.
- Ajoutez votre domaine (ex: `yamtiken.com`).
- Brevo va vous donner **3 ou 4 enregistrements DNS** (TXT, CNAME).
- Allez chez votre hébergeur (Hostinger, OVH, LWS, etc.) dans la zone "Gestion DNS" et **copiez-collez exactement ces clés**. C'est ce qui prouve à Gmail/Outlook que vous êtes légitime (DKIM/SPF).

## 3. Remplir le fichier `.env` de votre Serveur (Backend)
Dans le dossier racine ou `server/`, ouvrez votre fichier `.env` et ajoutez ces lignes avec vos vrais identifiants :

\`\`\`env
# --- CONFIGURATION EMAILS OTP ---
# Exemple pour Brevo (SMTP)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=votre_email_brevo_ou_cle_fournie@yamtiken.com
SMTP_PASS=votre_mot_de_passe_smtp_ou_master_key
SMTP_FROM=no-reply@yamtiken.com
\`\`\`

## 4. Tester en conditions réelles
1. Redémarrez votre serveur backend (`npm run dev` ou `pm2 restart all`).
2. Connectez-vous avec un compte employé "Non Vérifié".
3. Observez la redirection vers la page à 6 cases.
4. Vérifiez votre boîte mail (ou celle de l'employé). Le code doit arriver instantanément en boîte de réception principale !

---
*En attendant que vous configuriez ces clés, le serveur n'enverra pas l'email mais l'application affichera tout de même la page de sécurité si le compte n'est pas vérifié.*
