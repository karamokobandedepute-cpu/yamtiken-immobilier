// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GESTION DES PORTES - REACT HOOKS (100% React, 0% Flutter)
// Remplacement de : lib/features/portes/providers/porte_providers.dart
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ═══════════════════════════════════════════════════════════════════
// SERVICES API (remplace porte_repository.dart)
// ═══════════════════════════════════════════════════════════════════

const fetchTypesPortes = async (batimentId) => {
  const { data, error } = await supabase
    .from('type_portes')
    .select('*')
    .eq('batiment_id', batimentId)
    .order('type_nom')
  
  if (error) throw error
  return data || []
}

const fetchAttributionsClient = async (clientId) => {
  const { data, error } = await supabase
    .from('attributions')
    .select(`
      *,
      type_porte:type_porte_id (type_nom, prix_mensuel),
      batiment:batiment_id (nom)
    `)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return data || []
}

const fetchClientSummary = async (clientId) => {
  const { data, error } = await supabase
    .from('vue_client_summary')
    .select('*')
    .eq('client_id', clientId)
    .single()
  
  if (error) throw error
  return data
}

const fetchBatimentStock = async (batimentId) => {
  const { data, error } = await supabase
    .from('vue_batiment_stock')
    .select('*')
    .eq('batiment_id', batimentId)
    .single()
  
  if (error) throw error
  return data
}

// ═══════════════════════════════════════════════════════════════════
// RPC FUNCTIONS (remplace RPC Supabase SQL)
// ═══════════════════════════════════════════════════════════════════

const attribuerPortes = async ({ clientId, typePorteId, quantite, dateDebut, notes }) => {
  const { data, error } = await supabase.rpc('attribuer_portes', {
    p_client_id: clientId,
    p_type_porte_id: typePorteId,
    p_quantite: quantite,
    p_date_debut: dateDebut,
    p_notes: notes
  })
  
  if (error) throw error
  if (!data.success) throw new Error(data.error || 'Erreur attribution')
  return data
}

const resilierAttribution = async (attributionId, dateFin, motif) => {
  const { data, error } = await supabase.rpc('resilier_attribution', {
    p_attribution_id: attributionId,
    p_date_fin: dateFin,
    p_motif: motif
  })
  
  if (error) throw error
  if (!data.success) throw new Error(data.error || 'Erreur résiliation')
  return data
}

const modifierQuantiteAttribution = async (attributionId, nouvelleQuantite) => {
  const { data, error } = await supabase.rpc('modifier_quantite_attribution', {
    p_attribution_id: attributionId,
    p_nouvelle_quantite: nouvelleQuantite
  })
  
  if (error) throw error
  if (!data.success) throw new Error(data.error || 'Erreur modification')
  return data
}

const upsertTypePorte = async (batimentId, typePorte) => {
  const { data, error } = await supabase.rpc('upsert_type_porte', {
    p_batiment_id: batimentId,
    p_type_nom: typePorte.typeNom,
    p_quantite_totale: typePorte.quantiteTotale,
    p_prix_mensuel: typePorte.prixMensuel,
    p_surface_m2: typePorte.surfaceM2,
    p_description: typePorte.description
  })
  
  if (error) throw error
  if (!data.success) throw new Error(data.error || 'Erreur création type')
  return data
}

// ═══════════════════════════════════════════════════════════════════
// REACT HOOKS (remplace Riverpod providers)
// ═══════════════════════════════════════════════════════════════════

/**
 * Hook pour les types de portes d'un bâtiment
 * @param {string} batimentId
 */
export function useTypesPortes(batimentId) {
  return useQuery({
    queryKey: ['types-portes', batimentId],
    queryFn: () => fetchTypesPortes(batimentId),
    enabled: !!batimentId,
    staleTime: 5 * 60 * 1000 // 5 minutes
  })
}

/**
 * Hook pour les attributions d'un client
 * @param {string} clientId
 */
export function useAttributionsClient(clientId) {
  return useQuery({
    queryKey: ['attributions', 'client', clientId],
    queryFn: () => fetchAttributionsClient(clientId),
    enabled: !!clientId,
    staleTime: 2 * 60 * 1000 // 2 minutes
  })
}

/**
 * Hook pour le résumé client (loyer, nombre de portes)
 * @param {string} clientId
 */
export function useClientSummary(clientId) {
  return useQuery({
    queryKey: ['client-summary', clientId],
    queryFn: () => fetchClientSummary(clientId),
    enabled: !!clientId,
    staleTime: 1 * 60 * 1000 // 1 minute
  })
}

/**
 * Hook pour le stock d'un bâtiment
 * @param {string} batimentId
 */
export function useBatimentStock(batimentId) {
  return useQuery({
    queryKey: ['batiment-stock', batimentId],
    queryFn: () => fetchBatimentStock(batimentId),
    enabled: !!batimentId,
    staleTime: 1 * 60 * 1000
  })
}

/**
 * Hook pour attribuer des portes (mutation)
 */
export function useAttribuerPortes() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: attribuerPortes,
    onSuccess: (data, variables) => {
      // Invalider les caches concernés
      queryClient.invalidateQueries({ queryKey: ['types-portes'] })
      queryClient.invalidateQueries({ queryKey: ['attributions', 'client', variables.clientId] })
      queryClient.invalidateQueries({ queryKey: ['client-summary', variables.clientId] })
      queryClient.invalidateQueries({ queryKey: ['batiment-stock'] })
    }
  })
}

/**
 * Hook pour résilier une attribution (mutation)
 */
export function useResilierAttribution() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ attributionId, dateFin, motif }) => 
      resilierAttribution(attributionId, dateFin, motif),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attributions'] })
      queryClient.invalidateQueries({ queryKey: ['client-summary'] })
      queryClient.invalidateQueries({ queryKey: ['batiment-stock'] })
      queryClient.invalidateQueries({ queryKey: ['types-portes'] })
    }
  })
}

/**
 * Hook pour créer/modifier un type de porte (mutation)
 */
export function useUpsertTypePorte() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: ({ batimentId, typePorte }) => upsertTypePorte(batimentId, typePorte),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['types-portes', variables.batimentId] })
      queryClient.invalidateQueries({ queryKey: ['batiment-stock', variables.batimentId] })
    }
  })
}

// ═══════════════════════════════════════════════════════════════════
// REALTIME SUBSCRIPTIONS (remplace Supabase Realtime StreamProvider)
// ═══════════════════════════════════════════════════════════════════

/**
 * Hook pour écouter les changements temps réel
 * @param {string} table - 'type_portes' | 'attributions'
 * @param {Function} onChange - Callback
 */
export function usePortesRealtime(table, onChange) {
  const queryClient = useQueryClient()
  
  useEffect(() => {
    const subscription = supabase
      .channel(`${table}_changes`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        console.log(`[Realtime] ${table}:`, payload)
        
        // Invalider le cache pour forcer le refetch
        if (table === 'type_portes') {
          queryClient.invalidateQueries({ queryKey: ['types-portes'] })
          queryClient.invalidateQueries({ queryKey: ['batiment-stock'] })
        }
        if (table === 'attributions') {
          queryClient.invalidateQueries({ queryKey: ['attributions'] })
          queryClient.invalidateQueries({ queryKey: ['client-summary'] })
        }
        
        if (onChange) onChange(payload)
      })
      .subscribe()
    
    return () => {
      supabase.removeChannel(subscription)
    }
  }, [table, onChange, queryClient])
}

