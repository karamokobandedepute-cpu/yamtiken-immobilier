import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { addSentryBreadcrumb, captureError } from '../lib/sentry'

/**
 * Hook pour gérer les alertes automatiques de gestion immobilière
 * 
 * Types d'alertes :
 * - BAIL_EXPIRE_30 : Bail expire dans 30 jours
 * - BAIL_EXPIRE_60 : Bail expire dans 60 jours
 * - BAIL_EXPIRE_90 : Bail expire dans 90 jours
 * - LOYER_RETARD_5 : Loyer en retard depuis 5 jours
 * - LOYER_RETARD_15 : Loyer en retard depuis 15 jours
 * - LOYER_RETARD_30 : Loyer en retard depuis 30 jours
 * - BIEN_VACANT_30 : Bien vacant depuis 30 jours
 * - BIEN_VACANT_60 : Bien vacant depuis 60 jours
 * - BIEN_VACANT_90 : Bien vacant depuis 90 jours
 */

const TYPES_ALERTES = {
  // Baux
  BAIL_EXPIRE_30: { label: 'Bail expire dans 30 jours', severity: 'warning', icon: '⏰' },
  BAIL_EXPIRE_60: { label: 'Bail expire dans 60 jours', severity: 'info', icon: '📅' },
  BAIL_EXPIRE_90: { label: 'Bail expire dans 90 jours', severity: 'info', icon: '📆' },
  
  // Loyers
  LOYER_RETARD_5: { label: 'Loyer en retard (5 jours)', severity: 'warning', icon: '⚠️' },
  LOYER_RETARD_15: { label: 'Loyer en retard (15 jours)', severity: 'danger', icon: '🚨' },
  LOYER_RETARD_30: { label: 'Loyer en retard (30+ jours)', severity: 'danger', icon: '❌' },
  
  // Biens vacants
  BIEN_VACANT_30: { label: 'Bien vacant (30 jours)', severity: 'info', icon: '🏠' },
  BIEN_VACANT_60: { label: 'Bien vacant (60 jours)', severity: 'warning', icon: '🏚️' },
  BIEN_VACANT_90: { label: 'Bien vacant (90+ jours)', severity: 'danger', icon: '⚡' },
}

