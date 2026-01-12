import { supabase } from './client';

import type {
  Customer,
  ManufacturedProduct,
  ManufacturedProductOption,
  ManufacturingBuild,
  ManufacturingBuildSelectedOption,
  ManufacturedProductType,
  ManufacturingBuildStatus,
  ManufacturingProductBomItem,
} from '@/types';

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const mapProduct = (row: any): ManufacturedProduct => ({
  id: row.id,
  name: row.name,
  sku: row.sku,
  product_type: row.product_type,
  description: row.description ?? null,
  base_price: toNumber(row.base_price),
  estimatedLaborHours: toNumber(row.estimated_labor_hours),
  estimatedOverhead: toNumber(row.estimated_overhead),
  is_active: row.is_active ?? true,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const mapOption = (row: any): ManufacturedProductOption => ({
  id: row.id,
  product_id: row.product_id,
  name: row.name,
  option_type: row.option_type,
  price_delta: toNumber(row.price_delta),
  sort_order: Number(row.sort_order ?? 0),
  is_active: row.is_active ?? true,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const mapBuild = (
  row: any
): ManufacturingBuild & {
  product?: ManufacturedProduct;
  customer?: Pick<Customer, 'id' | 'company_name'>;
} => ({
  id: row.id,
  build_number: row.build_number,
  customer_id: row.customer_id ?? null,
  unit_id: row.unit_id ?? null,
  product_id: row.product_id,
  status: row.status,
  serial_number: row.serial_number ?? null,
  notes: row.notes ?? null,
  priority: (row.priority as ManufacturingBuild['priority']) ?? 'normal',
  promisedDate: row.promised_date ?? null,
  assignedTechnicianId: row.assigned_technician_id ?? null,
  internalJobNumber: row.internal_job_number ?? null,
  is_active: row.is_active ?? true,
  created_at: row.created_at,
  updated_at: row.updated_at,
  product: row.manufactured_products ? mapProduct(row.manufactured_products) : undefined,
  customer: row.customers
    ? { id: row.customers.id, company_name: row.customers.company_name }
    : undefined,
});

const mapSelectedOption = (row: any): ManufacturingBuildSelectedOption => ({
  id: row.id,
  build_id: row.build_id,
  option_id: row.option_id ?? null,
  option_name_snapshot: row.option_name_snapshot,
  price_delta_snapshot: toNumber(row.price_delta_snapshot),
  is_active: row.is_active ?? true,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const mapBomItem = (row: any): ManufacturingProductBomItem => ({
  id: row.id,
  productId: row.product_id,
  partId: row.part_id,
  quantity: toNumber(row.quantity),
  scrapFactor: toNumber(row.scrap_factor),
  notes: row.notes ?? null,
  partNumber: row.parts?.part_number,
  description: row.parts?.description,
  cost: typeof row.parts?.cost === 'number' ? row.parts.cost : toNumber(row.parts?.cost),
});

export type ManufacturingBuildFilters = {
  status?: ManufacturingBuildStatus;
  includeInactive?: boolean;
};

export type ManufacturingBuildWithRelations = ManufacturingBuild & {
  product?: ManufacturedProduct;
  customer?: Pick<Customer, 'id' | 'company_name'>;
};

const requireBackend = () => {
  if (!supabase) {
    throw new Error('Backend not configured');
  }
  return supabase;
};

export async function fetchManufacturedProducts({
  includeInactive = false,
  productType,
}: {
  includeInactive?: boolean;
  productType?: ManufacturedProductType;
} = {}) {
  if (!supabase) {
    // App can run in offline/mock mode without a configured backend
    return [];
  }

  let query = supabase.from('manufactured_products').select('*');

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }
  if (productType) {
    query = query.eq('product_type', productType);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapProduct);
}

export async function fetchManufacturedProduct(id: string) {
  const sb = requireBackend();
  const { data, error } = await sb
    .from('manufactured_products')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('Manufactured product not found');
  }

  return mapProduct(data);
}

export async function createManufacturedProduct(input: {
  name: string;
  sku: string;
  product_type: ManufacturedProductType;
  base_price: number;
  estimated_labor_hours?: number;
  estimatedLaborHours?: number;
  estimated_overhead?: number;
  estimatedOverhead?: number;
  description?: string | null;
  is_active?: boolean;
}) {
  const sb = requireBackend();
  const estimatedLabor = input.estimated_labor_hours ?? input.estimatedLaborHours ?? 0;
  const estimatedOverhead = input.estimated_overhead ?? input.estimatedOverhead ?? 0;
  const { data, error } = await sb
    .from('manufactured_products')
    .insert({
      name: input.name,
      sku: input.sku,
      product_type: input.product_type,
      base_price: input.base_price,
      estimated_labor_hours: estimatedLabor,
      estimated_overhead: estimatedOverhead,
      description: input.description ?? null,
      is_active: input.is_active ?? true,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapProduct(data);
}

export async function updateManufacturedProduct(
  id: string,
  patch: Partial<{
    name: string;
    sku: string;
    product_type: ManufacturedProductType;
    base_price: number;
    estimated_labor_hours: number;
    estimatedLaborHours: number;
    estimated_overhead: number;
    estimatedOverhead: number;
    description: string | null;
    is_active: boolean;
  }>
) {
  const sb = requireBackend();
  const {
    estimated_labor_hours,
    estimated_overhead,
    estimatedLaborHours,
    estimatedOverhead,
    ...rest
  } = patch as any;
  const estimatedLabor = estimated_labor_hours ?? estimatedLaborHours;
  const estimatedOverheadValue = estimated_overhead ?? estimatedOverhead;
  const payload: Record<string, any> = {
    ...rest,
    updated_at: new Date().toISOString(),
  };
  if (estimatedLabor !== undefined) payload.estimated_labor_hours = estimatedLabor;
  if (estimatedOverheadValue !== undefined) payload.estimated_overhead = estimatedOverheadValue;
  const { data, error } = await sb
    .from('manufactured_products')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return mapProduct(data);
}

export async function deactivateManufacturedProduct(id: string) {
  const { data, error } = await supabase
    .from('manufactured_products')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return mapProduct(data);
}

export async function fetchManufacturedProductOptions(productId: string) {
  const { data, error } = await supabase
    .from('manufactured_product_options')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapOption);
}

export async function createManufacturedProductOption(input: {
  product_id: string;
  name: string;
  option_type: string;
  price_delta: number;
  sort_order?: number;
  is_active?: boolean;
}) {
  const { data, error } = await supabase
    .from('manufactured_product_options')
    .insert({
      product_id: input.product_id,
      name: input.name,
      option_type: input.option_type,
      price_delta: input.price_delta,
      sort_order: input.sort_order ?? 0,
      is_active: input.is_active ?? true,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapOption(data);
}

export async function updateManufacturedProductOption(
  id: string,
  patch: Partial<{
    name: string;
    option_type: string;
    price_delta: number;
    sort_order: number;
    is_active: boolean;
  }>
) {
  const { data, error } = await supabase
    .from('manufactured_product_options')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return mapOption(data);
}

export async function deactivateManufacturedProductOption(id: string) {
  const { data, error } = await supabase
    .from('manufactured_product_options')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return mapOption(data);
}

export async function fetchManufacturingBuilds(filters: ManufacturingBuildFilters = {}) {
  let query = supabase
    .from('manufacturing_builds')
    .select(`
      *,
      manufactured_products (
        id,
        name,
        sku,
        product_type,
        base_price,
        is_active
      ),
      customers (
        id,
        company_name
      )
    `)
    .order('created_at', { ascending: false });

  if (!filters.includeInactive) {
    query = query.eq('is_active', true);
  }
  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []).map((row) => mapBuild(row));
}

export async function fetchManufacturingBuild(id: string) {
  const { data, error } = await supabase
    .from('manufacturing_builds')
    .select(`
      *,
      manufactured_products (
        id,
        name,
        sku,
        product_type,
        base_price,
        is_active
      ),
      customers (
        id,
        company_name
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('Manufacturing build not found');
  }

  return mapBuild(data);
}

export async function createManufacturingBuild(input: {
  build_number: string;
  product_id: string;
  customer_id?: string | null;
  unit_id?: string | null;
  status?: ManufacturingBuildStatus;
  notes?: string | null;
  priority?: ManufacturingBuild['priority'];
  promised_date?: string | null;
  promisedDate?: string | null;
  assigned_technician_id?: string | null;
  assignedTechnicianId?: string | null;
  internal_job_number?: string | null;
  internalJobNumber?: string | null;
}) {
  const priority = (input.priority as ManufacturingBuild['priority']) ?? 'normal';
  const promisedDate = input.promised_date ?? input.promisedDate ?? null;
  const assignedTechnicianId = input.assigned_technician_id ?? input.assignedTechnicianId ?? null;
  const internalJobNumber = input.internal_job_number ?? input.internalJobNumber ?? null;

  const { data, error } = await supabase
    .from('manufacturing_builds')
    .insert({
      build_number: input.build_number,
      product_id: input.product_id,
      customer_id: input.customer_id ?? null,
      unit_id: input.unit_id ?? null,
      status: input.status ?? 'ENGINEERING',
      notes: input.notes ?? null,
      priority,
      promised_date: promisedDate,
      assigned_technician_id: assignedTechnicianId,
      internal_job_number: internalJobNumber,
      is_active: true,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapBuild(data);
}

export async function updateManufacturingBuild(
  id: string,
  patch: Partial<{
    customer_id: string | null;
    unit_id: string | null;
    status: ManufacturingBuildStatus;
    notes: string | null;
    serial_number: string | null;
    priority: ManufacturingBuild['priority'];
    promised_date: string | null;
    promisedDate: string | null;
    assigned_technician_id: string | null;
    assignedTechnicianId: string | null;
    internal_job_number: string | null;
    internalJobNumber: string | null;
    is_active: boolean;
  }>
) {
  const {
    promised_date,
    promisedDate,
    assigned_technician_id,
    assignedTechnicianId,
    internal_job_number,
    internalJobNumber,
    ...rest
  } = patch as any;
  const payload: Record<string, any> = {
    ...rest,
    updated_at: new Date().toISOString(),
  };
  if (promised_date !== undefined || promisedDate !== undefined) {
    payload.promised_date = promised_date ?? promisedDate ?? null;
  }
  if (assigned_technician_id !== undefined || assignedTechnicianId !== undefined) {
    payload.assigned_technician_id = assigned_technician_id ?? assignedTechnicianId ?? null;
  }
  if (internal_job_number !== undefined || internalJobNumber !== undefined) {
    payload.internal_job_number = internal_job_number ?? internalJobNumber ?? null;
  }
  const { data, error } = await supabase
    .from('manufacturing_builds')
    .update(payload)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('Manufacturing build not found');
  }
  return mapBuild(data);
}

export async function deactivateManufacturingBuild(id: string) {
  const { data, error } = await supabase
    .from('manufacturing_builds')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return mapBuild(data);
}

export async function fetchManufacturingBuildSelectedOptions(buildId: string) {
  const { data, error } = await supabase
    .from('manufacturing_build_selected_options')
    .select('*')
    .eq('build_id', buildId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapSelectedOption);
}

export async function addManufacturingBuildSelectedOption(input: {
  build_id: string;
  option_id: string | null;
  option_name_snapshot: string;
  price_delta_snapshot: number;
}) {
  const { data, error } = await supabase
    .from('manufacturing_build_selected_options')
    .insert({
      build_id: input.build_id,
      option_id: input.option_id,
      option_name_snapshot: input.option_name_snapshot,
      price_delta_snapshot: input.price_delta_snapshot,
      is_active: true,
    })
    .select('*')
    .single();

  if (error) throw error;
  return mapSelectedOption(data);
}

export async function deactivateManufacturingBuildSelectedOption(id: string) {
  const { data, error } = await supabase
    .from('manufacturing_build_selected_options')
    .update({ is_active: false })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return mapSelectedOption(data);
}

export async function fetchProductBom(productId: string): Promise<ManufacturingProductBomItem[]> {
  const { data, error } = await supabase
    .from('manufacturing_product_boms')
    .select(
      `
      id,
      product_id,
      part_id,
      quantity,
      scrap_factor,
      notes,
      created_at,
      parts:part_id (
        part_number,
        description,
        cost
      )
    `
    )
    .eq('product_id', productId)
    .order('created_at', { ascending: true });

  if (error) {
    // If the table hasn't been created yet, Supabase can return 404; treat as empty BOM.
    if ((error as any)?.code === 'PGRST116' || error.message?.includes('not exist')) {
      console.warn('manufacturing_product_boms table missing; returning empty BOM');
      return [];
    }
    console.error('Error fetching product BOM', error);
    throw new Error(error.message ?? 'Failed to fetch product BOM');
  }

  return (data ?? []).map(mapBomItem);
}

export async function upsertProductBom(
  productId: string,
  items: ManufacturingProductBomItem[]
): Promise<ManufacturingProductBomItem[]> {
  const deleteResult = await supabase.from('manufacturing_product_boms').delete().eq('product_id', productId);
  if (deleteResult.error) {
    console.error('Error clearing existing BOM', deleteResult.error);
    throw new Error(deleteResult.error.message ?? 'Failed to replace BOM');
  }

  if (items.length === 0) {
    return [];
  }

  const payload = items.map((item) => ({
    product_id: productId,
    part_id: item.partId,
    quantity: item.quantity,
    scrap_factor: item.scrapFactor ?? 0,
    notes: item.notes ?? null,
  }));

  const { data, error } = await supabase
    .from('manufacturing_product_boms')
    .insert(payload)
    .select(
      `
      id,
      product_id,
      part_id,
      quantity,
      scrap_factor,
      notes,
      created_at,
      parts:part_id (
        part_number,
        description,
        cost
      )
    `
    )
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error saving product BOM', error);
    throw new Error(error.message ?? 'Failed to save BOM');
  }

  return (data ?? []).map(mapBomItem);
}

export async function computeProductMaterialCost(productId: string): Promise<number> {
  const bom = await fetchProductBom(productId);
  const total = bom.reduce((sum, item) => {
    const partCost = typeof item.cost === 'number' ? item.cost : toNumber(item.cost);
    const qty = toNumber(item.quantity);
    const scrap = toNumber(item.scrapFactor);
    return sum + partCost * qty * (1 + scrap);
  }, 0);
  return Number.isFinite(total) ? total : 0;
}
