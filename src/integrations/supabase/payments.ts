import { supabase } from './client';
import type {
  Payment,
  PaymentMethod,
  PaymentOrderType,
  PaymentStatus,
  PaymentSummary,
} from '@/types';

export type PaymentsFilter = {
  orderType?: PaymentOrderType;
  method?: PaymentMethod | string;
  startDate?: string; // ISO date inclusive
  endDate?: string; // ISO date inclusive
  includeVoided?: boolean;
};

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const mapPayment = (row: any): Payment => ({
  id: row.id,
  created_at: row.created_at,
  order_type: row.order_type,
  order_id: row.order_id,
  amount: toNumber(row.amount),
  method: row.method as PaymentMethod,
  reference: row.reference ?? null,
  notes: row.notes ?? null,
  voided_at: row.voided_at ?? null,
  void_reason: row.void_reason ?? null,
});

export async function fetchPayments(orderType: PaymentOrderType, orderId: string): Promise<Payment[]> {
  if (!supabase) {
    // App can run in offline/mock mode without a configured backend
    return [];
  }

  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('order_type', orderType)
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching payments', error);
    throw new Error(error.message ?? 'Failed to fetch payments');
  }

  return (data ?? []).map(mapPayment);
}

export async function recordPayment(input: {
  order_type: PaymentOrderType;
  order_id: string;
  amount: number;
  method: PaymentMethod;
  reference?: string | null;
  notes?: string | null;
}): Promise<Payment> {
  const { data, error } = await supabase
    .from('payments')
    .insert({
      order_type: input.order_type,
      order_id: input.order_id,
      amount: input.amount,
      method: input.method,
      reference: input.reference ?? null,
      notes: input.notes ?? null,
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error recording payment', error);
    throw new Error(error.message ?? 'Failed to record payment');
  }

  return mapPayment(data);
}

export async function voidPayment(id: string, reason?: string | null): Promise<Payment> {
  const { data, error } = await supabase
    .from('payments')
    .update({
      voided_at: new Date().toISOString(),
      void_reason: reason ?? null,
    })
    .eq('id', id)
    .is('voided_at', null)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('Error voiding payment', error);
    throw new Error(error.message ?? 'Failed to void payment');
  }

  if (!data) {
    throw new Error('Payment already voided or not found');
  }

  return mapPayment(data);
}

export const PAYMENT_EPSILON = 0.01;

export function computePaymentSummary(payments: Payment[] | undefined, orderTotal: number): PaymentSummary {
  const validPayments = (payments ?? []).filter((p) => !p.voided_at);
  const totalPaid = validPayments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);
  const rawBalance = toNumber(orderTotal) - totalPaid;
  const balanceDue = rawBalance > 0 ? rawBalance : 0;
  const isZeroish = Math.abs(rawBalance) <= PAYMENT_EPSILON;

  let status: PaymentStatus = 'UNPAID';
  if (totalPaid <= PAYMENT_EPSILON) {
    status = 'UNPAID';
  } else if (rawBalance > PAYMENT_EPSILON) {
    status = 'PARTIAL';
  } else if (isZeroish) {
    status = 'PAID';
  } else {
    status = 'OVERPAID';
  }

  return { totalPaid, balanceDue, status };
}

export async function fetchAllPayments(filter?: PaymentsFilter): Promise<Payment[]> {
  if (!supabase) {
    // App can run in offline/mock mode without a configured backend
    return [];
  }

  let query = supabase.from('payments').select('*');

  if (filter?.orderType) {
    query = query.eq('order_type', filter.orderType);
  }
  if (filter?.method) {
    query = query.eq('method', filter.method);
  }
  if (filter?.startDate) {
    query = query.gte('created_at', filter.startDate);
  }
  if (filter?.endDate) {
    query = query.lte('created_at', filter.endDate);
  }
  if (!filter?.includeVoided) {
    query = query.is('voided_at', null);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching payments', error);
    throw new Error(error.message ?? 'Failed to fetch payments');
  }

  return (data ?? []).map(mapPayment);
}
