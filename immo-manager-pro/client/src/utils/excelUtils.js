import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import toast from 'react-hot-toast'

const BRAND_GREEN  = 'FF0D3B1F'
const BRAND_GOLD   = 'FFC8960C'
const BRAND_LGREEN = 'FFE8F5EC'

/**
 * Exporte un tableau en fichier Excel .xlsx avec mise en forme Yamtiken Behemoth
 * @param {string} filename - nom du fichier sans extension
 * @param {string} sheetName - nom de l'onglet
 * @param {string[]} headers - titres des colonnes
 * @param {Array[]} rows - données (tableau de tableaux)
 * @param {string} [title] - titre affiché en haut du fichier
 */
export const exportToExcel = async (filename, sheetName, headers, rows, title = '') => {
  const toastId = toast.loading('Génération Excel...')
  try {
    const wb = new ExcelJS.Workbook()
    wb.creator  = 'Yamtiken Behemoth - Immo Manager Pro'
    wb.created  = new Date()
    wb.modified = new Date()

    const ws = wb.addWorksheet(sheetName, {
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true }
    })

    let currentRow = 1

    // ── Titre entreprise ──────────────────────────────────
    if (title) {
      ws.mergeCells(currentRow, 1, currentRow, headers.length)
      const titleCell = ws.getCell(currentRow, 1)
      titleCell.value = 'YAMTIKEN BEHEMOTH  •  ' + title
      titleCell.font  = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
      titleCell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_GREEN } }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
      ws.getRow(currentRow).height = 30
      currentRow++

      // Date génération
      ws.mergeCells(currentRow, 1, currentRow, headers.length)
      const dateCell = ws.getCell(currentRow, 1)
      dateCell.value = `Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
      dateCell.font  = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF6B7280' } }
      dateCell.alignment = { horizontal: 'center' }
      ws.getRow(currentRow).height = 16
      currentRow++
      currentRow++ // ligne vide
    }

    // ── En-têtes colonnes ─────────────────────────────────
    const headerRow = ws.getRow(currentRow)
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1)
      cell.value = h
      cell.font  = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_GREEN } }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border = {
        bottom: { style: 'medium', color: { argb: BRAND_GOLD } }
      }
    })
    headerRow.height = 22
    currentRow++

    // ── Données ───────────────────────────────────────────
    rows.forEach((row, ri) => {
      const dataRow = ws.getRow(currentRow)
      const isEven = ri % 2 === 0
      row.forEach((val, ci) => {
        const cell = dataRow.getCell(ci + 1)
        cell.value = val ?? ''
        cell.font  = { name: 'Calibri', size: 9 }
        cell.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFFFFFFF' : BRAND_LGREEN } }
        cell.alignment = { vertical: 'middle', wrapText: false }
        cell.border = {
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        }
      })
      dataRow.height = 18
      currentRow++
    })

    // ── Largeur auto colonnes ─────────────────────────────
    ws.columns.forEach((col, i) => {
      const maxLen = Math.max(
        headers[i]?.length || 10,
        ...rows.map(r => String(r[i] ?? '').length)
      )
      col.width = Math.min(Math.max(maxLen + 4, 12), 40)
    })

    // ── Ligne totaux (si dernière ligne commence par "Total") ──
    if (rows.length > 0 && String(rows[rows.length - 1][0]).startsWith('Total')) {
      const totalRowIdx = currentRow - 1
      const totalRow = ws.getRow(totalRowIdx)
      headers.forEach((_, i) => {
        const cell = totalRow.getCell(i + 1)
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: BRAND_GREEN } }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_LGREEN } }
        cell.border = { top: { style: 'medium', color: { argb: BRAND_GREEN } } }
      })
    }

    // ── Export ────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer()
    const blob   = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(blob, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`)

    toast.success('Excel exporté avec succès', { id: toastId, icon: '📊' })
    return true
  } catch (error) {
    console.error('[Excel Export]', error)
    toast.error('Erreur lors de l\'export Excel', { id: toastId })
    return false
  }
}
