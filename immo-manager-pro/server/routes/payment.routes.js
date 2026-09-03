import express from 'express';
import prisma from '../lib/prisma.js';
import { verifyToken, canManagePaiements } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validate.js';
import { createPaymentSchema, updatePaymentSchema } from '../validations/schemas.js';
import { audit } from '../middlewares/audit.js';
import { invalidateDashboard } from '../lib/cache.js';
import { clearClientsCache } from '../controllers/client-raw.controller.js';
import { getIO } from '../lib/socket.js';

const router = express.Router();


// Fonction pour générer un numéro de facture unique
const generateNumeroFacture = async () => {
  const year = new Date().getFullYear();
  const count = await prisma.payment.count({
    where: {
      numeroFacture: {
        startsWith: `FAC-${year}-`
      }
    }
  });
  const sequence = String(count + 1).padStart(5, '0');
  return `FAC-${year}-${sequence}`;
};

// GET /api/payments - Liste des paiements (paginée + recherche)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { leaseId, clientId, dateDebut, dateFin, search, page = 1, limit = 100, deletedAt } = req.query;
    const take = Math.min(parseInt(limit) || 100, 500); // Max 500
    const skip = (Math.max(parseInt(page) || 1, 1) - 1) * take;

    const where = {};
    if (deletedAt === 'not.null') {
      where.deletedAt = { not: null };
    } else {
      where.deletedAt = null;
    }
    if (leaseId) {
      const parsed = parseInt(leaseId);
      if (!isNaN(parsed)) where.leaseId = parsed;
    }
    if (dateDebut && dateFin) {
      const start = new Date(dateDebut); start.setHours(0, 0, 0, 0);
      const end   = new Date(dateFin);   end.setHours(23, 59, 59, 999);
      where.datePaiement = { gte: start, lte: end };
    }
    // Recherche par numéro de facture ou nom/téléphone client
    if (search) {
      where.OR = [
        { numeroFacture: { contains: search, mode: 'insensitive' } },
        { lease: { client: { nom:    { contains: search, mode: 'insensitive' } } } },
        { lease: { client: { prenom: { contains: search, mode: 'insensitive' } } } },
        { lease: { client: { telephone: { contains: search } } } },
      ];
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          lease: {
            include: {
              client:   { select: { id: true, nom: true, prenom: true, telephone: true } },
              unite:    { select: { id: true, numeroPorte: true } },
              building: { select: { id: true, nom: true } },
              payments: { select: { montantVerse: true } }
            }
          },
          agent: { select: { prenom: true, nom: true } }
        },
        orderBy: { datePaiement: 'desc' },
        take,
        skip
      }),
      prisma.payment.count({ where })
    ]);

    res.json({ success: true, data: payments, count: total, page: parseInt(page), limit: take });
  } catch (error) {
    console.error('[GET /payments]', error.message);
    res.status(200).json({ success: false, data: [], error: error.message });
  }
});

// GET /api/payments/registre - Registre de caisse avec solde
router.get('/registre/caisse', verifyToken, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const [entrees, sorties, soldeTotal] = await Promise.all([
      // Entrées du jour
      prisma.payment.findMany({
        where: {
          datePaiement: { gte: startOfDay, lte: endOfDay }
        },
        include: {
          lease: {
            include: {
              client: { select: { nom: true, prenom: true } }
            }
          },
          agent: { select: { prenom: true, nom: true } }
        },
        orderBy: { datePaiement: 'desc' }
      }),
      
      // Total entrées
      prisma.payment.aggregate({
        where: {
          datePaiement: { gte: startOfDay, lte: endOfDay }
        },
        _sum: { montantVerse: true }
      }),
      
      // Solde total (tous les paiements)
      prisma.payment.aggregate({
        _sum: { montantVerse: true }
      })
    ]);

    res.json({
      date: targetDate,
      entrees,
      totalJournee: sorties._sum.montantVerse || 0,
      soldeGlobal: soldeTotal._sum.montantVerse || 0,
      nombreTransactions: entrees.length
    });
  } catch (error) {
    console.error('[GET /payments/registre]', error);
    res.status(500).json({ message: 'Erreur lors de la récupération du registre' });
  }
});

