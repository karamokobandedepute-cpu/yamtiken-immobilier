import useSWR from 'swr';
import { fetcher } from '../lib/fetcher';
import { supabase } from '../lib/supabase';

export function useSupabaseData(table, select = '*') {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    table,
    () => fetcher(table, select),
  );

  // Ajouter un élément (Optimistic UI)
  const addItem = async (newItem) => {
    const optimisticData = [...(data ?? []), { ...newItem, id: 'temp-' + Date.now() }];
    mutate(optimisticData, false); // Affiche immédiatement sans attendre Supabase
    try {
      const { error } = await supabase.from(table).insert(newItem);
      if (error) throw error;
      mutate(); // Rafraîchit depuis Supabase pour avoir le vrai ID
    } catch (err) {
      mutate(data, false); // Annule si erreur
      throw err;
    }
  };

  // Modifier un élément (Optimistic UI)
  const updateItem = async (id, updates) => {
    const optimisticData = (data ?? []).map((item) =>
      item.id === id ? { ...item, ...updates } : item
    );
    mutate(optimisticData, false);
    try {
      const { error } = await supabase.from(table).update(updates).eq('id', id);
      if (error) throw error;
      mutate();
    } catch (err) {
      mutate(data, false);
      throw err;
    }
  };

  // Supprimer un élément (Optimistic UI)
  const deleteItem = async (id) => {
    const optimisticData = (data ?? []).filter((item) => item.id !== id);
    mutate(optimisticData, false);
    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      mutate();
    } catch (err) {
      mutate(data, false);
      throw err;
    }
  };

  return {
    data: data ?? [],
    isLoading,      // true seulement au tout premier chargement
    isRefreshing: isValidating && !isLoading, // true lors des rafraîchissements silencieux
    error,
    addItem,
    updateItem,
    deleteItem,
    refresh: mutate,
  };
}
