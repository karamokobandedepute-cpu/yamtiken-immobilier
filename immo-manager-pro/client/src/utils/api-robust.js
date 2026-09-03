/**
 * API CLIENT ROBUSTE
 * Gère automatiquement les erreurs de connexion et les retries
 */

import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? 'http://54.36.209.70:5000/api' : 'http://localhost:5000/api');

// Créer une instance axios avec configuration par défaut
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercepteur pour gérer les erreurs avec retry automatique
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Si pas de config, rejeter immédiatement
    if (!originalRequest) {
      return Promise.reject(error);
    }
    
    // Marquer la requête comme retry si pas déjà fait
    if (!originalRequest._retry) {
      originalRequest._retry = true;
      
      // Vérifier si c'est une erreur réseau
      const isNetworkError = !error.response || error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK';
      
      if (isNetworkError) {
        console.warn('⚠️ Erreur réseau détectée, tentative de reconnexion...');
        
        // Attendre 2 secondes avant retry
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          // Retenter la requête
          return await api(originalRequest);
        } catch (retryError) {
          // Si le retry échoue aussi, afficher un message user-friendly
          if (!window.__serverErrorShown) {
            window.__serverErrorShown = true;
            toast.error('Connexion au serveur instable. Vérification en cours...', {
              duration: 3000,
              id: 'server-error'
            });
            
            // Réinitialiser le flag après 10 secondes
            setTimeout(() => {
              window.__serverErrorShown = false;
            }, 10000);
          }
          
          return Promise.reject(retryError);
        }
      }
    }
    
    // Gérer les erreurs 401 (non autorisé)
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
      toast.error('Session expirée. Veuillez vous reconnecter.');
    }
    
    // Gérer les erreurs 403 (interdit)
    if (error.response?.status === 403) {
      toast.error('Vous n\'avez pas les permissions nécessaires');
    }
    
    // Gérer les erreurs 500+ (serveur)
    if (error.response?.status >= 500) {
      toast.error('Erreur serveur. L\'équipe technique a été notifiée.');
    }
    
    return Promise.reject(error);
  }
);

export default api;
