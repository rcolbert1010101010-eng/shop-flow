import { Customer } from '@/types';
import { supabase } from './client';

export interface CreateCustomerInput {
  company_name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
}

const normalizeOptionalField = (value?: string | null) => {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export async function fetchCustomers(): Promise<Customer[]> {
  if (!supabase) {
    // App can run in offline/mock mode without a configured backend
    return [];
  }

  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .order('company_name', { ascending: true });

  if (error) {
    console.error('Error fetching customers', error);
    throw new Error(error.message ?? 'Failed to load customers');
  }

  return (data ?? []) as Customer[];
}

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  if (!supabase) {
    throw new Error('Backend not configured');
  }

  const payload = {
    company_name: input.company_name.trim(),
    contact_name: normalizeOptionalField(input.contact_name),
    phone: normalizeOptionalField(input.phone),
    email: normalizeOptionalField(input.email),
    address: normalizeOptionalField(input.address),
    notes: normalizeOptionalField(input.notes),
  };

  const { data, error } = await supabase.from('customers').insert(payload).select('*').single();

  if (error) {
    console.error('Error creating customer', error);
    throw new Error(error.message ?? 'Failed to create customer');
  }

  return data as Customer;
}

