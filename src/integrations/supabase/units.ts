import { Unit } from '@/types';
import { supabase } from './client';

export type UnitType = {
  id: string;
  tenant_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
};

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

export async function listUnitTypes(options?: { includeInactive?: boolean }): Promise<UnitType[]> {
  if (!supabase) {
    return [];
  }

  let query = supabase.from('unit_types').select('*').order('name', { ascending: true });

  if (!options?.includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching unit types', error);
    throw new Error(error.message ?? 'Failed to load unit types');
  }

  return (data ?? []) as UnitType[];
}

export async function createUnitType(name: string): Promise<UnitType> {
  if (!supabase) {
    throw new Error('Backend not configured');
  }

  const { data, error } = await supabase
    .from('unit_types')
    .insert({
      name: name.trim(),
      is_active: true,
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error creating unit type', error);
    throw new Error(error.message ?? 'Failed to create unit type');
  }

  return data as UnitType;
}

export async function updateUnitType(id: string, name: string): Promise<UnitType> {
  if (!supabase) {
    throw new Error('Backend not configured');
  }

  const { data, error } = await supabase
    .from('unit_types')
    .update({ name: name.trim() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('Error updating unit type', error);
    throw new Error(error.message ?? 'Failed to update unit type');
  }

  return data as UnitType;
}

export async function setUnitTypeActive(id: string, is_active: boolean): Promise<UnitType> {
  if (!supabase) {
    throw new Error('Backend not configured');
  }

  const { data, error } = await supabase
    .from('unit_types')
    .update({ is_active })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('Error updating unit type status', error);
    throw new Error(error.message ?? 'Failed to update unit type');
  }

  return data as UnitType;
}

export async function ensureUnitTypesSeeded(): Promise<UnitType[]> {
  if (!supabase) {
    return [];
  }

  const { data: existing, error } = await supabase.from('unit_types').select('id').limit(1);

  if (error) {
    console.error('Error checking unit types', error);
    throw new Error(error.message ?? 'Failed to check unit types');
  }

  if (existing && existing.length > 0) {
    return listUnitTypes({ includeInactive: true });
  }

  const defaults = [
    'Truck',
    'Trailer',
    'Tractor',
    'Equipment',
    'Pickup',
    'Van',
    'Forklift',
    'Generator',
    'Other',
  ];

  const { data, error: insertError } = await supabase
    .from('unit_types')
    .insert(
      defaults.map((name) => ({
        name,
        is_active: true,
      }))
    )
    .select('*');

  if (insertError) {
    console.error('Error seeding unit types', insertError);
    throw new Error(insertError.message ?? 'Failed to seed unit types');
  }

  return (data ?? []) as UnitType[];
}

