import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import prisma from '../lib/prisma.js';
import logger from '../lib/logger.js';

export const generateAndSendOtp = async (user) => {
  // 1. Generate a 6-digit random code
  const otpCode = crypto.randomInt(100000, 999999).toString();
  
  // 2. Hash the code for database storage
  const hashedCode = await bcrypt.hash(otpCode, 10);
  
  // 3. Expiration time (10 minutes)
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);

  // 4. Save to database (delete existing OTPs for this user first)
  await prisma.otp.deleteMany({ where: { userId: user.id } });
  
  await prisma.otp.create({
    data: {
      userId: user.id,
      codeHash: hashedCode,
      expiresAt: expiresAt,
      attempts: 0
    }
  });

  // 5. Send Email via SMTP
  // The client must configure this in .env
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER || process.env.GMAIL_APP_EMAIL,
      pass: process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD,
    },
  });

  // Check if credentials exist, otherwise log the OTP (Useful for local development)
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    logger.warn('[OTP] Configuration SMTP manquante. Le code n\'a pas ete envoye par email.');
    logger.info(`[OTP] CODE POUR ${user.email} : ${otpCode}`);
    return;
  }

  // Send the Email
  const mailOptions = {
    from: `"Yamtiken" <${process.env.SMTP_FROM || 'no-reply@yamtiken.com'}>`,
    to: user.email,
    subject: 'Votre code de vérification Yamtiken : ' + otpCode,
    text: `Bonjour ${user.prenom},\n\nVoici votre code de vérification à 6 chiffres : ${otpCode}\n\nCe code expirera dans 10 minutes.\nSi vous n'avez pas demandé ce code, ignorez cet email.\n\nL'équipe Yamtiken`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #E5E7EB; border-radius: 8px;">
        <h2 style="color: #0D3B1F; text-align: center;">Vérification de sécurité</h2>
        <p>Bonjour <strong>${user.prenom}</strong>,</p>
        <p>Voici votre code de vérification pour vous connecter à votre compte Yamtiken :</p>
        <div style="background-color: #F3F4F6; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #1A6B35; border-radius: 8px; margin: 20px 0;">
          ${otpCode}
        </div>
        <p style="color: #6B7280; font-size: 13px;">Ce code est valide pendant 10 minutes.</p>
        <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;" />
        <p style="color: #9CA3AF; font-size: 11px; text-align: center;">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`[OTP] Email envoyé avec succès à ${user.email}`);
  } catch (error) {
    logger.error('[OTP] Erreur SMTP:', { error: error.message });
    throw new Error("Erreur lors de l'envoi de l'email OTP");
  }
};

export const verifyOtpCode = async (userId, inputCode) => {
  const otpRecord = await prisma.otp.findFirst({
    where: { userId: userId },
    orderBy: { createdAt: 'desc' }
  });

  if (!otpRecord) {
    throw new Error('Aucun code de vérification trouvé. Veuillez en demander un nouveau.');
  }

  if (otpRecord.attempts >= 5) {
    await prisma.otp.delete({ where: { id: otpRecord.id } });
    throw new Error('Trop de tentatives échouées. Veuillez demander un nouveau code.');
  }

  if (new Date() > otpRecord.expiresAt) {
    await prisma.otp.delete({ where: { id: otpRecord.id } });
    throw new Error('Le code a expiré. Veuillez en demander un nouveau.');
  }

  const isValid = await bcrypt.compare(inputCode, otpRecord.codeHash);

  if (!isValid) {
    await prisma.otp.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } }
    });
    throw new Error('Code incorrect.');
  }

  // Success: mark user as verified and delete OTP
  await prisma.user.update({
    where: { id: userId },
    data: { verified: true }
  });
  
  await prisma.otp.delete({ where: { id: otpRecord.id } });
  
  return true;
};
