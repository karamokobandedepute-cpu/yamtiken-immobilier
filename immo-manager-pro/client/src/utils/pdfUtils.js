import jsPDF from 'jspdf'
import { formatCurrency, formatDate, formatDateTime, formatPhone } from './formatters'
import logoSrc from '../assets/logo/logo behemoth.png'

// ============================================
// YAMTIKEN BEHEMOTH - INFORMATIONS OFFICIELLES
// ============================================
export const COMPANY_INFO = {
  name: 'YAMTIKEN BEHEMOTH',
  slogan: 'UNE TRANSPARENCE TOTALE POUR VOTRE ACQUISITION',
  activity: 'IMMO MANAGER PRO',
  location: 'Abidjan, Côte d\'Ivoire',
  phones: ['+225 07 59 11 37 22', '+225 07 22 56 87 91'],
  mention: 'LOCATIONS DE GROS PROJET',
  callToAction: 'OFFRE LIMITÉE - CONTACTEZ-NOUS AUJOURD\'HUI',
  qrText: 'SCANNEZ POUR RÉSERVER',
  process: 'Visite → Réservation → Livraison'
}

// Structure des offres et tarifications
export const OFFRE_STRUCTURE = {
  moduleSociale: {
    title: 'MODULE SOCIALE (GROS ŒUVRE)',
    description: 'Coûts d\'acquisition initiaux',
    items: [
      { designation: 'Studio', montant: 2500000, frais: 350000, travaux: ['Porte principale, niche', 'Canalisation', 'Fosse septique', 'Crépissage extérieur', 'Carrelage des escaliers', 'Embellissement du bâtiment entier'] },
      { designation: 'Chambre salon', montant: 3500000, frais: 500000, travaux: ['Porte principale, niche', 'Canalisation', 'Fosse septique', 'Crépissage extérieur', 'Carrelage des escaliers', 'Embellissement du bâtiment entier'] },
      { designation: '2 chambres salon', montant: 7000000, frais: 1000000, travaux: ['Porte principale, niche', 'Canalisation', 'Fosse septique', 'Crépissage extérieur', 'Carrelage des escaliers', 'Embellissement du bâtiment entier'] },
      { designation: 'Magasin', montant: 4000000, frais: 300000, travaux: ['Porte principale, niche', 'Canalisation', 'Fosse septique', 'Crépissage extérieur', 'Carrelage des escaliers', 'Embellissement du bâtiment entier'] }
    ]
  },
  droitTerre: {
    title: 'DROIT DE TERRE APRÈS CONSTRUCTION',
    description: 'Montants récurrents ou finaux liés au terrain',
    items: [
      { designation: 'Studio', montant: 15000 },
      { designation: 'Chambre salon', montant: 20000 },
      { designation: '2 chambres salon', montant: 40000 },
      { designation: 'Magasin', montant: 20000 }
    ]
  }
}

// Logo YAMTIKEN BEHEMOTH (importé via Vite — résolu en base64 au build)
const LOGO_SRC = logoSrc

// Couleurs YAMTIKEN BEHEMOTH
export const COLORS = {
  darkGreen: '#0D3B1F',
  midGreen: '#1A6B35',
  lightGreen: '#2D9E57',
  gold: '#C8960C',
  lightBg: '#E8F5EC',
  white: '#FFFFFF',
  black: '#0A2412',
  red: '#DC2626',
  orange: '#F59E0B',
  success: '#10B981'
}

/**
 * Ajoute un filigrane subtil avec le logo sur la page courante
 * @param {jsPDF} doc - Instance jsPDF
 */
export const addWatermark = (doc) => {
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  // Sauvegarde GState pour opacité (jsPDF 2.x)
  try {
    // Dessine un rectangle blanc très légèrement teinté vert au centre
    doc.saveGraphicsState()
    doc.setGState(new doc.GState({ opacity: 0.04 }))
    doc.setFillColor(COLORS.darkGreen)
    doc.rect(0, 0, pw, ph, 'F')
    // Logo agrandi centré
    doc.addImage(LOGO_SRC, 'PNG', pw / 2 - 35, ph / 2 - 35, 70, 70)
    doc.restoreGraphicsState()
  } catch (e) {
    // Fallback : texte filigrane si image échoue
    try {
      doc.saveGraphicsState()
      doc.setGState(new doc.GState({ opacity: 0.05 }))
      doc.setTextColor(COLORS.darkGreen)
      doc.setFontSize(52)
      doc.setFont('helvetica', 'bold')
      doc.text('YAMTIKEN', pw / 2, ph / 2, { align: 'center', angle: 35 })
      doc.restoreGraphicsState()
    } catch (_) { /* silencieux */ }
  }
}