export const useAlertes = ({ enabled = true, autoRefresh = true } = {}) => {
  const [alertes, setAlertes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState({
    total: 0,
    danger: 0,
    warning: 0,
    info: 0
  })

  /**
   * Calculer les dates de référence
   */
  const getDates = () => {
    const now = new Date()
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
    const ago5Days = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
    const ago15Days = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000)
    const ago30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    return {
      now: now.toISOString().split('T')[0],
      in30: in30Days.toISOString().split('T')[0],
      in60: in60Days.toISOString().split('T')[0],
      in90: in90Days.toISOString().split('T')[0],
      ago5: ago5Days.toISOString().split('T')[0],
      ago15: ago15Days.toISOString().split('T')[0],
      ago30: ago30Days.toISOString().split('T')[0],
    }
  }

  /**
   * Récupérer les baux qui expirent
   */
  const fetchBauxExpirants = async (dates) => {
    try {
      const { data, error } = await supabase
        .from('contrats')
        .select(`
          id,
          date_fin,
          montant_loyer,
          statut,
          bien:biens(id, nom, adresse),
          locataire:clients(id, nom, prenom, telephone, email)
        `)
        .eq('statut', 'ACTIF')
        .gte('date_fin', dates.now)
        .lte('date_fin', dates.in90)
        .order('date_fin', { ascending: true })

      if (error) throw error

      const alertesBaux = []

      data?.forEach(contrat => {
        const dateFin = new Date(contrat.date_fin)
        const joursRestants = Math.ceil((dateFin - new Date()) / (1000 * 60 * 60 * 24))

        let type
        if (joursRestants <= 30) type = 'BAIL_EXPIRE_30'
        else if (joursRestants <= 60) type = 'BAIL_EXPIRE_60'
        else if (joursRestants <= 90) type = 'BAIL_EXPIRE_90'

        if (type) {
          alertesBaux.push({
            id: `bail-${contrat.id}`,
            type,
            ...TYPES_ALERTES[type],
            titre: `Bail expire le ${new Date(contrat.date_fin).toLocaleDateString('fr-FR')}`,
            description: `${contrat.locataire?.nom} ${contrat.locataire?.prenom || ''} - ${contrat.bien?.nom}`,
            data: {
              contrat_id: contrat.id,
              bien_id: contrat.bien?.id,
              bien_nom: contrat.bien?.nom,
              locataire_nom: `${contrat.locataire?.nom} ${contrat.locataire?.prenom || ''}`,
              date_fin: contrat.date_fin,
              jours_restants: joursRestants,
              montant: contrat.montant_loyer
            },
            date: contrat.date_fin,
            vu: false
          })
        }
      })

      return alertesBaux
    } catch (err) {
      console.error('[useAlertes] Erreur baux expirants:', err)
      captureError(err, { context: 'fetchBauxExpirants' })
      return []
    }
  }

  /**
   * Récupérer les loyers en retard
   */
  const fetchLoyersRetard = async (dates) => {
    try {
      const { data, error } = await supabase
        .from('paiements')
        .select(`
          id,
          date_echeance,
          date_paiement,
          montant,
          statut,
          contrat:contrats(
            id,
            montant_loyer,
            bien:biens(id, nom, adresse),
            locataire:clients(id, nom, prenom, telephone, email)
          )
        `)
        .in('statut', ['EN_ATTENTE', 'RETARD'])
        .is('date_paiement', null)
        .lte('date_echeance', dates.now)
        .order('date_echeance', { ascending: true })

      if (error) throw error

      const alertesLoyers = []

      data?.forEach(paiement => {
        const dateEcheance = new Date(paiement.date_echeance)
        const joursRetard = Math.ceil((new Date() - dateEcheance) / (1000 * 60 * 60 * 24))

        let type
        if (joursRetard >= 30) type = 'LOYER_RETARD_30'
        else if (joursRetard >= 15) type = 'LOYER_RETARD_15'
        else if (joursRetard >= 5) type = 'LOYER_RETARD_5'

        if (type) {
          alertesLoyers.push({
            id: `loyer-${paiement.id}`,
            type,
            ...TYPES_ALERTES[type],
            titre: `Loyer impayé depuis ${joursRetard} jours`,
            description: `${paiement.contrat?.locataire?.nom} ${paiement.contrat?.locataire?.prenom || ''} - ${paiement.contrat?.bien?.nom}`,
            data: {
              paiement_id: paiement.id,
              contrat_id: paiement.contrat?.id,
              bien_id: paiement.contrat?.bien?.id,
              bien_nom: paiement.contrat?.bien?.nom,
              locataire_nom: `${paiement.contrat?.locataire?.nom} ${paiement.contrat?.locataire?.prenom || ''}`,
              locataire_telephone: paiement.contrat?.locataire?.telephone,
              date_echeance: paiement.date_echeance,
              jours_retard: joursRetard,
              montant: paiement.montant
            },
            date: paiement.date_echeance,
            vu: false
          })
        }
      })

      return alertesLoyers
    } catch (err) {
      console.error('[useAlertes] Erreur loyers retard:', err)
      captureError(err, { context: 'fetchLoyersRetard' })
      return []
    }
  }

  /**
   * Récupérer les biens vacants
   */
  const fetchBiensVacants = async (dates) => {
    try {
      // Récupérer tous les biens
      const { data: biens, error: biensError } = await supabase
        .from('biens')
        .select('id, nom, adresse, statut, date_creation')
        .eq('statut', 'DISPONIBLE')

      if (biensError) throw biensError

      // Pour chaque bien, vérifier s'il a un contrat actif
      const alertesBiens = []

      for (const bien of biens || []) {
        const { data: contrats, error: contratsError } = await supabase
          .from('contrats')
          .select('id, date_fin')
          .eq('bien_id', bien.id)
          .eq('statut', 'ACTIF')
          .limit(1)

        if (contratsError) continue

        // Si pas de contrat actif, le bien est vacant
        if (!contrats || contrats.length === 0) {
          // Chercher le dernier contrat pour savoir depuis quand c'est vacant
          const { data: dernierContrat } = await supabase
            .from('contrats')
            .select('date_fin')
            .eq('bien_id', bien.id)
            .order('date_fin', { ascending: false })
            .limit(1)

          const dateVacance = dernierContrat?.[0]?.date_fin 
            ? new Date(dernierContrat[0].date_fin)
            : new Date(bien.date_creation)

          const joursVacant = Math.ceil((new Date() - dateVacance) / (1000 * 60 * 60 * 24))

          let type
          if (joursVacant >= 90) type = 'BIEN_VACANT_90'
          else if (joursVacant >= 60) type = 'BIEN_VACANT_60'
          else if (joursVacant >= 30) type = 'BIEN_VACANT_30'

          if (type) {
            alertesBiens.push({
              id: `vacant-${bien.id}`,
              type,
              ...TYPES_ALERTES[type],
              titre: `Bien vacant depuis ${joursVacant} jours`,
              description: bien.nom,
              data: {
                bien_id: bien.id,
                bien_nom: bien.nom,
                adresse: bien.adresse,
                jours_vacant: joursVacant,
                date_vacance: dateVacance.toISOString().split('T')[0]
              },
              date: dateVacance.toISOString().split('T')[0],
              vu: false
            })
          }
        }
      }

      return alertesBiens
    } catch (err) {
      console.error('[useAlertes] Erreur biens vacants:', err)
      captureError(err, { context: 'fetchBiensVacants' })
      return []
    }
  }

  /**
   * Charger toutes les alertes
   */
  const loadAlertes = useCallback(async () => {
    if (!enabled) return

    try {
      setLoading(true)
      setError(null)

      addSentryBreadcrumb('Chargement alertes', 'data', 'info')

      const dates = getDates()

      // Charger toutes les alertes en parallèle
      const [bauxExpirants, loyersRetard, biensVacants] = await Promise.all([
        fetchBauxExpirants(dates),
        fetchLoyersRetard(dates),
        fetchBiensVacants(dates)
      ])

      // Combiner et trier par date
      const toutesAlertes = [
        ...bauxExpirants,
        ...loyersRetard,
        ...biensVacants
      ].sort((a, b) => new Date(a.date) - new Date(b.date))

      // Calculer les stats
      const newStats = {
        total: toutesAlertes.length,
        danger: toutesAlertes.filter(a => a.severity === 'danger').length,
        warning: toutesAlertes.filter(a => a.severity === 'warning').length,
        info: toutesAlertes.filter(a => a.severity === 'info').length
      }

      setAlertes(toutesAlertes)
      setStats(newStats)

      console.log(`[useAlertes] ${toutesAlertes.length} alertes chargées`, newStats)
    } catch (err) {
      console.error('[useAlertes] Erreur chargement:', err)
      setError(err)
      captureError(err, { context: 'loadAlertes' })
    } finally {
      setLoading(false)
    }
  }, [enabled])

  /**
   * Marquer une alerte comme vue
   */
  const marquerVu = useCallback((alerteId) => {
    setAlertes(prev => 
      prev.map(alerte => 
        alerte.id === alerteId 
          ? { ...alerte, vu: true }
          : alerte
      )
    )

    // Sauvegarder dans localStorage
    const vues = JSON.parse(localStorage.getItem('alertes-vues') || '[]')
    if (!vues.includes(alerteId)) {
      vues.push(alerteId)
      localStorage.setItem('alertes-vues', JSON.stringify(vues))
    }
  }, [])

  /**
   * Marquer toutes les alertes comme vues
   */
  const marquerToutVu = useCallback(() => {
    const ids = alertes.map(a => a.id)
    setAlertes(prev => prev.map(a => ({ ...a, vu: true })))
    localStorage.setItem('alertes-vues', JSON.stringify(ids))
  }, [alertes])

  /**
   * Filtrer les alertes
   */
  const filtrerAlertes = useCallback((filters = {}) => {
    let filtered = [...alertes]

    if (filters.severity) {
      filtered = filtered.filter(a => a.severity === filters.severity)
    }

    if (filters.type) {
      filtered = filtered.filter(a => a.type === filters.type)
    }

    if (filters.bien_id) {
      filtered = filtered.filter(a => a.data.bien_id === filters.bien_id)
    }

    if (filters.nonVues) {
      filtered = filtered.filter(a => !a.vu)
    }

    return filtered
  }, [alertes])

  // Charger au montage
  useEffect(() => {
    loadAlertes()
  }, [loadAlertes])

  // Auto-refresh toutes les 5 minutes
  useEffect(() => {
    if (!autoRefresh || !enabled) return

    const interval = setInterval(() => {
      loadAlertes()
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(interval)
  }, [autoRefresh, enabled, loadAlertes])

  // Restaurer les alertes vues depuis localStorage
  useEffect(() => {
    const vues = JSON.parse(localStorage.getItem('alertes-vues') || '[]')
    if (vues.length > 0) {
      setAlertes(prev => 
        prev.map(alerte => ({
          ...alerte,
          vu: vues.includes(alerte.id)
        }))
      )
    }
  }, [alertes.length])

  return {
    alertes,
    loading,
    error,
    stats,
    refetch: loadAlertes,
    marquerVu,
    marquerToutVu,
    filtrerAlertes,
    typesAlertes: TYPES_ALERTES
  }
}

export default useAlertes
