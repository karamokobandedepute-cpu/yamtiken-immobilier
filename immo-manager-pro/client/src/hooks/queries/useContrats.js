import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { captureError, addSentryBreadcrumb } from '../../lib/sentry'

// ============================================================
// QUERY KEYS
// ============================================================
export const contratsKeys = {
  all: ['contrats'],
  lists: () => [...contratsKeys.all, 'list'],
  list: (filters) => [...contratsKeys.lists(), { filters }],
  details: () => [...contratsKeys.all, 'detail'],
  detail: (id) => [...contratsKeys.details(), id],
  stats: () => [...contratsKeys.all, 'stats'],
}

// ============================================================
// QUERIES
// ============================================================

/**
 * Hook pour récupérer tous les contrats
 */
export const useContrats = (options = {}) => {
  const { filters = {}, enabled = true } = options

  return useQuery({
    queryKey: contratsKeys.list(filters),
    queryFn: async () => {
      addSentryBreadcrumb('Fetching contrats', 'query', 'info', { filters })

      let query = supabase
        .from('contrats')
        .select(`
          *,
          bien:biens(id, nom, adresse, type),
          locataire:clients(id, nom, prenom, telephone, email),
          paiements:paiements(id, montant, statut, date_paiement)
        `)
        .order('created_at', { ascending: false })

      if (filters.statut) query = query.eq('statut', filters.statut)
      if (filters.bien_id) query = query.eq('bien_id', filters.bien_id)
      if (filters.locataire_id) query = query.eq('locataire_id', filters.locataire_id)

      const { data, error } = await query

      if (error) {
        captureError(error, { context: 'useContrats', filters })
        throw error
      }

      return data || []
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Hook pour récupérer un contrat spécifique
 */
export const useContrat = (id, options = {}) => {
  const { enabled = !!id } = options

  return useQuery({
    queryKey: contratsKeys.detail(id),
    queryFn: async () => {
      if (!id) throw new Error('ID requis')

      const { data, error } = await supabase
        .from('contrats')
        .select(`
          *,
          bien:biens(*),
          locataire:clients(*),
          paiements:paiements(*)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data
    },
    enabled,
    staleTime: 3 * 60 * 1000,
  })
}

// ============================================================
// MUTATIONS
// ============================================================

/**
 * Hook pour créer un contrat
 */
export const useCreateContrat = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (newContrat) => {
      const { data, error } = await supabase
        .from('contrats')
        .insert([newContrat])
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contratsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: ['biens'] })
      toast.success('✅ Contrat créé avec succès')
    },
    onError: () => {
      toast.error('❌ Erreur lors de la création du contrat')
    }
  })
}

/**
 * Hook pour mettre à jour un contrat
 */
export const useUpdateContrat = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }) => {
      const { data, error } = await supabase
        .from('contrats')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: contratsKeys.lists() })
      queryClient.setQueryData(contratsKeys.detail(variables.id), data)
      toast.success('✅ Contrat modifié avec succès')
    },
    onError: () => {
      toast.error('❌ Erreur lors de la modification du contrat')
    }
  })
}

/**
 * Hook pour supprimer un contrat
 */
export const useDeleteContrat = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('contrats')
        .delete()
        .eq('id', id)

      if (error) throw error
      return id
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: contratsKeys.lists() })
      queryClient.removeQueries({ queryKey: contratsKeys.detail(id) })
      toast.success('✅ Contrat supprimé avec succès')
    },
    onError: () => {
      toast.error('❌ Erreur lors de la suppression du contrat')
    }
  })
}