/**
 * Ajoute les métadonnées d'impression (date, heure, utilisateur)
 * @param {jsPDF} doc - Instance jsPDF
 * @param {Object} user - Objet utilisateur {prenom, nom, role}
 * @param {number} yPosition - Position Y (défaut: en haut à droite)
 */
export const addPrintMetadata = (doc, user = null, yPosition = 8) => {
  const pw = doc.internal.pageSize.getWidth()
  const now = new Date()
  
  // Format date et heure
  const dateStr = now.toLocaleDateString('fr-FR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  })
  const timeStr = now.toLocaleTimeString('fr-FR', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  })
  
  // Informations d'impression
  doc.setFontSize(7)
  doc.setTextColor(COLORS.darkGreen)
  doc.setFont('helvetica', 'normal')
  
  const printInfo = [
    `Imprimé le: ${dateStr} à ${timeStr}`,
    user ? `Par: ${user.prenom} ${user.nom}` : 'Par: Système',
    user?.role ? `Rôle: ${user.role}` : ''
  ].filter(Boolean)
  
  // Afficher en haut à droite
  let y = yPosition
  printInfo.forEach(info => {
    doc.text(info, pw - 10, y, { align: 'right' })
    y += 3
  })
  
  // Ligne de séparation
  doc.setDrawColor(COLORS.lightGreen)
  doc.setLineWidth(0.2)
  doc.line(pw - 60, y + 1, pw - 10, y + 1)
}

/**
 * Ajoute l'en-tête standard YAMTIKEN BEHEMOTH au PDF
 * @param {jsPDF} doc - Instance jsPDF
 * @param {string} subtitle - Sous-titre du document
 * @param {string} complement - Texte complémentaire (optionnel)
 * @param {Object} user - Utilisateur pour métadonnées (optionnel)
 */
export const addPdfHeader = (doc, subtitle, complement = '', user = null) => {
  const pw = doc.internal.pageSize.getWidth()
  
  // Fond vert foncé
  doc.setFillColor(COLORS.darkGreen)
  doc.rect(0, 0, pw, 34, 'F')

  // Bande dorée fine en bas du header
  doc.setFillColor(COLORS.gold)
  doc.rect(0, 32, pw, 2, 'F')
  
  // ── Logo à gauche ──
  try {
    doc.addImage(LOGO_SRC, 'PNG', 6, 4, 26, 26)
  } catch (e) {
    // Placeholder cercle avec initiales
    doc.setFillColor(COLORS.gold)
    doc.circle(19, 17, 11, 'F')
    doc.setTextColor(COLORS.darkGreen)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('YB', 19, 19, { align: 'center' })
  }

  // ── Titre et sous-titre centrés (décalés pour ne pas chevaucher le logo) ──
  doc.setTextColor(COLORS.white)
  doc.setFontSize(17)
  doc.setFont('helvetica', 'bold')
  doc.text('YAMTIKEN BEHEMOTH', pw / 2 + 10, 12, { align: 'center' })
  
  doc.setFontSize(10)
  doc.setTextColor(COLORS.gold)
  doc.setFont('helvetica', 'bold')
  doc.text(subtitle.toUpperCase(), pw / 2 + 10, 19, { align: 'center' })
  
  if (complement) {
    doc.setFontSize(8)
    doc.setTextColor(COLORS.white)
    doc.setFont('helvetica', 'normal')
    doc.text(complement, pw / 2 + 10, 26, { align: 'center' })
  }
  
  // Numéro de page et date d'impression
  if (user) {
    const now = new Date()
    const printDate = now.toLocaleDateString('fr-FR') + ' ' + now.toLocaleTimeString('fr-FR')
    doc.setTextColor(COLORS.white)
    doc.setFontSize(8)
    doc.text(`Page 1`, pw / 2, 30, { align: 'center' })
    doc.text(`Imprimé: ${printDate}`, 10, 30)
  }
  
  // Ajouter les métadonnées d'impression
  if (user) {
    addPrintMetadata(doc, user, 8)
  }
}

/**
 * Ajoute le pied de page standard YAMTIKEN BEHEMOTH
 * @param {jsPDF} doc - Instance jsPDF
 * @param {number} pageNumber - Numéro de page (optionnel)
 * @param {boolean} showContact - Afficher les informations de contact (défaut: true)
 * @param {Object} user - Utilisateur pour métadonnées (optionnel)
 */
