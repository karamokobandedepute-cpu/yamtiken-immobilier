import jsPDF from 'jspdf'
import 'jspdf-autotable'
import toast from 'react-hot-toast'

/**
 * Gestionnaire centralisé d'export PDF
 */
export class PDFExporter {
  constructor(title, filename) {
    this.doc = new jsPDF()
    this.title = title
    this.filename = filename || `export_${Date.now()}.pdf`
  }
  
  addHeader(subtitle = '') {
    this.doc.setFontSize(18)
    this.doc.text(this.title, 14, 20)
    
    if (subtitle) {
      this.doc.setFontSize(10)
      this.doc.text(subtitle, 14, 28)
    }
  }
  
  addTable(headers, data, options = {}) {
    this.doc.autoTable({
      head: [headers],
      body: data,
      startY: options.startY || 35,
      styles: { fontSize: 9, ...options.styles },
      headStyles: { fillColor: [99, 102, 241], ...options.headStyles },
      ...options
    })
  }
  
  addFooter(text) {
    const finalY = this.doc.lastAutoTable?.finalY || this.doc.internal.pageSize.height - 20
    this.doc.setFontSize(10)
    this.doc.text(text, 14, finalY + 10)
  }
  
  async save() {
    try {
      this.doc.save(this.filename)
      toast.success(`PDF "${this.title}" exporté avec succès`, {
        icon: '📄',
        duration: 3000
      })
      return true
    } catch (error) {
      console.error(`[PDF Export] Échec pour "${this.title}":`, error)
      toast.error(`Échec export PDF: ${error.message}`, {
        icon: '❌',
        duration: 5000
      })
      return false
    }
  }
}

// Exemple d'utilisation:
// const pdf = new PDFExporter('Liste des Baux', 'baux.pdf')
// pdf.addHeader('Généré le 02/05/2026')
// pdf.addTable(['N°', 'Client', 'Montant'], tableData)
// pdf.addFooter('Total: 50 baux')
// await pdf.save()