// POST /api/payments - Créer un paiement
router.post('/', verifyToken, canManagePaiements, audit('payment', 'CREATE'), async (req, res) => {
  try {
    const data = req.body;
    
    console.log('[POST /payments] Données reçues:', JSON.stringify(data, null, 2));
    
    // Validation manuelle avec logs
    if (!data.leaseId) {
      console.log('[POST /payments] ERREUR: leaseId manquant');
      return res.status(400).json({ message: 'Bail requis' });
    }
    if (!data.montantVerse || parseFloat(data.montantVerse) <= 0) {
      console.log('[POST /payments] ERREUR: montantVerse invalide:', data.montantVerse);
      return res.status(400).json({ message: 'Montant versé requis et doit être positif' });
    }
    
    // Générer un numéro de facture unique
    const numeroFacture = await generateNumeroFacture();
    console.log('[POST /payments] Facture générée:', numeroFacture);
    
    // Préparer les données pour Prisma
    const createData = {
      leaseId: parseInt(data.leaseId),
      agentId: req.user.id,
      montantVerse: parseFloat(data.montantVerse),
      modePaiement: data.modePaiement || 'ESPECES',
      numeroFacture
    };
    
    // Champs optionnels
    if (data.datePaiement) createData.datePaiement = new Date(data.datePaiement);
    if (data.notes) createData.notes = data.notes;
    
    console.log('[POST /payments] Données Prisma:', JSON.stringify(createData, null, 2));

    const payment = await prisma.payment.create({
      data: createData,
      include: {
        lease: {
          include: {
            client: true,
            payments: true
          }
        },
        agent: {
          select: { prenom: true, nom: true }
        }
      }
    });
    
    console.log('[POST /payments] Paiement créé, ID:', payment.id);

    // Calculer les nouveaux totaux
    const totalPaye = payment.lease.payments.reduce((sum, p) => sum + p.montantVerse, 0);
    const resteDu = payment.lease.montantInitial - totalPaye;

    res.status(201).json({ 
      message: 'Paiement enregistré avec succès',
      payment: {
        ...payment,
        calculs: {
          totalPaye,
          resteDu,
          progression: payment.lease.montantInitial > 0 
            ? ((totalPaye / payment.lease.montantInitial) * 100).toFixed(1) 
            : 0
        }
      }
    });

    await req.audit({ recordId: payment.id, newData: payment });
    invalidateDashboard();
    clearClientsCache();
  } catch (error) {
    console.error('[POST /payments] ERREUR COMPLÈTE:', error);
    console.error('[POST /payments] Message:', error.message);
    console.error('[POST /payments] Code:', error.code);
    if (error.meta) console.error('[POST /payments] Meta:', error.meta);
    
    // Erreur spécifique Prisma
    if (error.code === 'P2002') {
      return res.status(400).json({ message: 'Numéro de facture déjà utilisé' });
    }
    if (error.code === 'P2003') {
      return res.status(400).json({ message: 'Bail introuvable' });
    }
    if (error.code === 'P2025') {
      return res.status(400).json({ message: 'Enregistrement non trouvé' });
    }
    
    res.status(500).json({ 
      message: 'Erreur lors de la création du paiement',
      details: error.message,
      code: error.code 
    });
  }
});

