import express from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'yamtiken-secret-key-2026';

// SMTP Transporter
const getTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || process.env.GMAIL_APP_EMAIL,
      pass: process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD,
    },
  });
};

const verifyExtranetToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(403).json({ message: 'Token manquant' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Token invalide' });
    if (decoded.role !== 'CLIENT') return res.status(403).json({ message: 'Accès non autorisé' });
    req.clientId = decoded.id;
    next();
  });
};

// 1. Envoyer OTP
router.post('/login', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email requis' });

    const client = await prisma.client.findFirst({ 
      where: { email: { equals: email, mode: 'insensitive' } } 
    });

    if (!client) {
      return res.json({ message: 'Si un compte existe avec cet email, un code a été envoyé.' });
    }

    const otpCode = crypto.randomInt(100000, 999999).toString();
    const codeHash = await bcrypt.hash(otpCode, 10);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    await prisma.clientOtp.deleteMany({ where: { clientId: client.id } });
    await prisma.clientOtp.create({
      data: {
        clientId: client.id,
        codeHash,
        expiresAt
      }
    });

    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"Yamtiken Manager" <${process.env.SMTP_USER || 'no-reply@yamtiken.com'}>`,
      to: client.email,
      subject: "Code d'accès Portail Locataire",
      text: `Votre code d'accès au portail Yamtiken est : ${otpCode}. Ce code expire dans 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
          <h2 style="color: #1A6B35; text-align: center;">Portail Locataire Yamtiken</h2>
          <p>Bonjour,</p>
          <p>Voici votre code de vérification pour accéder à votre espace personnel :</p>
          <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #1f2937;">${otpCode}</span>
          </div>
          <p>Ce code est valide pendant 10 minutes. Si vous n'avez pas demandé ce code, ignorez cet email.</p>
        </div>
      `
    });

    res.json({ message: 'Si un compte existe avec cet email, un code a été envoyé.', clientId: client.id });
  } catch (error) {
    console.error('[Extranet Login]', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// 2. Vérifier OTP
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, code } = req.body;
    
    const client = await prisma.client.findFirst({ 
      where: { email: { equals: email, mode: 'insensitive' } } 
    });
    
    if (!client) return res.status(401).json({ message: 'Code invalide ou expiré' });

    const otpRecord = await prisma.clientOtp.findFirst({
      where: { clientId: client.id },
      orderBy: { createdAt: 'desc' }
    });

    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      return res.status(401).json({ message: 'Code invalide ou expiré' });
    }

    if (otpRecord.attempts >= 5) {
      return res.status(429).json({ message: 'Trop de tentatives, demandez un nouveau code.' });
    }

    const isValid = await bcrypt.compare(code, otpRecord.codeHash);
    
    if (!isValid) {
      await prisma.clientOtp.update({
        where: { id: otpRecord.id },
        data: { attempts: otpRecord.attempts + 1 }
      });
      return res.status(401).json({ message: 'Code incorrect' });
    }

    await prisma.clientOtp.deleteMany({ where: { clientId: client.id } });

    const token = jwt.sign(
      { id: client.id, email: client.email, role: 'CLIENT' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, client });

  } catch (error) {
    console.error('[Extranet Verify]', error);
    res.status(500).json({ message: 'Erreur lors de la vérification' });
  }
});

// 3. Obtenir les baux et paiements du client
router.get('/dashboard', verifyExtranetToken, async (req, res) => {
  try {
    const leases = await prisma.lease.findMany({
      where: { clientId: req.clientId, deletedAt: null },
      include: {
        bien: true,
        building: true,
        factures: {
          orderBy: { dateEcheance: 'desc' }
        },
        paiements: {
          orderBy: { datePaiement: 'desc' }
        }
      }
    });

    res.json({ leases });
  } catch (error) {
    console.error('[Extranet Dashboard]', error);
    res.status(500).json({ message: 'Erreur lors de la récupération des données' });
  }
});

export default router;
