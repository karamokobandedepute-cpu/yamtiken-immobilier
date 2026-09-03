import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

// Hook pour détecter les doublons avant insertion
export const useDuplicateDetection = (table, fields = []) => {
  const [duplicates, setDuplicates] = useState([]);
  const [isChecking, setIsChecking] = useState(false);

  const checkDuplicates = async (data) => {
    setIsChecking(true);
    try {
      // Construire la requête de recherche de doublons
      let query = supabase.from(table).select('*');

      // Ajouter les conditions pour chaque champ
      fields.forEach(field => {
        if (data[field]) {
          query = query.or(`${field}.eq.${data[field]}`);
        }
      });

      const { data: existingRecords, error } = await query;

      if (error) throw error;

      if (existingRecords && existingRecords.length > 0) {
        setDuplicates(existingRecords);
        return {
          hasDuplicates: true,
          duplicates: existingRecords,
          message: `${existingRecords.length} doublon(s) potentiel(s) détecté(s)`
        };
      }

      setDuplicates([]);
      return {
        hasDuplicates: false,
        duplicates: [],
        message: 'Aucun doublon détecté'
      };
    } catch (error) {
      console.error('Erreur vérification doublons:', error);
      return {
        hasDuplicates: false,
        duplicates: [],
        error: error.message
      };
    } finally {
      setIsChecking(false);
    }
  };

  return {
    duplicates,
    isChecking,
    checkDuplicates
  };
};

// Hook pour ajouter automatiquement timestamp et différenciation
export const useTimestampedData = () => {
  const addTimestamps = (data, isUpdate = false) => {
    const now = new Date().toISOString();
    
    if (isUpdate) {
      return {
        ...data,
        updated_at: now,
        derniere_modification: now
      };
    }

    return {
      ...data,
      created_at: now,
      updated_at: now,
      date_creation: now,
      derniere_modification: now
    };
  };

  const generateUniqueIdentifier = (baseData) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `${baseData}_${timestamp}_${random}`;
  };

  return {
    addTimestamps,
    generateUniqueIdentifier
  };
};

// Fonction utilitaire pour comparer deux objets et trouver les différences
export const findDifferences = (obj1, obj2, ignoreFields = ['id', 'created_at', 'updated_at']) => {
  const differences = [];
  
  const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
  
  allKeys.forEach(key => {
    if (ignoreFields.includes(key)) return;
    
    if (obj1[key] !== obj2[key]) {
      differences.push({
        field: key,
        oldValue: obj1[key],
        newValue: obj2[key]
      });
    }
  });
  
  return differences;
};

// Fonction pour formater la différence de temps
export const formatTimeDifference = (date1, date2) => {
  const diff = Math.abs(new Date(date1) - new Date(date2));
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `il y a ${days} jour${days > 1 ? 's' : ''}`;
  if (hours > 0) return `il y a ${hours} heure${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `il y a ${minutes} minute${minutes > 1 ? 's' : ''}`;
  return `il y a ${seconds} seconde${seconds > 1 ? 's' : ''}`;
};
