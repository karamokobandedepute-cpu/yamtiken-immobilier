/**
 * HEALTH CHECK SYSTEM - Vérification santé backend
 * Évite les toasts en cascade et fournit un état global de connexion
 */

import { useState, useEffect } from 'react'
import { supabase } from './supabase'

class HealthCheck {
  constructor() {
    this.isOnline = true
    this.lastCheck = null
    this.checkInterval = null
    this.subscribers = []
    this.consecutiveFailures = 0
    this.maxFailures = 3
    this.silenceErrors = false // Mode silence après erreur
    this.silenceTimeout = null
  }

  /**
   * Démarrer la surveillance
   */
  start() {
    if (this.checkInterval) return
    
    // Check immédiat
    this.check()
    
    // Puis toutes les 30 secondes
    this.checkInterval = setInterval(() => this.check(), 30000)
    
    // Écouter les événements online/offline du navigateur
    window.addEventListener('online', () => {
      this.isOnline = true
      this.consecutiveFailures = 0
      this.silenceErrors = false
      this.notifySubscribers()
      this.check() // Vérifier immédiatement quand le réseau revient
    })
    
    window.addEventListener('offline', () => {
      this.isOnline = false
      this.notifySubscribers()
    })
  }

  /**
   * Arrêter la surveillance
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  /**
   * Vérifier la connexion au backend
   */
  async check() {
    try {
      // ⚡ FIX Bug #5: Ne pas requêter .from('clients') ici — cela invalide
      // le cache React Query et déclenche un refetch /api/clients en boucle.
      // On utilise uniquement le endpoint /api/health (léger, pas de table).
      const apiBase = import.meta.env.PROD
        ? (import.meta.env.VITE_API_URL || '/api')
        : '/api'
      const healthUrl = `${String(apiBase).replace(/\/$/, '')}/health`
      const response = await fetch(healthUrl, {
        method: 'HEAD',
        cache: 'no-store',
        signal: AbortSignal.timeout(5000)
      })
      
      if (response.ok) {
        this.consecutiveFailures = 0
        if (!this.isOnline) {
          this.isOnline = true
          this.notifySubscribers()
        }
        return true
      }
      
      throw new Error('Health check failed')
      
    } catch (error) {
      this.consecutiveFailures++
      
      if (this.consecutiveFailures >= this.maxFailures && this.isOnline) {
        this.isOnline = false
        this.notifySubscribers()
      }
      
      return false
    }
  }

  /**
   * S'abonner aux changements d'état
   */
  subscribe(callback) {
    this.subscribers.push(callback)
    // Appeler immédiatement avec l'état actuel
    callback(this.isOnline)
    
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback)
    }
  }

  /**
   * Notifier tous les abonnés
   */
  notifySubscribers() {
    this.subscribers.forEach(cb => cb(this.isOnline))
  }

  /**
   * Activer le mode silence (pas de toasts pendant X secondes)
   */
  enableSilence(duration = 10000) {
    this.silenceErrors = true
    
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout)
    }
    
    this.silenceTimeout = setTimeout(() => {
      this.silenceErrors = false
    }, duration)
  }

  /**
   * Vérifier si on doit afficher un toast d'erreur
   */
  shouldShowError() {
    return !this.silenceErrors
  }

  /**
   * Forcer un check immédiat
   */
  async forceCheck() {
    return this.check()
  }
}

// Singleton exporté
export const healthCheck = new HealthCheck()

// Hook React pour utiliser le health check
export function useHealthCheck() {
  const [isOnline, setIsOnline] = useState(healthCheck.isOnline)
  
  useEffect(() => {
    const unsubscribe = healthCheck.subscribe(setIsOnline)
    healthCheck.start()
    
    return () => {
      unsubscribe()
    }
  }, [])
  
  return { 
    isOnline, 
    forceCheck: () => healthCheck.forceCheck(),
    enableSilence: (duration) => healthCheck.enableSilence(duration)
  }
}

export default healthCheck
