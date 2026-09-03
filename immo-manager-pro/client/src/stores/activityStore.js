import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SUPER_ADMIN_EMAIL } from '../utils/constants'

const MAX_LOGS = 200

export const useActivityStore = create(
  persist(
    (set, get) => ({
      logs: [],

      // Ajouter un log — ignoré si SUPER_ADMIN
      addLog: (user, type, description, metadata = {}) => {
        if (!user) return
        if (user.email?.toLowerCase() === SUPER_ADMIN_EMAIL) return

        const log = {
          id: Date.now() + Math.random(),
          userId: user.id,
          userEmail: user.email,
          userName: `${user.prenom || ''} ${user.nom || ''}`.trim(),
          userRole: user.role,
          type,       // LOGIN | PDF_GENERATED | EXCEL_GENERATED
          description,
          metadata,
          createdAt: new Date().toISOString()
        }

        set(state => ({
          logs: [log, ...state.logs].slice(0, MAX_LOGS)
        }))
      },

      // Tous les logs (pour le SUPER_ADMIN qui les consulte)
      getLogs: () => get().logs,

      // Logs d'un type spécifique
      getByType: (type) => get().logs.filter(l => l.type === type),

      // Logs PDF/Excel (miniatures)
      getDocLogs: () => get().logs.filter(l => ['PDF_GENERATED', 'EXCEL_GENERATED'].includes(l.type)),

      clearLogs: () => set({ logs: [] })
    }),
    {
      name: 'activity-logs',
      partialize: (state) => ({ logs: state.logs })
    }
  )
)