export const addPdfFooter = (doc, pageNumber = null, showContact = true, user = null) => {
  const pw = doc.internal.pageSize.getWidth()
  const ph = doc.internal.pageSize.getHeight()
  
  // Zone de pied de page plus grande si contact affiché
  const footerHeight = showContact ? 35 : 15
  
  doc.setFillColor(COLORS.darkGreen)
  doc.rect(0, ph - footerHeight, pw, footerHeight, 'F')
  
  if (showContact) {
    // Section contact
    doc.setTextColor(COLORS.gold)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text(COMPANY_INFO.slogan, pw / 2, ph - 28, { align: 'center' })
    
    // Téléphones
    doc.setTextColor(COLORS.white)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    const phones = COMPANY_INFO.phones.join('  |  ')
    doc.text(phones, pw / 2, ph - 20, { align: 'center' })
    
    // Mention et CTA
    doc.setFontSize(7)
    doc.setTextColor(COLORS.gold)
    doc.text(COMPANY_INFO.mention + '  |  ' + COMPANY_INFO.callToAction, pw / 2, ph - 14, { align: 'center' })
    
    // Ligne de séparation
    doc.setDrawColor(COLORS.gold)
    doc.setLineWidth(0.3)
    doc.line(20, ph - 10, pw - 20, ph - 10)
    
    // Date et génération
    doc.setTextColor(COLORS.white)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'italic')
    doc.text(`${COMPANY_INFO.name} - ${COMPANY_INFO.activity} | Généré le ${new Date().toLocaleDateString('fr-FR')}`, pw / 2, ph - 6, { align: 'center' })
  } else {
    // Pied de page simple
    doc.setTextColor(COLORS.white)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.text(`${COMPANY_INFO.name} - ${COMPANY_INFO.activity}`, pw / 2, ph - 8, { align: 'center' })
    doc.text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, pw / 2, ph - 4, { align: 'center' })
  }
  
  if (pageNumber) {
    doc.text(`Page ${pageNumber}`, pw - 10, ph - 6, { align: 'right' })
  }
  
  // Date et heure d'impression en bas à gauche
  if (user) {
    const now = new Date()
    const printDate = now.toLocaleDateString('fr-FR') + ' ' + now.toLocaleTimeString('fr-FR')
    doc.setTextColor(COLORS.white)
    doc.setFontSize(6)
    doc.text(`Imprimé: ${printDate} par ${user.prenom} ${user.nom}`, 10, ph - 3)
  }
}

/**
 * Ajoute une section avec titre
 * @param {jsPDF} doc - Instance jsPDF
 * @param {string} title - Titre de la section
 * @param {number} y - Position Y
 * @returns {number} - Nouvelle position Y
 */
export const addSectionTitle = (doc, title, y) => {
  const pw = doc.internal.pageSize.getWidth()
  
  doc.setTextColor(COLORS.darkGreen)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(title.toUpperCase(), 15, y)
  
  doc.setDrawColor(COLORS.gold)
  doc.setLineWidth(0.5)
  doc.line(15, y + 2, pw - 15, y + 2)
  
  return y + 8
}

/**
 * Ajoute un tableau simple
 * @param {jsPDF} doc - Instance jsPDF
 * @param {Array} headers - En-têtes ['col1', 'col2']
 * @param {Array} data - Données [['val1', 'val2'], ...]
 * @param {number} y - Position Y de départ
 * @param {Array} colWidths - Largeurs des colonnes
 * @returns {number} - Nouvelle position Y
 */
export const addTable = (doc, headers, data, y, colWidths = []) => {
  const pw = doc.internal.pageSize.getWidth()
  const startX = 15
  const rowHeight = 7
  const headerHeight = 8
  
  // Calcul des largeurs par défaut
  const totalWidth = pw - 30
  const defaultWidth = totalWidth / headers.length
  const widths = colWidths.length ? colWidths : headers.map(() => defaultWidth)
  
  // En-têtes
  doc.setFillColor(COLORS.lightGreen)
  doc.rect(startX, y - 4, totalWidth, headerHeight, 'F')
  
  doc.setTextColor(COLORS.darkGreen)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  
  let x = startX + 5
  headers.forEach((header, i) => {
    doc.text(header, x, y + 1)
    x += widths[i]
  })
  
  y += headerHeight
  
  // Données
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(COLORS.black)
  
  data.forEach((row, rowIndex) => {
    // Alternance de couleurs
    if (rowIndex % 2 === 0) {
      doc.setFillColor('#F9FAFB')
      doc.rect(startX, y - 4, totalWidth, rowHeight, 'F')
    }
    
    x = startX + 5
    row.forEach((cell, i) => {
      doc.text(String(cell || '-'), x, y)
      x += widths[i]
    })
    
    y += rowHeight
  })
  
  return y
}

