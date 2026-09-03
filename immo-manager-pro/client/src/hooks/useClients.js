// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HOOK CLIENTS - Récupération et gestion des clients
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../utils/api'
import toast from 'react-hot-toast'

const fetchClients = async () => {
  const { data } = await api.get('/clients')
  return data
}

const createClient = async (clientData) => {
  const { data } = await api.post('/clients', clientData)
  return data
}

const updateClient = async ({ id, ...updates }) => {
  const { data } = await api.put(`/clients/${id}`, updates)
  return data
}

const deleteClient = async (id) => {
  await api.delete(`/clients/${id}`)
  return id
}

// ═══════════════════════════════════════════════════════════════════
// REACT HOOKS
// ═══════════════════════════════════════════════════════════════════

/**
 * Hook pour récupérer tous les clients
 * @param {Object} options - Options de requête
 * @param {boolean} options.enabled - Activer la requête (défaut: true)
 */
export function useClients(options = {}) {
  const { enabled = true } = options
  return useQuery({
    queryKey: ['clients'],
    queryFn: fetchClients,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    enabled,
  })
}

/**
 * Hook pour récupérer un client spécifique
 */
export function useClient(id) {
  return useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const { data } = await api.get(`/clients/${id}`)
      return data
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000,
  })
}

/**
 * Hook pour créer un client
 */
export function useCreateClient() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createClient,
    onSuccess: (data) => {
      // Invalider le cache pour forcer le refetch
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success(`Client ${data.prenom} ${data.nom} créé avec succès`)
      return data
    },
    onError: (error) => {
      const message = error.response?.data?.message || 'Erreur lors de la création du client'
      toast.error(message)
      throw error
    }
  })
}

/**
 * Hook pour mettre à jour un client
 */
export function useUpdateClient() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: updateClient,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['client', data.id] })
      toast.success('Client mis à jour')
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Erreur lors de la mise à jour')
    }
  })
}

/**
 * Hook pour supprimer un client
 */
export function useDeleteClient() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: deleteClient,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client supprimé')
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Erreur lors de la suppression')
    }
  })
}

/**
 * Hook pour rechercher des clients
 */
export function useSearchClients() {
  return useMutation({
    mutationFn: async (searchTerm) => {
      const { data } = await api.get('/clients', { 
        params: { search: searchTerm } 
      })
      return data
    }
  })
}
