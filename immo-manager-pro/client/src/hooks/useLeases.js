// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GESTION DES BAUX - React Hooks avec synchronisation temps réel
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useCallback } from 'react'
import api from '../utils/api'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

// ═══════════════════════════════════════════════════════════════════
// API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

const fetchLeases = async (filters = {}) => {
  const { data } = await api.get('/leases', { params: filters })
  return data
}

const fetchLeaseById = async (id) => {
  const { data } = await api.get(`/leases/${id}`)
  return data
}

const createLease = async (leaseData) => {
  const { data } = await api.post('/leases', leaseData)
  return data
}

const updateLease = async ({ id, ...updates }) => {
  const { data } = await api.put(`/leases/${id}`, updates)
  return data
}

const updateLeaseStatut = async ({ id, statut }) => {
  const { data } = await api.put(`/leases/${id}/statut`, { statut })
  return data
}

const deleteLease = async (id) => {
  await api.delete(`/leases/${id}`)
  return id
}

// ═══════════════════════════════════════════════════════════════════
// REACT HOOKS
// ═══════════════════════════════════════════════════════════════════

/**
 * Hook pour récupérer tous les baux avec filtres
 */
export function useLeases(filters = {}) {
  return useQuery({
    queryKey: ['leases', filters],
    queryFn: () => fetchLeases(filters),
    staleTime: 30 * 1000, // 30 secondes
    refetchInterval: 60 * 1000, // Refetch automatique toutes les minutes
  })
}

/**
 * Hook pour récupérer un bail spécifique
 */
export function useLease(id) {
  return useQuery({
    queryKey: ['lease', id],
    queryFn: () => fetchLeaseById(id),
    enabled: !!id,
    staleTime: 60 * 1000,
  })
}

/**
 * Hook pour créer un bail
 */
export function useCreateLease() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createLease,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leases'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success(`Bail ${data.numeroBail} créé avec succès`)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Erreur lors de la création du bail')
    }
  })
}

/**
 * Hook pour mettre à jour un bail
 */
export function useUpdateLease() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: updateLease,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leases'] })
      queryClient.invalidateQueries({ queryKey: ['lease', data.id] })
      toast.success('Bail mis à jour')
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Erreur lors de la mise à jour')
    }
  })
}

/**
 * Hook pour changer le statut d'un bail
 */
export function useUpdateLeaseStatut() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: updateLeaseStatut,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leases'] })
      queryClient.invalidateQueries({ queryKey: ['lease', variables.id] })
      toast.success(`Statut mis à jour: ${variables.statut}`)
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Erreur lors du changement de statut')
    }
  })
}

/**
 * Hook pour supprimer un bail
 */
export function useDeleteLease() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: deleteLease,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leases'] })
      toast.success('Bail supprimé')
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Erreur lors de la suppression')
    }
  })
}

// ═══════════════════════════════════════════════════════════════════
// SYNCHRONISATION TEMPS RÉEL SUPABASE
// ═══════════════════════════════════════════════════════════════════

/**
 * Hook pour synchroniser les baux en temps réel
 * Déclenche un refetch quand des changements sont détectés
 */
export function useLeasesRealtime() {
  const queryClient = useQueryClient()
  
  useEffect(() => {
    // Canal temps réel pour les baux
    const channel = supabase
      .channel('leases_changes')
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'leases'
        },
        (payload) => {
          console.log('[Realtime] Changement détecté sur leases:', payload)
          
          // Invalider le cache pour forcer le refetch
          queryClient.invalidateQueries({ queryKey: ['leases'] })
          
          // Notification selon le type d'événement
          switch (payload.eventType) {
            case 'INSERT':
              toast.success(`Nouveau bail créé: ${payload.new.numeroBail}`)
              break
            case 'UPDATE':
              toast.success(`Bail ${payload.new.numeroBail} mis à jour`)
              break
            case 'DELETE':
              toast.success('Bail supprimé')
              break
          }
        }
      )
      .subscribe()
    
    // Cleanup
    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient])
}

/**
 * Hook pour synchroniser un bail spécifique en temps réel
 */
export function useLeaseRealtime(leaseId) {
  const queryClient = useQueryClient()
  
  useEffect(() => {
    if (!leaseId) return
    
    const channel = supabase
      .channel(`lease_${leaseId}_changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leases',
          filter: `id=eq.${leaseId}`
        },
        (payload) => {
          console.log(`[Realtime] Bail ${leaseId} mis à jour:`, payload)
          queryClient.invalidateQueries({ queryKey: ['lease', leaseId] })
          queryClient.invalidateQueries({ queryKey: ['leases'] })
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [leaseId, queryClient])
}

// ═══════════════════════════════════════════════════════════════════
// HOOK COMBINÉ - Récupération + Temps réel
// ═══════════════════════════════════════════════════════════════════

/**
 * Hook complet: récupère les baux
 * Note: le temps réel est géré globalement par useRealtimeSync dans App.jsx
 * Pas besoin d'un 2ème canal Supabase ici (évite double toast + 429 rate limit)
 */
export function useLeasesWithRealtime(filters = {}) {
  return useLeases(filters)
}

/**
 * Hook complet pour un bail spécifique
 */
export function useLeaseWithRealtime(id) {
  const leaseQuery = useLease(id)
  useLeaseRealtime(id)
  
  return leaseQuery
}

// ═══════════════════════════════════════════════════════════════════
// CALCULS DERIVÉS
// ═══════════════════════════════════════════════════════════════════

/**
 * Calcule les statistiques des baux
 */
export function calculateLeaseStats(leases = []) {
  const total = leases.length
  const actifs = leases.filter(l => l.statut === 'actif').length
  const expires = leases.filter(l => l.statut === 'expire').length
  const resilies = leases.filter(l => l.statut === 'resilie').length
  
  const montantTotal = leases.reduce((sum, l) => sum + (l.montantInitial || 0), 0)
  const montantPaye = leases.reduce((sum, l) => sum + (l.calculs?.totalPaye || 0), 0)
  const montantRestant = montantTotal - montantPaye
  
  const progressionMoyenne = leases.length > 0
    ? leases.reduce((sum, l) => sum + parseFloat(l.calculs?.progression || 0), 0) / leases.length
    : 0
  
  return {
    total,
    actifs,
    expires,
    resilies,
    montantTotal,
    montantPaye,
    montantRestant,
    progressionMoyenne,
    tauxOccupation: total > 0 ? (actifs / total) * 100 : 0
  }
}