/**
 * Ajoute une carte info (label + valeur)
 * @param {jsPDF} doc - Instance jsPDF
 * @param {string} label - Label
 * @param {string} value - Valeur
 * @param {number} x - Position X
 * @param {number} y - Position Y
 * @param {number} width - Largeur
 */
export const addInfoCard = (doc, label, value, x, y, width = 60) => {
  doc.setFillColor(COLORS.lightBg)
  doc.rect(x, y - 4, width, 12, 'F')
  
  doc.setFontSize(8)
  doc.setTextColor('#6B7280')
  doc.setFont('helvetica', 'normal')
  doc.text(label, x + 3, y)
  
  doc.setFontSize(10)
  doc.setTextColor(COLORS.darkGreen)
  doc.setFont('helvetica', 'bold')
  doc.text(String(value), x + 3, y + 5)
}

/**
 * Vérifie si on doit ajouter une nouvelle page
 * @param {jsPDF} doc - Instance jsPDF
 * @param {number} y - Position Y actuelle
 * @param {number} margin - Marge basse (défaut: 30)
 * @returns {number} - Position Y (nouvelle page si nécessaire)
 */
export const checkPageBreak = (doc, y, margin = 30) => {
  const ph = doc.internal.pageSize.getHeight()
  if (y > ph - margin) {
    doc.addPage()
    return 30
  }
  return y
}

/**
 * Génère un PDF de liste (pour exports groupés)
 * @param {string} title - Titre du document
 * @param {string} subtitle - Sous-titre
 * @param {Array} headers - En-têtes du tableau
 * @param {Array} data - Données à afficher
 * @param {Array} colWidths - Largeurs des colonnes
 * @param {string} filename - Nom du fichier
 */
export const generateListPDF = (title, subtitle, headers, data, colWidths, filename) => {
  const doc = new jsPDF('p', 'mm', 'a4')
  let y = 40
  
  addWatermark(doc)
  addPdfHeader(doc, title, subtitle)
  
  if (data.length === 0) {
    doc.setFontSize(12)
    doc.setTextColor('#9CA3AF')
    doc.text('Aucune donnée à afficher', doc.internal.pageSize.getWidth() / 2, y + 20, { align: 'center' })
  } else {
    // Ajouter les lignes par pages
    let currentData = []
    data.forEach((row, index) => {
      currentData.push(row)
      
      // Si on atteint la limite de page ou la fin des données
      if (y > 250 || index === data.length - 1) {
        y = addTable(doc, headers, currentData, y, colWidths)
        
        if (index < data.length - 1) {
          doc.addPage()
          y = 30
          currentData = []
        }
      }
    })
    
    // Total
    y += 10
    doc.setFillColor(COLORS.gold)
    doc.setTextColor(COLORS.darkGreen)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(`Total: ${data.length} enregistrement(s)`, 15, y)
  }
  
  addPdfFooter(doc)
  doc.save(filename)
}

/**
 * Génère un PDF fiche détaillée
 * @param {string} title - Titre
 * @param {string} subtitle - Sous-titre
 * @param {Array} sections - Sections [{ title, data: [{label, value}] }]
 * @param {string} filename - Nom du fichier
 */
export const generateDetailPDF = (title, subtitle, sections, filename) => {
  const doc = new jsPDF('p', 'mm', 'a4')
  let y = 40
  
  addWatermark(doc)
  addPdfHeader(doc, title, subtitle)
  
  sections.forEach((section, index) => {
    if (index > 0) y += 5
    y = checkPageBreak(doc, y)
    y = addSectionTitle(doc, section.title, y)
    
    if (section.data) {
      section.data.forEach(item => {
        y = checkPageBreak(doc, y)
        
        doc.setFontSize(9)
        doc.setTextColor('#6B7280')
        doc.setFont('helvetica', 'normal')
        doc.text(item.label, 20, y)
        
        doc.setFontSize(10)
        doc.setTextColor(COLORS.black)
        doc.setFont('helvetica', 'bold')
        doc.text(String(item.value || '-'), 20, y + 5)
        
        y += 10
      })
    }
    
    if (section.table) {
      y = addTable(doc, section.table.headers, section.table.data, y, section.table.widths)
    }
  })
  
  addPdfFooter(doc)
  doc.save(filename)
}

