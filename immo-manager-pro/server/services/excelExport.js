import ExcelJS from 'exceljs';
import prisma from '../lib/prisma.js';

// ============================================
// Export Excel Multi-Onglets - IMMO MANAGER PRO
// ============================================

export async function generateRapportExcel(filters = {}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'IMMO MANAGER PRO';
  workbook.created = new Date();

  // Couleurs YAMTIKEN BEHEMOTH
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D3B1F' } };
  const headerFont = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  const altRowFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5EC' } };
  const currencyFmt = '#,##0 FCFA';
  const dateFmt = 'dd/mm/yyyy';

  // ============================================
  // ONGLET 1 : Résumé KPIs
  // ============================================
  const sheetResume = workbook.addWorksheet('Résumé', {
    properties: { tabColor: { argb: 'FF0D3B1F' } }
  });

  // KPIs
  const totalClients = await prisma.client.count({ where: { actif: true } });
  const totalBaux = await prisma.lease.count({ where: { statut: 'ACTIF' } });
  const totalPaiements = await prisma.payment.aggregate({ _sum: { montantVerse: true } });
  const totalCommissions = await prisma.commission.aggregate({ _sum: { montant: true } });
  const retardCount = await prisma.lease.count({
    where: {
      statut: 'ACTIF',
      payments: {
        none: { datePaiement: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
      }
    }
  });

  sheetResume.columns = [
    { header: 'Indicateur', key: 'label', width: 35 },
    { header: 'Valeur', key: 'value', width: 25 }
  ];

  const kpis = [
    { label: 'Total Clients Actifs', value: totalClients },
    { label: 'Baux Actifs', value: totalBaux },
    { label: 'Total Encaissé', value: (totalPaiements._sum.montantVerse || 0) / 1 },
    { label: 'Total Commissions', value: (totalCommissions._sum.montant || 0) / 1 },
    { label: 'Baux en Retard', value: retardCount },
    { label: 'Date du Rapport', value: new Date().toLocaleDateString('fr-FR') }
  ];

  // Style header
  sheetResume.getRow(1).eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: 'center' };
  });

  kpis.forEach((kpi, i) => {
    const row = sheetResume.addRow(kpi);
    if (i % 2 === 1) row.eachCell((cell) => { cell.fill = altRowFill; });
    if (typeof kpi.value === 'number' && kpi.label.includes('Total') || kpi.label.includes('Commission')) {
      row.getCell(2).numFmt = currencyFmt;
    }
  });

  // ============================================
  // ONGLET 2 : Paiements Détaillés
  // ============================================
  const sheetPaiements = workbook.addWorksheet('Paiements', {
    properties: { tabColor: { argb: 'FF1A6B35' } }
  });

  const payments = await prisma.payment.findMany({
    where: filters.dateDebut || filters.dateFin ? {
      datePaiement: {
        gte: filters.dateDebut ? new Date(filters.dateDebut) : undefined,
        lte: filters.dateFin ? new Date(filters.dateFin) : undefined
      }
    } : {},
    include: {
      lease: { include: { client: true, unite: true, building: true } }
    },
    orderBy: { datePaiement: 'desc' }
  });

  sheetPaiements.columns = [
    { header: 'N° Facture', key: 'numeroFacture', width: 18 },
    { header: 'Date', key: 'datePaiement', width: 14 },
    { header: 'Client', key: 'client', width: 25 },
    { header: 'Unité', key: 'unite', width: 15 },
    { header: 'Immeuble', key: 'immeuble', width: 20 },
    { header: 'Montant Versé', key: 'montantVerse', width: 18 },
    { header: 'Mode', key: 'modePaiement', width: 15 },
    { header: 'Notes', key: 'notes', width: 30 }
  ];

  // Style header
  sheetPaiements.getRow(1).eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: 'center' };
  });

  payments.forEach((p, i) => {
    const row = sheetPaiements.addRow({
      numeroFacture: p.numeroFacture,
      datePaiement: new Date(p.datePaiement).toLocaleDateString('fr-FR'),
      client: `${p.lease?.client?.prenom} ${p.lease?.client?.nom}`,
      unite: p.lease?.unite?.numeroPorte || '-',
      immeuble: p.lease?.building?.nom || '-',
      montantVerse: p.montantVerse,
      modePaiement: p.modePaiement,
      notes: p.notes || ''
    });
    row.getCell('montantVerse').numFmt = currencyFmt;
    if (i % 2 === 1) row.eachCell((cell) => { cell.fill = altRowFill; });
  });

  // Ligne total
  const totalRow = sheetPaiements.addRow({
    numeroFacture: '',
    datePaiement: '',
    client: '',
    unite: '',
    immeuble: 'TOTAL',
    montantVerse: payments.reduce((s, p) => s + p.montantVerse, 0),
    modePaiement: '',
    notes: ''
  });
  totalRow.getCell('montantVerse').numFmt = currencyFmt;
  totalRow.font = { bold: true, size: 12 };

  // ============================================
  // ONGLET 3 : Clients
  // ============================================
  const sheetClients = workbook.addWorksheet('Clients', {
    properties: { tabColor: { argb: 'FF2D9E57' } }
  });

  const clients = await prisma.client.findMany({
    where: { actif: true },
    include: {
      leases: {
        where: { statut: 'ACTIF' },
        include: { payments: true, unite: true, building: true }
      },
      temoin: true
    },
    orderBy: { nom: 'asc' }
  });

  sheetClients.columns = [
    { header: 'N°', key: 'id', width: 6 },
    { header: 'Nom', key: 'nom', width: 15 },
    { header: 'Prénom', key: 'prenom', width: 15 },
    { header: 'Téléphone', key: 'telephone', width: 18 },
    { header: 'Type', key: 'type', width: 14 },
    { header: 'Unité', key: 'unite', width: 12 },
    { header: 'Immeuble', key: 'immeuble', width: 18 },
    { header: 'Loyer Mensuel', key: 'loyer', width: 16 },
    { header: 'Total Payé', key: 'totalPaye', width: 16 },
    { header: 'Reste Dû', key: 'resteDu', width: 16 },
    { header: 'Apporteur', key: 'apporteur', width: 20 }
  ];

  sheetClients.getRow(1).eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: 'center' };
  });

  clients.forEach((c, i) => {
    const lease = c.leases[0];
    const totalPaye = lease?.payments?.reduce((s, p) => s + p.montantVerse, 0) || 0;
    const resteDu = lease ? lease.montantInitial - totalPaye : 0;

    const row = sheetClients.addRow({
      id: c.id,
      nom: c.nom,
      prenom: c.prenom,
      telephone: c.telephone,
      type: c.type,
      unite: lease?.unite?.numeroPorte || '-',
      immeuble: lease?.building?.nom || '-',
      loyer: lease?.montantInitial || 0,
      totalPaye,
      resteDu,
      apporteur: c.temoin ? `${c.temoin.prenom} ${c.temoin.nom}` : '-'
    });
    row.getCell('loyer').numFmt = currencyFmt;
    row.getCell('totalPaye').numFmt = currencyFmt;
    row.getCell('resteDu').numFmt = currencyFmt;
    if (i % 2 === 1) row.eachCell((cell) => { cell.fill = altRowFill; });
  });

  return workbook;
}