// GET /api/payments/:id/facture/pdf - Données pour facture PDF
router.get('/:id/facture/pdf', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const payment = await prisma.payment.findUnique({
      where: { id: parseInt(id) },
      include: {
        lease: {
          include: {
            client:   true,
            unite:    { select: { id: true, numeroPorte: true, typeUnite: true } },
            building: { select: { id: true, nom: true } },
            payments: { orderBy: { datePaiement: 'asc' } }
          }
        },
        agent: { select: { prenom: true, nom: true } }
      }
    });

    if (!payment) {
      return res.status(404).json({ message: 'Paiement non trouvé' });
    }

    // Calculer les totaux
    const totalPaye = payment.lease.payments.reduce((sum, p) => sum + p.montantVerse, 0);
    const montantPrecedent = payment.lease.payments
      .filter(p => p.id !== payment.id && new Date(p.datePaiement) <= new Date(payment.datePaiement))
      .reduce((sum, p) => sum + p.montantVerse, 0);
    const montantInitial = payment.lease.montantInitial || 0;
    const resteDu = Math.max(0, montantInitial - totalPaye);
    const progression = montantInitial > 0 ? parseFloat(((totalPaye / montantInitial) * 100).toFixed(1)) : 0;

    // Formater les données pour le PDF
    const factureData = {
      numeroFacture: payment.numeroFacture,
      datePaiement: payment.datePaiement,
      montantVerse: payment.montantVerse,
      modePaiement: payment.modePaiement,
      agent: payment.agent,
      notes: payment.notes,
      client: {
        nom: `${payment.lease.client.prenom} ${payment.lease.client.nom}`,
        telephone: payment.lease.client.telephone,
        email: payment.lease.client.email || '',
        numeroPiece: payment.lease.client.numeroPiece || ''
      },
      bail: {
        numeroBail: payment.lease.numeroBail,
        uniteId: payment.lease.unite?.id || payment.lease.uniteId,
        numeroPorte: payment.lease.unite?.numeroPorte || '—',
        buildingId: payment.lease.building?.id || payment.lease.buildingId,
        buildingNom: payment.lease.building?.nom || '—',
        montantInitial,
        droitsTerre: payment.lease.droitsTerre || 0,
        chargesAnnexes: payment.lease.chargesAnnexes || 0
      },
      calculs: {
        montantPrecedent,
        totalPaye,
        resteDu,
        progression
      }
    };

    // Sauvegarder la facture générée (upsert pour éviter doublon)
    await prisma.facture.upsert({
      where: { numeroFacture: payment.numeroFacture },
      update: { contenu: JSON.stringify(factureData) },
      create: {
        numeroFacture: payment.numeroFacture,
        leaseId: payment.leaseId,
        clientId: payment.lease.clientId,
        contenu: JSON.stringify(factureData),
        agentId: req.user.id
      }
    });

    res.json({
      message: 'Données de facture récupérées',
      data: factureData
    });
  } catch (error) {
    console.error('[GET /payments/:id/facture]', error);
    res.status(500).json({ message: 'Erreur lors de la génération de la facture' });
  }
});

