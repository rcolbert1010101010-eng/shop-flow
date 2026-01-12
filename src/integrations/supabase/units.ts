import { Unit } from '@/types';
import { supabase } from './client';

export async function fetchUnits(): Promise<Unit[]> {
  if (!supabase) {
    // App can run in offline/mock mode without a configured backend
    return [];
  }

  const { data, error } = await supabase
    .from('units')
    .select('*')
    .order('unit_name', { ascending: true });

  if (error) {
    console.error('Error fetching units', error);
    throw new Error(error.message ?? 'Failed to load units');
  }

  return (data ?? []) as Unit[];
}

