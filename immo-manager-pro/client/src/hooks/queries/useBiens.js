import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import toast from 'react-hot-toast'
import { captureError, addSentryBreadcrumb } from '../../lib/sentry'

// ============================================================
// QUERY KEYS - Centralisés pour cohérence
// ============================================================
export const biensKeys = {
  all: ['biens'],
  lists: () => [...biensKeys.all, 'list'],
  list: (filters) => [...biensKeys.lists(), { filters }],
  details: () => [...biensKeys.all, 'detail'],
  detail: (id) => [...biensKeys.details(), id],
  stats: () => [...biensKeys.all, 'stats'],
}

// ============================================================
// QUERIES - Récupération des données
// ============================================================

/**
 * Hook pour récupérer tous les biens
 * @param {Object} options - Options de filtrage
 * @returns {Object} { data, isLoading, error, refetch }
 */
export const useBiens = (options = {}) => {
  const { filters = {}, enabled = true } = options

  return useQuery({
    queryKey: biensKeys.list(filters),
    queryFn: async () => {
      addSentryBreadcrumb('Fetching biens', 'query', 'info', { filters })

      let query = supabase
        .from('biens')
        .select(`
          *,
          batiment:batiments(id, nom, adresse),
          contrats:contrats(id, statut, locataire:clients(nom, prenom))
        `)
        .order('created_at', { ascending: false })

      // Appliquer les filtres
      if (filters.statut) {
        query = query.eq('statut', filters.statut)
      }
      if (filters.type) {
        query = query.eq('type', filters.type)
      }
      if (filters.batiment_id) {
        query = query.eq('batiment_id', filters.batiment_id)
      }
      if (filters.search) {
        query = query.ilike('nom', `%${filters.search}%`)
      }

      const { data, error } = await query

      if (error) {
        captureError(error, { context: 'useBiens', filters })
        throw error
      }

      return data || []
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    meta: {
      errorMessage: 'Erreur lors du chargement des biens'
    }
  })
}

/**
 * Hook pour récupérer un bien spécifique
 * @param {string} id - ID du bien
 * @returns {Object} { data, isLoading, error }
 */
export const useBien = (id, options = {}) => {
  const { enabled = !!id } = options

  return useQuery({
    queryKey: biensKeys.detail(id),
    queryFn: async () => {
      if (!id) throw new Error('ID requis')

      addSentryBreadcrumb('Fetching bien detail', 'query', 'info', { id })

      const { data, error } = await supabase
        .from('biens')
        .select(`
          *,
          batiment:batiments(id, nom, adresse, ville),
          contrats:contrats(
            id,
            statut,
            date_debut,
            date_fin,
            montant_loyer,
            locataire:clients(id, nom, prenom, telephone, email)
          ),
          paiements:paiements(
            id,
            montant,
            date_paiement,
            statut
          )
        `)
        .eq('id', id)
        .single()

      if (error) {
        captureError(error, { context: 'useBien', id })
        throw error
      }

      return data
    },
    enabled,
    staleTime: 3 * 60 * 1000, // 3 minutes
  })
}

/**
 * Hook pour récupérer les statistiques des biens
 * @returns {Object} { data, isLoading, error }
 */
export const useBiensStats = () => {
  return useQuery({
    queryKey: biensKeys.stats(),
    queryFn: async () => {
      addSentryBreadcrumb('Fetching biens stats', 'query', 'info')

      const { data: biens, error } = await supabase
        .from('biens')
        .select('id, statut, type, montant_loyer')

      if (error) throw error

      const stats = {
        total: biens?.length || 0,
        disponibles: biens?.filter(b => b.statut === 'DISPONIBLE').length || 0,
        occupes: biens?.filter(b => b.statut === 'OCCUPE').length || 0,
        maintenance: biens?.filter(b => b.statut === 'MAINTENANCE').length || 0,
        tauxOccupation: biens?.length > 0 
          ? ((biens.filter(b => b.statut === 'OCCUPE').length / biens.length) * 100).toFixed(1)
          : 0,
        revenuPotentiel: biens?.reduce((sum, b) => sum + (b.montant_loyer || 0), 0) || 0
      }

      return stats
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}

// ============================================================
// MUTATIONS - Modification des données
// ============================================================

/**
 * Hook pour créer un bien
 * @returns {Object} { mutate, mutateAsync, isLoading, error }
 */
export const useCreateBien = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (newBien) => {
      addSentryBreadcrumb('Creating bien', 'mutation', 'info', { newBien })

      const { data, error } = await supabase
        .from('biens')
        .insert([newBien])
        .select()
        .single()

      if (error) {
        captureError(error, { context: 'createBien', newBien })
        throw error
      }

      return data
    },
    onSuccess: (data) => {
      // Invalider toutes les listes de biens
      queryClient.invalidateQueries({ queryKey: biensKeys.lists() })
      queryClient.invalidateQueries({ queryKey: biensKeys.stats() })
      
      toast.success('✅ Bien créé avec succès')
      
      addSentryBreadcrumb('Bien created', 'mutation', 'info', { id: data.id })
    },
    onError: (error) => {
      toast.error('❌ Erreur lors de la création du bien')
      console.error('Create bien error:', error)
    }
  })
}

/**
 * Hook pour mettre à jour un bien
 * @returns {Object} { mutate, mutateAsync, isLoading, error }
 */
export const useUpdateBien = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, updates }) => {
      if (!id) throw new Error('ID requis')

      addSentryBreadcrumb('Updating bien', 'mutation', 'info', { id, updates })

      const { data, error } = await supabase
        .from('biens')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        captureError(error, { context: 'updateBien', id, updates })
        throw error
      }

      return data
    },
    onSuccess: (data, variables) => {
      // Invalider les listes
      queryClient.invalidateQueries({ queryKey: biensKeys.lists() })
      queryClient.invalidateQueries({ queryKey: biensKeys.stats() })
      
      // Mettre à jour le cache du bien spécifique
      queryClient.setQueryData(biensKeys.detail(variables.id), data)
      
      toast.success('✅ Bien modifié avec succès')
    },
    onError: (error) => {
      toast.error('❌ Erreur lors de la modification du bien')
      console.error('Update bien error:', error)
    }
  })
}