// GET /api/payments/rapport/pdf - Rapport global de tous les paiements échelonnés
router.get('/rapport/pdf', verifyToken, async (req, res) => {
  try {
    const PDFDocument = (await import('pdfkit')).default;

    // Récupérer tous les baux avec leurs paiements
    const leases = await prisma.lease.findMany({
      include: {
        client: { select: { id: true, prenom: true, nom: true, telephone: true } },
        payments: { orderBy: { datePaiement: 'asc' } },
        unite: { select: { numeroPorte: true, typeUnite: true } },
        building: { select: { nom: true } }
      },
      orderBy: { dateDebut: 'desc' }
    });

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const fileName = `rapport_paiements_${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    doc.pipe(res);

    const GREEN  = '#1A6B35'; const GOLD = '#C8960C';
    const DARK   = '#0D3B1F'; const GRAY = '#6B7280';
    const LGRAY  = '#E8F5EC'; const RED  = '#DC2626';
    const W = doc.page.width;

    // ── BANDEAU HEADER ──
    doc.rect(0, 0, W, 80).fill(GREEN);
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold')
       .text('YAMTIKEN BEHEMOTH', 40, 18);
    doc.fontSize(11).font('Helvetica')
       .text('RAPPORT GLOBAL — PAIEMENTS ÉCHELONNÉS', 40, 40);
    doc.fontSize(9).fillColor(LGRAY)
       .text(`Généré le ${new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}`, 40, 56);

    // Résumé chiffres à droite
    const totalLeases   = leases.length;
    const soldes        = leases.filter(l => { const tp = l.payments.reduce((s,p)=>s+(p.montantVerse||0),0); return tp >= (l.montantInitial||0) && l.montantInitial > 0; }).length;
    const enCours       = leases.filter(l => { const tp = l.payments.reduce((s,p)=>s+(p.montantVerse||0),0); return tp > 0 && tp < (l.montantInitial||0); }).length;
    const sansPaiement  = leases.filter(l => l.payments.length === 0).length;

    doc.fillColor(GOLD).fontSize(11).font('Helvetica-Bold')
       .text(`${totalLeases} baux`, 380, 18)
       .fontSize(8).fillColor('white').font('Helvetica')
       .text(`✅ Soldés: ${soldes}  🔵 En cours: ${enCours}  🔴 Sans paiement: ${sansPaiement}`, 350, 34, { width: 175 });

    let y = 95;

    // ── LÉGENDE ──
    doc.rect(40, y, W - 80, 20).fill('#F9FAFB');
    doc.fillColor(GREEN).fontSize(8).font('Helvetica-Bold')
       .text('🟢 SOLDÉ', 50, y + 6)
       .fillColor('#2563EB').text('🔵 EN COURS', 130, y + 6)
       .fillColor(RED).text('🔴 SANS PAIEMENT', 230, y + 6)
       .fillColor('#D97706').text('🟡 PARTIEL ARRÊTÉ', 370, y + 6);
    y += 28;

    // ── En-têtes colonnes ──
    const cols = [40, 160, 280, 360, 440, 490];
    const headers = ['Client', 'Bien / Bail', 'Montant initial', 'Total payé', 'Reste dû', 'Statut'];
    doc.rect(40, y, W - 80, 18).fill(DARK);
    headers.forEach((h, i) => {
      doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
         .text(h, cols[i] + 3, y + 5, { width: (cols[i+1] || W - 40) - cols[i] - 6 });
    });
    y += 18;

    // ── LIGNES ──
    leases.forEach((lease, idx) => {
      if (y > 760) { doc.addPage(); y = 40; }

      const montantInit  = lease.montantInitial || 0;
      const totalPaye    = lease.payments.reduce((s, p) => s + (p.montantVerse || 0), 0);
      const resteDu      = Math.max(0, montantInit - totalPaye);
      const progression  = montantInit > 0 ? Math.min(100, Math.round((totalPaye / montantInit) * 100)) : 0;
      const dernierPaiement = lease.payments.length > 0
        ? new Date(lease.payments[lease.payments.length - 1].datePaiement).toLocaleDateString('fr-FR')
        : null;

      let status, statusColor, rowBg;
      if (montantInit === 0)              { status = 'N/D';          statusColor = GRAY;    rowBg = '#FAFAFA'; }
      else if (progression >= 100)        { status = `SOLDÉ`;        statusColor = GREEN;   rowBg = '#F0FDF4'; }
      else if (totalPaye === 0)           { status = 'AUCUN PAIEMENT'; statusColor = RED;   rowBg = '#FEF2F2'; }
      else                                { status = `${progression}%`; statusColor = '#2563EB'; rowBg = '#EFF6FF'; }

      const rowH = dernierPaiement ? 30 : 22;
      doc.rect(40, y, W - 80, rowH).fill(rowBg);
      // Séparateur bas
      doc.moveTo(40, y + rowH).lineTo(W - 40, y + rowH).strokeColor(LGRAY).lineWidth(0.5).stroke();

      const fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' F';

      doc.fillColor(DARK).fontSize(8).font('Helvetica-Bold')
         .text(`${lease.client?.prenom || ''} ${lease.client?.nom || ''}`, cols[0] + 3, y + 5, { width: 115 });
      doc.fillColor(GRAY).fontSize(7).font('Helvetica')
         .text(lease.client?.telephone || '', cols[0] + 3, y + 16, { width: 115 });

      doc.fillColor(DARK).fontSize(8).font('Helvetica')
         .text(`${lease.unite?.numeroPorte || lease.numeroBail || `#${lease.id}`}`, cols[1] + 3, y + 5, { width: 115 });
      if (dernierPaiement) {
        doc.fillColor(GRAY).fontSize(7)
           .text(`Dernier: ${dernierPaiement}`, cols[1] + 3, y + 16, { width: 115 });
      }

      doc.fillColor(DARK).fontSize(8).font('Helvetica-Bold')
         .text(fmt(montantInit), cols[2] + 3, y + 10, { width: 75 });

      doc.fillColor(GREEN).fontSize(8).font('Helvetica-Bold')
         .text(fmt(totalPaye), cols[3] + 3, y + 10, { width: 75 });

      doc.fillColor(resteDu > 0 ? RED : GREEN).fontSize(8).font('Helvetica-Bold')
         .text(fmt(resteDu), cols[4] + 3, y + 10, { width: 45 });

      // Badge statut
      doc.fillColor(statusColor).fontSize(7.5).font('Helvetica-Bold')
         .text(status, cols[5] + 3, y + 5, { width: 60 });

      // Mini barre de progression
      if (montantInit > 0) {
        doc.rect(cols[5] + 3, y + 16, 52, 5).fillAndStroke(LGRAY, LGRAY);
        if (progression > 0) {
          doc.rect(cols[5] + 3, y + 16, Math.round(52 * progression / 100), 5).fill(statusColor);
        }
      }

      y += rowH + 1;
    });

    // ── RÉSUMÉ TOTAL ──
    if (y > 740) { doc.addPage(); y = 40; }
    y += 10;
    doc.rect(40, y, W - 80, 28).fill(DARK);
    const totalGlobalPaye = leases.reduce((s, l) => s + l.payments.reduce((ss, p) => ss + (p.montantVerse || 0), 0), 0);
    const totalGlobalInit = leases.reduce((s, l) => s + (l.montantInitial || 0), 0);
    const totalGlobalReste = Math.max(0, totalGlobalInit - totalGlobalPaye);
    const fmt2 = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' FCFA';
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
       .text('TOTAL GÉNÉRAL', cols[0] + 3, y + 8)
       .fillColor(LGRAY)
       .text(fmt2(totalGlobalInit), cols[2] + 3, y + 8)
       .fillColor(GOLD)
       .text(fmt2(totalGlobalPaye), cols[3] + 3, y + 8)
       .fillColor(RED)
       .text(fmt2(totalGlobalReste), cols[4] + 3, y + 8);
    y += 38;

    // ── FOOTER ──
    const pB = doc.page.height - 30;
    doc.rect(0, pB, W, 30).fill(GREEN);
    doc.fillColor('white').fontSize(8).font('Helvetica-Oblique')
       .text('YAMTIKEN BEHEMOTH — Document confidentiel — Rapport généré automatiquement', 40, pB + 10, { align: 'center', width: W - 80 });

    doc.end();
  } catch (error) {
    console.error('[GET /payments/rapport/pdf]', error);
    if (!res.headersSent) res.status(500).json({ message: 'Erreur génération rapport' });
  }
});

// PUT /api/payments/:id - Modifier un paiement
router.put('/:id', verifyToken, canManagePaiements, validateBody(updatePaymentSchema), audit('payment', 'UPDATE'), async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const oldPayment = await prisma.payment.findUnique({ where: { id: parseInt(id) } });

    const payment = await prisma.payment.update({
      where: { id: parseInt(id) },
      data,
      include: {
        lease: {
          include: {
            client: true,
            payments: true
          }
        }
      }
    });

    await req.audit({ recordId: payment.id, oldData: oldPayment, newData: payment });
    invalidateDashboard();

    res.json({
      message: 'Paiement modifié avec succès',
      payment
    });
  } catch (error) {
    console.error('[PUT /payments/:id]', error);
    res.status(500).json({ message: 'Erreur lors de la modification du paiement' });
  }
});

// PATCH /api/payments/:id (Restauration ou archivage)
router.patch('/:id', verifyToken, canManagePaiements, async (req, res) => {
  try {
    const { id } = req.params;
    const { deletedAt } = req.body;
    const payment = await prisma.payment.update({
      where: { id: parseInt(id) },
      data: { deletedAt: deletedAt === null ? null : new Date() }
    });
    invalidateDashboard();
    res.json({ message: deletedAt === null ? 'Paiement restauré avec succès' : 'Paiement placé dans la corbeille', payment });
  } catch (error) {
    console.error('[PATCH /payments/:id]', error);
    res.status(500).json({ message: 'Erreur lors de la mise à jour du paiement' });
  }
});

// DELETE /api/payments/:id
router.delete('/:id', verifyToken, canManagePaiements, audit('payment', 'DELETE'), async (req, res) => {
  try {
    const { id } = req.params;
    const { force } = req.query;
    const oldPayment = await prisma.payment.findUnique({ where: { id: parseInt(id) } });

    if (force === 'true') {
      await prisma.payment.delete({ where: { id: parseInt(id) } });
    } else {
      await prisma.payment.update({ where: { id: parseInt(id) }, data: { deletedAt: new Date() } });
    }

    await req.audit({ recordId: parseInt(id), oldData: oldPayment });
    invalidateDashboard();

    res.json({ message: force === 'true' ? 'Paiement supprimé définitivement' : 'Paiement placé dans la corbeille' });
  } catch (error) {
    console.error('[DELETE /payments/:id]', error);
    res.status(500).json({ message: 'Erreur lors de la suppression' });
  }
});

export default router;