// ============================================
// FICHES D'OFFRE PAR DÉFAUT YAMTIKEN BEHEMOTH
// ============================================

/**
 * Génère une fiche offre commerciale complète
 * @param {string} type - Type de fiche: 'moduleSociale', 'droitTerre', 'complet'
 * @param {string} filename - Nom du fichier
 */
export const generateOffrePDF = (type = 'complet', filename = null) => {
  const doc = new jsPDF('p', 'mm', 'a4')
  let y = 40

  addWatermark(doc)

  const titles = {
    moduleSociale: 'STRUCTURE DE L\'OFFRE - MODULE SOCIALE',
    droitTerre: 'STRUCTURE DE L\'OFFRE - DROIT DE TERRE',
    complet: 'STRUCTURE COMPLÈTE DE L\'OFFRE ET TARIFICATION'
  }

  addPdfHeader(doc, titles[type] || titles.complet, COMPANY_INFO.slogan)

  // Processus d'acquisition
  y += 5
  doc.setFillColor(COLORS.lightBg)
  doc.roundedRect(15, y - 5, doc.internal.pageSize.getWidth() - 30, 15, 3, 3, 'F')
  doc.setTextColor(COLORS.darkGreen)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('PROCESSUS D\'ACQUISITION', doc.internal.pageSize.getWidth() / 2, y + 2, { align: 'center' })
  doc.setTextColor(COLORS.midGreen)
  doc.setFontSize(10)
  doc.text(COMPANY_INFO.process, doc.internal.pageSize.getWidth() / 2, y + 8, { align: 'center' })
  y += 20

  // Module Sociale
  if (type === 'moduleSociale' || type === 'complet') {
    y = addSectionTitle(doc, OFFRE_STRUCTURE.moduleSociale.title, y)

    doc.setFontSize(9)
    doc.setTextColor('#6B7280')
    doc.setFont('helvetica', 'italic')
    doc.text(OFFRE_STRUCTURE.moduleSociale.description, 20, y)
    y += 8

    // En-têtes tableau
    const headers = ['Désignation', 'Montant (FCFA)', 'Frais annexes']
    const data = OFFRE_STRUCTURE.moduleSociale.items.map(item => [
      item.designation,
      formatCurrency(item.montant),
      formatCurrency(item.frais)
    ])

    y = addTable(doc, headers, data, y, [60, 50, 50])

    // Travaux inclus
    y += 8
    doc.setFontSize(9)
    doc.setTextColor(COLORS.darkGreen)
    doc.setFont('helvetica', 'bold')
    doc.text('TRAVAUX INCLUS ET EFFECTUÉS :', 20, y)
    y += 6

    const travaux = OFFRE_STRUCTURE.moduleSociale.items[0].traux || OFFRE_STRUCTURE.moduleSociale.items[0].travaux
    doc.setFont('helvetica', 'normal')
    doc.setTextColor('#374151')
    doc.setFontSize(8)

    const travauxList = OFFRE_STRUCTURE.moduleSociale.items[0].travaux
    travauxList.forEach((travail, index) => {
      doc.text(`• ${travail}`, 25, y + (index * 5))
    })
    y += travauxList.length * 5 + 10
  }

  // Droit de Terre
  if (type === 'droitTerre' || type === 'complet') {
    y = checkPageBreak(doc, y, 50)
    y = addSectionTitle(doc, OFFRE_STRUCTURE.droitTerre.title, y)

    doc.setFontSize(9)
    doc.setTextColor('#6B7280')
    doc.setFont('helvetica', 'italic')
    doc.text(OFFRE_STRUCTURE.droitTerre.description, 20, y)
    y += 8

    const headers = ['Désignation', 'Montant annuel (FCFA)']
    const data = OFFRE_STRUCTURE.droitTerre.items.map(item => [
      item.designation,
      formatCurrency(item.montant)
    ])

    y = addTable(doc, headers, data, y, [80, 60])
  }

  // Section QR Code et contact
  y = checkPageBreak(doc, y, 40)
  y += 10

  doc.setFillColor(COLORS.gold)
  doc.setDrawColor(COLORS.darkGreen)
  doc.setLineWidth(0.5)
  doc.roundedRect(15, y - 5, doc.internal.pageSize.getWidth() - 30, 30, 5, 5, 'FD')

  doc.setTextColor(COLORS.darkGreen)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(COMPANY_INFO.qrText, 35, y + 8)
  doc.text(COMPANY_INFO.callToAction, 35, y + 18)

  // Carré QR placeholder
  doc.setFillColor(COLORS.white)
  doc.setDrawColor(COLORS.darkGreen)
  doc.setLineWidth(0.3)
  doc.rect(doc.internal.pageSize.getWidth() - 55, y, 25, 25, 'FD')
  doc.setFontSize(8)
  doc.text('QR', doc.internal.pageSize.getWidth() - 42, y + 14, { align: 'center' })

  addPdfFooter(doc, null, true)

  const defaultName = `OFFRE-YAMTIKEN-${type.toUpperCase()}-${new Date().toISOString().slice(0, 10)}.pdf`
  doc.save(filename || defaultName)
}

