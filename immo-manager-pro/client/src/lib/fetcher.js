import { supabase } from './supabase';

export const fetcher = async (table, select = '*') => {
  const { data, error } = await supabase
    .from(table)
    .select(select)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data ?? [];
};
