// [NOTE]: Fichier legacy - Les PDFs serveur sont générés via pdfkit (ex: payment.routes.js).
// jsPDF et jspdf-autotable sont des bibliothèques client.
// import { jsPDF } from 'jspdf';
// import 'jspdf-autotable';

// Générer un reçu de paiement PDF
export const generateReceiptPDF = (paiementData) => {
  const doc = new jsPDF();
  const { paiement, contrat, locataire, bien, creePar } = paiementData;

  // Header
  doc.setFontSize(20);
  doc.setTextColor(13, 59, 31); // darkGreen
  doc.text('YAMTIKEN BEHEMOTH', 105, 20, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setTextColor(200, 150, 12); // gold
  doc.text('REÇU DE PAIEMENT', 105, 30, { align: 'center' });

  // Ligne de séparation
  doc.setDrawColor(13, 59, 31);
  doc.line(20, 35, 190, 35);

  // Informations du reçu
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  
  let y = 45;
  doc.text(`Référence: ${paiement.reference}`, 20, y);
  doc.text(`Date: ${new Date(paiement.datePaiement).toLocaleDateString('fr-FR')}`, 140, y);
  
  y += 15;
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.text('LOCATAIRE', 20, y);
  doc.setFont(undefined, 'normal');
  y += 7;
  doc.text(`${locataire.prenom} ${locataire.nom}`, 20, y);
  doc.text(`Tél: ${locataire.telephone || 'N/A'}`, 20, y + 5);

  y += 20;
  doc.setFont(undefined, 'bold');
  doc.text('BIEN LOUÉ', 20, y);
  doc.setFont(undefined, 'normal');
  y += 7;
  doc.text(`${bien.titre}`, 20, y);
  doc.text(`${bien.adresse}`, 20, y + 5);

  y += 20;
  doc.setFont(undefined, 'bold');
  doc.text('DÉTAILS DU PAIEMENT', 20, y);
  doc.setFont(undefined, 'normal');
  y += 10;

  // Table des détails
  const tableData = [
    ['Montant payé:', `${paiement.montant.toLocaleString('fr-FR')} FCFA`],
    ['Mode de paiement:', paiement.modePaiement],
    ['Période:', paiement.periodeDebut && paiement.periodeFin ? 
      `Du ${new Date(paiement.periodeDebut).toLocaleDateString('fr-FR')} au ${new Date(paiement.periodeFin).toLocaleDateString('fr-FR')}` : 
      'Non spécifiée'],
    ['Référence transaction:', paiement.referenceTransaction || 'N/A']
  ];

  doc.autoTable({
    startY: y,
    head: [],
    body: tableData,
    theme: 'plain',
    styles: { fontSize: 11 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 60 },
      1: { cellWidth: 'auto' }
    }
  });

  // Montant total en évidence
  const finalY = doc.lastAutoTable.finalY + 15;
  doc.setFillColor(232, 245, 236); // paleGreen
  doc.rect(20, finalY - 5, 170, 12, 'F');
  doc.setFontSize(12);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(13, 59, 31);
  doc.text(`TOTAL PAYÉ: ${paiement.montant.toLocaleString('fr-FR')} FCFA`, 105, finalY + 2, { align: 'center' });

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text('IMMO MANAGER PRO - Système de gestion immobilière', 105, 280, { align: 'center' });
  doc.text(`Reçu généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 105, 285, { align: 'center' });

  return doc;
};

// Générer un contrat PDF
export const generateContratPDF = (contratData) => {
  const doc = new jsPDF();
  const { contrat, bien, locataire, proprietaire } = contratData;

  // Header
  doc.setFontSize(18);
  doc.setTextColor(13, 59, 31);
  doc.text('YAMTIKEN BEHEMOTH', 105, 20, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setTextColor(200, 150, 12);
  doc.text(`CONTRAT DE ${contrat.type}`, 105, 30, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Référence: ${contrat.reference}`, 105, 36, { align: 'center' });

  doc.setDrawColor(13, 59, 31);
  doc.line(20, 40, 190, 40);

  let y = 50;

  // Parties
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'bold');
  doc.text('ENTRE LES SOUSSIGNÉS:', 20, y);
  doc.setFont(undefined, 'normal');
  
  y += 10;
  doc.text(`LE PROPRIÉTAIRE: ${proprietaire.prenom} ${proprietaire.nom}`, 20, y);
  y += 5;
  doc.text(`Téléphone: ${proprietaire.telephone || 'N/A'}`, 20, y);
  y += 5;
  doc.text(`CNI: ${proprietaire.cni || 'N/A'}`, 20, y);
  
  y += 10;
  doc.text(`ET`, 20, y);
  
  y += 10;
  doc.text(`LE ${contrat.type === 'LOCATION' ? 'LOCATAIRE' : 'ACQUÉREUR'}: ${locataire.prenom} ${locataire.nom}`, 20, y);
  y += 5;
  doc.text(`Téléphone: ${locataire.telephone || 'N/A'}`, 20, y);
  y += 5;
  doc.text(`CNI: ${locataire.cni || 'N/A'}`, 20, y);

  // Objet du contrat
  y += 15;
  doc.setFont(undefined, 'bold');
  doc.text('OBJET DU CONTRAT:', 20, y);
  doc.setFont(undefined, 'normal');
  y += 7;
  doc.text(`Le présent contrat concerne le bien suivant:`, 20, y);
  y += 5;
  doc.text(`${bien.titre}`, 20, y);
  y += 5;
  doc.text(`Adresse: ${bien.adresse}, ${bien.ville}`, 20, y);
  y += 5;
  doc.text(`Type: ${bien.type} - Surface: ${bien.surface || 'N/A'} m²`, 20, y);

  // Conditions financières
  y += 15;
  doc.setFont(undefined, 'bold');
  doc.text('CONDITIONS FINANCIÈRES:', 20, y);
  doc.setFont(undefined, 'normal');
  y += 7;
  
  if (contrat.type === 'LOCATION') {
    doc.text(`Montant du loyer mensuel: ${contrat.montantLoyer?.toLocaleString('fr-FR') || 'N/A'} FCFA`, 20, y);
    y += 5;
    doc.text(`Caution: ${bien.caution?.toLocaleString('fr-FR') || 'N/A'} FCFA`, 20, y);
  } else {
    doc.text(`Prix de vente: ${contrat.montantVente?.toLocaleString('fr-FR') || 'N/A'} FCFA`, 20, y);
  }

  // Durée
  y += 15;
  doc.setFont(undefined, 'bold');
  doc.text('DURÉE:', 20, y);
  doc.setFont(undefined, 'normal');
  y += 7;
  doc.text(`Date de début: ${new Date(contrat.dateDebut).toLocaleDateString('fr-FR')}`, 20, y);
  if (contrat.dateFin) {
    y += 5;
    doc.text(`Date de fin: ${new Date(contrat.dateFin).toLocaleDateString('fr-FR')}`, 20, y);
  }

  // Signatures
  y = 240;
  doc.setFont(undefined, 'bold');
  doc.text('SIGNATURES:', 20, y);
  y += 20;
  
  doc.setFont(undefined, 'normal');
  doc.text(`Le Propriétaire: _______________________`, 20, y);
  doc.text(`Le ${contrat.type === 'LOCATION' ? 'Locataire' : 'Acquéreur'}: _______________________`, 110, y);
  
  y += 15;
  doc.text(`Date: ${new Date(contrat.dateSignature).toLocaleDateString('fr-FR')}`, 20, y);

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Document généré par IMMO MANAGER PRO - YAMTIKEN BEHEMOTH', 105, 285, { align: 'center' });

  return doc;
};

export default {
  generateReceiptPDF,
  generateContratPDF
};