/**
 * Hook pour supprimer un bien
 * @returns {Object} { mutate, mutateAsync, isLoading, error }
 */
export const useDeleteBien = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id) => {
      if (!id) throw new Error('ID requis')

      addSentryBreadcrumb('Deleting bien', 'mutation', 'warning', { id })

      const { error } = await supabase
        .from('biens')
        .delete()
        .eq('id', id)

      if (error) {
        captureError(error, { context: 'deleteBien', id })
        throw error
      }

      return id
    },
    onSuccess: (id) => {
      // Invalider toutes les listes
      queryClient.invalidateQueries({ queryKey: biensKeys.lists() })
      queryClient.invalidateQueries({ queryKey: biensKeys.stats() })
      
      // Supprimer du cache
      queryClient.removeQueries({ queryKey: biensKeys.detail(id) })
      
      toast.success('✅ Bien supprimé avec succès')
    },
    onError: (error) => {
      toast.error('❌ Erreur lors de la suppression du bien')
      console.error('Delete bien error:', error)
    }
  })
}

/**
 * Hook pour mettre à jour le statut d'un bien
 * @returns {Object} { mutate, mutateAsync, isLoading, error }
 */
export const useUpdateBienStatut = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, statut }) => {
      if (!id || !statut) throw new Error('ID et statut requis')

      const { data, error } = await supabase
        .from('biens')
        .update({ statut })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onMutate: async ({ id, statut }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: biensKeys.detail(id) })
      
      const previousBien = queryClient.getQueryData(biensKeys.detail(id))
      
      queryClient.setQueryData(biensKeys.detail(id), (old) => ({
        ...old,
        statut
      }))
      
      return { previousBien }
    },
    onError: (error, variables, context) => {
      // Rollback en cas d'erreur
      if (context?.previousBien) {
        queryClient.setQueryData(biensKeys.detail(variables.id), context.previousBien)
      }
      toast.error('❌ Erreur lors de la mise à jour du statut')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: biensKeys.lists() })
      queryClient.invalidateQueries({ queryKey: biensKeys.stats() })
      toast.success('✅ Statut mis à jour')
    }
  })
}

// ============================================================
// PREFETCHING - Préchargement des données
// ============================================================

/**
 * Précharger les biens pour améliorer la performance
 */
export const prefetchBiens = (queryClient, filters = {}) => {
  return queryClient.prefetchQuery({
    queryKey: biensKeys.list(filters),
    queryFn: async () => {
      const { data } = await supabase
        .from('biens')
        .select('*')
        .order('created_at', { ascending: false })
      
      return data || []
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Précharger un bien spécifique
 */
export const prefetchBien = (queryClient, id) => {
  return queryClient.prefetchQuery({
    queryKey: biensKeys.detail(id),
    queryFn: async () => {
      const { data } = await supabase
        .from('biens')
        .select('*')
        .eq('id', id)
        .single()
      
      return data
    },
    staleTime: 3 * 60 * 1000,
  })
}