/**
 * Génère une fiche de synthèse client avec offre personnalisée
 * @param {Object} clientData - Données du client
 * @param {string} offreType - Type d'offre recommandée
 */
export const generateFicheClientOffre = (clientData, offreType = 'Studio') => {
  const doc = new jsPDF('p', 'mm', 'a4')
  let y = 40

  addWatermark(doc)
  addPdfHeader(doc, 'FICHE CLIENT & PROPOSITION PERSONNALISÉE', clientData.nom || 'Nouveau client')

  // Informations client
  y = addSectionTitle(doc, 'Informations du client', y)

  const clientInfo = [
    ['Nom', clientData.nom || ''],
    ['Prénom', clientData.prenom || ''],
    ['Téléphone', clientData.telephone || ''],
    ['Email', clientData.email || ''],
    ['Date de visite', formatDate(new Date())]
  ]
  y = addTable(doc, ['Champ', 'Valeur'], clientInfo, y, [60, 100])

  // Offre recommandée
  y += 5
  y = checkPageBreak(doc, y)
  y = addSectionTitle(doc, `Offre recommandée : ${offreType}`, y)

  const offreItem = OFFRE_STRUCTURE.moduleSociale.items.find(i => i.designation === offreType)
  || OFFRE_STRUCTURE.moduleSociale.items[0]

  const offreData = [
    ['Module', offreItem.designation],
    ['Investissement initial', formatCurrency(offreItem.montant)],
    ['Frais annexes', formatCurrency(offreItem.frais)],
    ['Total à prévoir', formatCurrency(offreItem.montant + offreItem.frais)],
    ['Droit de terre/an', formatCurrency(
      OFFRE_STRUCTURE.droitTerre.items.find(i => i.designation === offreType)?.montant || 0
    )]
  ]
  y = addTable(doc, ['Détail', 'Montant'], offreData, y, [80, 80])

  // Travaux inclus
  y += 8
  doc.setFontSize(9)
  doc.setTextColor(COLORS.darkGreen)
  doc.setFont('helvetica', 'bold')
  doc.text('Travaux inclus dans l\'offre :', 20, y)
  y += 6

  doc.setFont('helvetica', 'normal')
  doc.setTextColor('#374151')
  doc.setFontSize(8)
  offreItem.travaux.forEach((travail, index) => {
    doc.text(`✓ ${travail}`, 25, y + (index * 5))
  })

  // Signature et date
  y += offreItem.travaux.length * 5 + 15
  y = checkPageBreak(doc, y)

  doc.setFontSize(10)
  doc.setTextColor(COLORS.black)
  doc.setFont('helvetica', 'bold')
  doc.text('Signature du client :', 20, y)
  doc.text('Signature du conseiller :', 110, y)

  doc.setDrawColor('#9CA3AF')
  doc.setLineWidth(0.3)
  doc.line(20, y + 10, 80, y + 10)
  doc.line(110, y + 10, 170, y + 10)

  doc.setFontSize(8)
  doc.setTextColor('#6B7280')
  doc.setFont('helvetica', 'normal')
  doc.text('Date : ' + formatDate(new Date()), 20, y + 18)

  addPdfFooter(doc, null, true)
  doc.save(`FICHE-${clientData.nom || 'CLIENT'}-${offreType}-${new Date().toISOString().slice(0, 10)}.pdf`)
}

export default {
  COMPANY_INFO,
  OFFRE_STRUCTURE,
  COLORS,
  addPdfHeader,
  addPdfFooter,
  addWatermark,
  addSectionTitle,
  addTable,
  addInfoCard,
  checkPageBreak,
  generateListPDF,
  generateDetailPDF,
  generateOffrePDF,
  generateFicheClientOffre
}
