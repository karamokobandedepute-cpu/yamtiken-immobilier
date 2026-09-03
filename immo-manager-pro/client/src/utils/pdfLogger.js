/**
 * pdfLogger — Enregistre chaque génération de document dans activityStore
 * Le SUPER_ADMIN est automatiquement ignoré (mode fantôme) dans le store
 */
import { useActivityStore } from '../stores/activityStore'

const PAGE_LABELS = {
  clients:      'Clients',
  contrats:     'Contrats',
  paiements:    'Paiements',
  biens:        'Biens',
  recouvrement: 'Recouvrement',
  secretariat:  'Secrétariat',
  dashboard:    'Tableau de bord',
  commissions:  'Commissions'
}

/**
 * @param {object} user       - utilisateur connecté (authStore.user)
 * @param {'PDF_GENERATED'|'EXCEL_GENERATED'} type
 * @param {string} filename   - nom du fichier généré
 * @param {string} page       - clé de PAGE_LABELS
 * @param {object} [extra]    - données supplémentaires (ex: { numeroBail, client })
 */
export const logDocGeneration = (user, type, filename, page, extra = {}) => {
  const { addLog } = useActivityStore.getState()
  const pageLabel = PAGE_LABELS[page] || page
  const ext = type === 'EXCEL_GENERATED' ? 'Excel' : 'PDF'
  const heure = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  addLog(
    user,
    type,
    `${ext} · ${pageLabel} · ${filename}`,
    { filename, page: pageLabel, heure, ...extra }
  )
}
