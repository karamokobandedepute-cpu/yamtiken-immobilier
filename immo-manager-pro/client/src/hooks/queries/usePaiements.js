import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { captureError, addSentryBreadcrumb } from '../../lib/sentry'

// ============================================================
// QUERY KEYS
// ============================================================
export const paiementsKeys = {
  all: ['paiements'],
  lists: () => [...paiementsKeys.all, 'list'],
  list: (filters) => [...paiementsKeys.lists(), { filters }],
  details: () => [...paiementsKeys.all, 'detail'],
  detail: (id) => [...paiementsKeys.details(), id],
  stats: () => [...paiementsKeys.all, 'stats'],
}

// ============================================================
// QUERIES
// ============================================================

/**
 * Hook pour récupérer tous les paiements
 */
export const usePaiements = (options = {}) => {
  const { filters = {}, enabled = true } = options

  return useQuery({
    queryKey: paiementsKeys.list(filters),
    queryFn: async () => {
      addSentryBreadcrumb('Fetching paiements', 'query', 'info', { filters })

      let query = supabase
        .from('paiements')
        .select(`
          *,
          contrat:contrats(
            id,
            bien:biens(id, nom),
            locataire:clients(id, nom, prenom, telephone)
          )
        `)
        .order('date_echeance', { ascending: false })

      if (filters.statut) query = query.eq('statut', filters.statut)
      if (filters.contrat_id) query = query.eq('contrat_id', filters.contrat_id)
      if (filters.mois) query = query.gte('date_echeance', filters.mois)

      const { data, error } = await query

      if (error) {
        captureError(error, { context: 'usePaiements', filters })
        throw error
      }

      return data || []
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes (données financières)
  })
}

/**
 * Hook pour récupérer un paiement spécifique
 */
export const usePaiement = (id, options = {}) => {
  const { enabled = !!id } = options

  return useQuery({
    queryKey: paiementsKeys.detail(id),
    queryFn: async () => {
      if (!id) throw new Error('ID requis')

      const { data, error } = await supabase
        .from('paiements')
        .select(`
          *,
          contrat:contrats(
            *,
            bien:biens(*),
            locataire:clients(*)
          )
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    },
    enabled,
    staleTime: 2 * 60 * 1000,
  })
}

/**
 * Hook pour récupérer les statistiques des paiements
 */
export const usePaiementsStats = (options = {}) => {
  const { mois } = options

  return useQuery({
    queryKey: [...paiementsKeys.stats(), { mois }],
    queryFn: async () => {
      let query = supabase
        .from('paiements')
        .select('id, montant, statut, date_paiement, date_echeance')

      if (mois) {
        query = query.gte('date_echeance', mois)
      }

      const { data, error } = await query

      if (error) throw error

      const stats = {
        total: data?.length || 0,
        payes: data?.filter(p => p.statut === 'PAYE').length || 0,
        enAttente: data?.filter(p => p.statut === 'EN_ATTENTE').length || 0,
        retard: data?.filter(p => p.statut === 'RETARD').length || 0,
        montantTotal: data?.reduce((sum, p) => sum + (p.montant || 0), 0) || 0,
        montantPaye: data?.filter(p => p.statut === 'PAYE').reduce((sum, p) => sum + (p.montant || 0), 0) || 0,
        montantEnAttente: data?.filter(p => p.statut === 'EN_ATTENTE').reduce((sum, p) => sum + (p.montant || 0), 0) || 0,
      }

      return stats
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ============================================================
// MUTATIONS
// ============================================================

/**
 * Hook pour créer un paiement
 */
export const useCreatePaiement = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (newPaiement) => {
      const { data, error } = await supabase
        .from('paiements')
        .insert([newPaiement])
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: paiementsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: paiementsKeys.stats() })
      queryClient.invalidateQueries({ queryKey: ['contrats'] })
      toast.success('✅ Paiement enregistré avec succès')
    },
    onError: () => {
      toast.error('❌ Erreur lors de l\'enregistrement du paiement')
    }
  })
}

/**
 * Hook pour mettre à jour un paiement
 */
export const useUpdatePaiement = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await supabase
        .from('paiements')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: paiementsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: paiementsKeys.stats() })
      queryClient.setQueryData(paiementsKeys.detail(variables.id), data)
      toast.success('✅ Paiement modifié avec succès')
    },
    onError: () => {
      toast.error('❌ Erreur lors de la modification du paiement')
    }
  })
}

/**
 * Hook pour supprimer un paiement
 */
export const useDeletePaiement = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('paiements')
        .delete()
        .eq('id', id)

      if (error) throw error
      return id
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: paiementsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: paiementsKeys.stats() })
      queryClient.removeQueries({ queryKey: paiementsKeys.detail(id) })
      toast.success('✅ Paiement supprimé avec succès')
    },
    onError: () => {
      toast.error('❌ Erreur lors de la suppression du paiement')
    }
  })
}
