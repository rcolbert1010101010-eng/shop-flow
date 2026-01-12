import { Part } from '@/types';
import { supabase } from './client';

export async function fetchParts(): Promise<Part[]> {
  if (!supabase) {
    // App can run in offline/mock mode without a configured backend
    return [];
  }

  const { data, error } = await supabase
    .from('parts')
    .select('*')
    .order('part_number', { ascending: true });

  if (error) {
    console.error('Error fetching parts', error);
    throw new Error(error.message ?? 'Failed to load parts');
  }

  return (data ?? []) as Part[];
}

