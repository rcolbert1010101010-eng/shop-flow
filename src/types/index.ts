// System Settings
export type PriceLevel = 'RETAIL' | 'FLEET' | 'WHOLESALE';
export type PaymentTerms = 'COD' | 'NET_15' | 'NET_30' | 'NET_45' | 'NET_60';
export type PreferredContactMethod = 'PHONE' | 'EMAIL';

export interface SystemSettings {
  id: string;
  shop_name: string;
  default_labor_rate: number;
  default_tax_rate: number;
  currency: string;
  units: string;
  markup_retail_percent: number;
  markup_fleet_percent: number;
  markup_wholesale_percent: number;
  session_user_name?: string;
  inventory_negative_qoh_policy?: NegativeInventoryPolicy;
  default_price_level?: 'retail' | 'fleet' | 'wholesale';
  minimum_margin_percent?: number;
  ai_enabled?: boolean;
  ai_confirm_risky_actions?: boolean;
  negative_inventory_policy?: 'warn' | 'block' | 'allow';
}

// Customer
export interface Customer {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  price_level: PriceLevel;
  payment_terms?: PaymentTerms;
  credit_limit?: number | null;
  credit_hold?: boolean;
  credit_hold_reason?: string | null;
  is_tax_exempt: boolean;
  tax_rate_override: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerContact {
  id: string;
  customer_id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
  preferred_method: PreferredContactMethod | null;
  created_at: string;
  updated_at: string;
}

// Unit / Equipment
export interface Unit {
  id: string;
  customer_id: string;
  unit_name: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  mileage: number | null;
  hours: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  customer?: Customer;
}

// Unit Attachment (images)
export type UnitAttachmentTag = 'BEFORE' | 'AFTER' | 'GENERAL';

export interface UnitAttachment {
  id: string;
  unit_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  local_url: string | null;
  tag: UnitAttachmentTag;
  notes: string | null;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Vendor
export interface Vendor {
  id: string;
  vendor_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Part Category
export interface PartCategory {
  id: string;
  category_name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Part / Inventory
export interface Part {
  id: string;
  part_number: string;
  description: string | null;
  vendor_id: string;
  category_id: string;
  cost: number;
  selling_price: number;
  quantity_on_hand: number;
  core_required: boolean;
  core_charge: number;
  min_qty: number | null;
  max_qty: number | null;
  bin_location: string | null;
  location: string | null;
  uom: 'EA' | 'FT' | 'SQFT';
  allow_fractional_qty: boolean;
  qty_precision: number;
  material_kind?: 'STANDARD' | 'SHEET';
  sheet_width_in?: number | null;
  sheet_length_in?: number | null;
  thickness_in?: number | null;
  grade?: string | null;
  is_remnant?: boolean;
  parent_part_id?: string | null;
  remnant_width_in?: number | null;
  remnant_length_in?: number | null;
  last_cost: number | null;
  avg_cost: number | null;
  model: string | null;
  serial_number: string | null;
  barcode: string | null;
  is_kit: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  vendor?: Vendor;
  category?: PartCategory;
}

export interface PartKitComponent {
  id: string;
  kit_part_id: string;
  component_part_id: string;
  quantity: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type InventoryMovementType = 'RECEIVE' | 'ISSUE' | 'RETURN' | 'ADJUST' | 'COUNT';
export type InventoryRefType = 'PURCHASE_ORDER' | 'WORK_ORDER' | 'SALES_ORDER' | 'CYCLE_COUNT' | 'MANUAL';
export type NegativeInventoryPolicy = 'ALLOW' | 'WARN' | 'BLOCK';

export interface InventoryMovement {
  id: string;
  part_id: string;
  movement_type: InventoryMovementType;
  qty_delta: number;
  reason: string | null;
  ref_type: InventoryRefType | null;
  ref_id: string | null;
  performed_by: string;
  performed_at: string;
}

export type CycleCountStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

export interface CycleCountSession {
  id: string;
  status: CycleCountStatus;
  title: string | null;
  notes: string | null;
  created_at: string;
  created_by: string;
  posted_at: string | null;
  posted_by: string | null;
  updated_at?: string | null;
}

export interface CycleCountLine {
  id: string;
  session_id: string;
  part_id: string;
  expected_qty: number;
  counted_qty: number;
  variance: number;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export type ManufacturedProductType = 'DUMP_BODY' | 'TRAILER' | 'CUSTOM_EQUIPMENT';

export interface ManufacturedProduct {
  id: string;
  name: string;
  sku: string;
  product_type: ManufacturedProductType;
  description: string | null;
  base_price: number;
  estimatedLaborHours: number;
  estimatedOverhead: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ManufacturedProductOption {
  id: string;
  product_id: string;
  name: string;
  option_type: string;
  price_delta: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ManufacturingProductBomItem {
  id: string;
  productId: string;
  partId: string;
  quantity: number;
  scrapFactor: number;
  notes?: string | null;
  partNumber?: string;
  description?: string;
  cost?: number;
}

export interface ManufacturingProductCostSummary {
  productId: string;
  materialCost: number;
  laborHours: number;
  laborRate: number;
  laborCost: number;
  overhead: number;
  totalEstimatedCost: number;
}

export type ManufacturingBuildStatus =
  | 'ENGINEERING'
  | 'FABRICATION'
  | 'ASSEMBLY'
  | 'PAINT'
  | 'QA'
  | 'READY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface ManufacturingBuild {
  id: string;
  build_number: string;
  customer_id: string | null;
  unit_id: string | null;
  product_id: string;
  status: ManufacturingBuildStatus;
  serial_number: string | null;
  notes: string | null;
  priority: 'low' | 'normal' | 'high' | 'rush';
  promisedDate?: string | null;
  assignedTechnicianId?: string | null;
  internalJobNumber?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ManufacturingBuildSelectedOption {
  id: string;
  build_id: string;
  option_id: string | null;
  option_name_snapshot: string;
  price_delta_snapshot: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type VendorCostSource = 'RECEIVING' | 'MANUAL';

export interface VendorCostHistory {
  id: string;
  part_id: string;
  vendor_id: string;
  unit_cost: number;
  quantity: number | null;
  source: VendorCostSource;
  created_at: string;
}

export interface InventoryAdjustment {
  id: string;
  part_id: string;
  old_qty: number;
  new_qty: number;
  delta: number;
  reason: string;
  adjusted_by: string;
  adjusted_at: string;
}

export interface TechnicianWorkSchedule {
  days: {
    mon: boolean;
    tue: boolean;
    wed: boolean;
    thu: boolean;
    fri: boolean;
    sat: boolean;
    sun: boolean;
  };
  start_time: string;
  end_time: string;
}

export interface TechnicianCertification {
  id: string;
  name: string;
  expires_on: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Technician
export interface Technician {
  id: string;
  name: string;
  hourly_cost_rate: number;
  default_billable_rate: number | null;
  employment_type: 'HOURLY' | 'SALARY' | 'CONTRACTOR';
  skill_tags: string[];
  work_schedule: TechnicianWorkSchedule;
  certifications: TechnicianCertification[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Time Entry (Technician Clock In/Out)
export interface TimeEntry {
  id: string;
  technician_id: string;
  work_order_id: string;
  clock_in: string;
  clock_out: string | null;
  total_minutes: number;
  created_at: string;
  updated_at: string;
  technician?: Technician;
  job_line_id?: string | null;
}

// Core Status
export type CoreStatus = 'CORE_OWED' | 'CORE_RETURNED' | 'CORE_CREDITED' | 'NOT_APPLICABLE';

// Sales Order Status
export type SalesOrderStatus = 'ESTIMATE' | 'OPEN' | 'PARTIAL' | 'COMPLETED' | 'CANCELLED' | 'INVOICED';

// Sales Order
export interface SalesOrder {
  id: string;
  order_number: string;
  customer_id: string;
  unit_id: string | null;
  status: SalesOrderStatus;
  notes: string | null;
  tax_rate: number;
  charge_subtotal?: number;
  subtotal: number;
  core_charges_total: number;
  tax_amount: number;
  total: number;
  invoiced_at: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  unit?: Unit;
  lines?: SalesOrderLine[];
}

// Sales Order Line
export interface SalesOrderLine {
  id: string;
  sales_order_id: string;
  part_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  is_warranty: boolean;
  core_charge: number;
  core_returned: boolean;
  core_status: CoreStatus;
  core_returned_at: string | null;
  core_refunded_at: string | null;
  is_core_refund_line: boolean;
  core_refund_for_line_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  part?: Part;
}

export type SalesOrderChargeSourceType = 'PLASMA_JOB' | 'MANUAL' | 'WORK_ORDER';

export interface SalesOrderChargeLine {
  id: string;
  sales_order_id: string;
  description: string;
  qty: number;
  unit_price: number;
  total_price: number;
  source_ref_type: SalesOrderChargeSourceType;
  source_ref_id: string;
  created_at: string;
  updated_at: string;
}

// Payments
export type PaymentOrderType = 'WORK_ORDER' | 'SALES_ORDER' | 'INVOICE';
export type PaymentMethod = 'cash' | 'check' | 'card' | 'ach' | 'other';
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERPAID';

export interface Payment {
  id: string;
  created_at: string;
  order_type: PaymentOrderType;
  order_id: string;
  amount: number;
  method: PaymentMethod;
  reference?: string | null;
  notes?: string | null;
  voided_at?: string | null;
  void_reason?: string | null;
}

export interface PaymentSummary {
  totalPaid: number;
  balanceDue: number;
  status: PaymentStatus;
}

export type InvoiceOrderType = 'WORK_ORDER' | 'SALES_ORDER';

export type InvoiceRow = {
  orderType: InvoiceOrderType;
  orderId: string;
  invoiceNumber: string;
  customerName: string;
  invoiceDate: string;
  orderTotal: number;
  totalPaid: number;
  balanceDue: number;
  paymentStatus: PaymentStatus;
};

// Fabrication Jobs
export type FabJobSourceType = 'STANDALONE' | 'WORK_ORDER';
export type FabOperationType = 'PRESS_BRAKE' | 'WELD';
export type FabJobStatus = 'DRAFT' | 'QUOTED' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'VOID';

export interface FabJob {
  id: string;
  source_type: FabJobSourceType;
  work_order_id?: string | null;
  sales_order_id?: string | null;
  status: FabJobStatus;
  notes?: string | null;
  posted_at?: string | null;
  posted_by?: string | null;
  calculated_at?: string | null;
  calc_version: number;
  created_at: string;
  updated_at: string;
  warnings?: string[] | null;
}

export interface FabJobLine {
  id: string;
  fab_job_id: string;
  operation_type: FabOperationType;
  qty: number;
  description?: string | null;
  notes?: string | null;
  material_type?: string | null;
  thickness?: number | null;
  bends_count?: number | null;
  bend_length?: number | null;
  setup_minutes?: number | null;
  machine_minutes?: number | null;
  derived_machine_minutes?: number | null;
  tooling?: string | null;
  tonnage_estimate?: number | null;
  weld_process?: 'MIG' | 'TIG' | 'STICK' | 'FLUX' | null;
  weld_length?: number | null;
  weld_type?: 'FILLET' | 'BUTT' | null;
  position?: string | null;
  override_machine_minutes?: boolean;
  override_consumables_cost?: boolean;
  override_labor_cost?: boolean;
  consumables_cost: number;
  labor_cost: number;
  overhead_cost: number;
  sell_price_each: number;
  sell_price_total: number;
  calc_version: number;
}

// Plasma Jobs
export type PlasmaJobSourceType = 'STANDALONE' | 'WORK_ORDER';
export type PlasmaJobStatus = 'DRAFT' | 'QUOTED' | 'APPROVED' | 'CUT' | 'COMPLETED' | 'VOID';

export interface PlasmaJob {
  id: string;
  source_type: PlasmaJobSourceType;
  work_order_id?: string | null;
  sales_order_id?: string | null;
  status: PlasmaJobStatus;
  notes?: string | null;
  calculated_at?: string | null;
  posted_at?: string | null;
  posted_by?: string | null;
  dxf_estimated_total_cut_length?: number | null;
  dxf_estimated_total_pierces?: number | null;
  dxf_estimated_machine_minutes?: number | null;
  dxf_notes?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface PlasmaTemplate {
  id: string;
  name: string;
  description?: string | null;
  default_material_type?: string | null;
  default_thickness?: number | null;
  created_at: string;
  updated_at: string;
}

export interface PlasmaTemplateLine {
  id: string;
  plasma_template_id: string;
  qty_default: number;
  cut_length_default?: number | null;
  pierce_count_default?: number | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type RemnantStatus = 'AVAILABLE' | 'CONSUMED';

export interface Remnant {
  id: string;
  label: string;
  material_type: string;
  thickness: number;
  width?: number | null;
  height?: number | null;
  notes?: string | null;
  status: RemnantStatus;
  created_at: string;
  updated_at: string;
}

export interface PlasmaJobLine {
  id: string;
  plasma_job_id: string;
  qty: number;
  material_type?: string | null;
  thickness?: number | null;
  cut_length?: number | null;
  pierce_count?: number | null;
  setup_minutes?: number | null;
  machine_minutes?: number | null;
  derived_machine_minutes?: number | null;
  overrides?: Record<string, number | null>;
  material_cost: number;
  consumables_cost: number;
  derived_consumables_cost?: number | null;
  labor_cost: number;
  overhead_cost: number;
  sell_price_each: number;
  sell_price_total: number;
  calc_version: number;
  override_machine_minutes?: boolean;
  override_consumables_cost?: boolean;
  remnant_id?: string | null;
}

export type PlasmaJobAttachmentKind = 'DXF' | 'PDF' | 'IMAGE' | 'OTHER';

export interface PlasmaJobAttachment {
  id: string;
  plasma_job_id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  kind: PlasmaJobAttachmentKind;
  notes?: string | null;
  local_url?: string | null;
  created_at: string;
  updated_at: string;
}

// Work Order Status
export type WorkOrderStatus = 'ESTIMATE' | 'OPEN' | 'IN_PROGRESS' | 'INVOICED';

export type WorkOrderChargeSourceType = 'PLASMA_JOB' | 'FAB_JOB' | 'MANUAL' | 'SALES_ORDER';

export interface WorkOrderChargeLine {
  id: string;
  work_order_id: string;
  description: string;
  qty: number;
  unit_price: number;
  total_price: number;
  source_ref_type: WorkOrderChargeSourceType;
  source_ref_id: string;
  created_at: string;
  updated_at: string;
}

export type WorkOrderJobStatus =
  | 'INTAKE'
  | 'DIAGNOSING'
  | 'ESTIMATING'
  | 'WAITING_APPROVAL'
  | 'WAITING_PARTS'
  | 'READY'
  | 'IN_PROGRESS'
  | 'QA'
  | 'COMPLETE'
  | 'WARRANTY';

export interface WorkOrderJobLine {
  id: string;
  work_order_id: string;
  title: string;
  complaint?: string | null;
  cause?: string | null;
  correction?: string | null;
  status: WorkOrderJobStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type WorkOrderJobPartsReadiness = 'OK' | 'RISK' | 'MISSING';

export interface WorkOrderJobPartsStatus {
  job_line_id: string;
  partsRequiredCount: number;
  partsMissingCount: number;
  partsRiskCount: number;
  readiness: WorkOrderJobPartsReadiness;
}

export interface WorkOrderTimeEntry {
  id: string;
  work_order_id: string;
  job_line_id: string;
  technician_id?: string | null;
  technician_name?: string | null;
  started_at: string;
  ended_at?: string | null;
  seconds: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export type WorkOrderActivityEventType =
  | 'JOB_CREATED'
  | 'JOB_UPDATED'
  | 'JOB_STATUS_CHANGED'
  | 'WO_INVOICED'
  | 'WO_STATUS_CHANGED'
  | 'CLOCK_IN'
  | 'CLOCK_OUT';

export interface WorkOrderActivityEvent {
  id: string;
  work_order_id: string;
  job_line_id?: string | null;
  type: WorkOrderActivityEventType;
  message: string;
  created_at: string;
  meta?: Record<string, unknown>;
}

// Work Order
export interface WorkOrder {
  id: string;
  order_number: string;
  customer_id: string;
  unit_id: string;
  status: WorkOrderStatus;
  notes: string | null;
  tax_rate: number;
  parts_subtotal: number;
  labor_subtotal: number;
  charge_subtotal?: number;
  core_charges_total: number;
  subtotal: number;
  tax_amount: number;
  total: number;
  labor_cost: number; // Internal cost tracking
  invoiced_at: string | null;
  created_at: string;
  updated_at: string;
  customer?: Customer;
  unit?: Unit;
  part_lines?: WorkOrderPartLine[];
  labor_lines?: WorkOrderLaborLine[];
  charge_lines?: WorkOrderChargeLine[];
}

// Work Order Part Line
export interface WorkOrderPartLine {
  id: string;
  work_order_id: string;
  part_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  is_warranty: boolean;
  core_charge: number;
  core_returned: boolean;
  core_status: CoreStatus;
  core_returned_at: string | null;
  core_refunded_at: string | null;
  is_core_refund_line: boolean;
  core_refund_for_line_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  part?: Part;
  job_line_id?: string | null;
}

// Work Order Labor Line
export interface WorkOrderLaborLine {
  id: string;
  work_order_id: string;
  description: string;
  hours: number;
  rate: number;
  line_total: number;
  is_warranty: boolean;
  technician_id: string | null;
  created_at: string;
  updated_at: string;
  job_line_id?: string | null;
}

// Scheduling
export type ScheduleItemStatus = 'ON_TRACK' | 'AT_RISK' | 'LATE' | 'IN_PROGRESS' | 'WAITING_APPROVAL' | 'WAITING_PARTS' | 'QA';

export type ScheduleBlockType = 'BREAK' | 'PTO' | 'MEETING' | 'FABRICATION';

export interface ScheduleItem {
  id: string;
  source_ref_type: 'WORK_ORDER' | 'BLOCK';
  source_ref_id: string;
  block_type: ScheduleBlockType | null;
  block_title: string | null;
  auto_scheduled: boolean;
  technician_id: string | null;
  start_at: string;
  duration_minutes: number;
  priority: 1 | 2 | 3 | 4 | 5;
  promised_at: string | null;
  parts_ready: boolean;
  status: ScheduleItemStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// Purchase Order Status
export type PurchaseOrderStatus = 'OPEN' | 'CLOSED';

// Purchase Order
export interface PurchaseOrder {
  id: string;
  po_number: string;
  vendor_id: string;
  status: PurchaseOrderStatus;
  sales_order_id?: string | null;
  work_order_id?: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  vendor?: Vendor;
  lines?: PurchaseOrderLine[];
}

// Return Status
export type ReturnStatus = 'DRAFT' | 'REQUESTED' | 'APPROVED' | 'SHIPPED' | 'RECEIVED' | 'CREDITED' | 'CLOSED' | 'CANCELLED';

export type ReturnLineCondition = 'NEW' | 'INSTALLED' | 'DEFECTIVE' | 'DAMAGED' | 'UNKNOWN';

// Return
export interface Return {
  id: string;
  vendor_id: string;
  purchase_order_id?: string | null;
  sales_order_id?: string | null;
  work_order_id?: string | null;
  status: ReturnStatus;
  reason: string | null;
  rma_number: string | null;
  carrier: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  received_at: string | null;
  credited_at: string | null;
  credit_amount: number | null;
  credit_memo_number: string | null;
  credit_memo_amount: number | null;
  credit_memo_date: string | null;
  reimbursed_amount: number | null;
  reimbursed_date: string | null;
  reimbursement_reference: string | null;
  approved_amount: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

// Return Line
export interface ReturnLine {
  id: string;
  return_id: string;
  part_id: string;
  purchase_order_line_id?: string | null;
  quantity: number;
  unit_cost: number | null;
  condition: ReturnLineCondition;
  reason: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

// Warranty
export type WarrantyClaimStatus = 'OPEN' | 'SUBMITTED' | 'APPROVED' | 'DENIED' | 'PAID' | 'CLOSED' | 'CANCELLED';

export interface WarrantyPolicy {
  id: string;
  vendor_id: string;
  default_labor_rate: number | null;
  labor_coverage_percent: number | null;
  parts_coverage_percent: number | null;
  days_covered: number | null;
  miles_covered: number | null;
  requires_rma: boolean;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WarrantyClaim {
  id: string;
  vendor_id: string;
  policy_id?: string | null;
  work_order_id?: string | null;
  sales_order_id?: string | null;
  purchase_order_id?: string | null;
  status: WarrantyClaimStatus;
  claim_number: string | null;
  rma_number: string | null;
  submitted_at: string | null;
  decided_at: string | null;
  paid_at: string | null;
  amount_requested: number | null;
  approved_amount: number | null;
  credit_memo_number: string | null;
  credit_memo_amount: number | null;
  credit_memo_date: string | null;
  reimbursed_amount: number | null;
  reimbursed_date: string | null;
  reimbursement_reference: string | null;
  reason: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WarrantyClaimLine {
  id: string;
  claim_id: string;
  part_id?: string | null;
  labor_line_id?: string | null;
  description?: string | null;
  quantity?: number | null;
  unit_cost?: number | null;
  labor_hours?: number | null;
  labor_rate?: number | null;
  amount?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Purchase Order Line
export interface PurchaseOrderLine {
  id: string;
  purchase_order_id: string;
  part_id: string;
  ordered_quantity: number;
  received_quantity: number;
  unit_cost: number; // Snapshotted at creation
  created_at: string;
  updated_at: string;
  part?: Part;
}

// Receiving Record
export interface ReceivingRecord {
  id: string;
  purchase_order_line_id: string;
  quantity_received: number;
  received_at: string;
  notes: string | null;
}

export interface ReceivingReceiptLine {
  part_id: string;
  quantity: number;
  unit_cost?: number | null;
}

export interface ReceivingReceipt {
  id: string;
  vendor_id: string | null;
  reference: string | null;
  received_at: string;
  received_by: string;
  source_type: 'PURCHASE_ORDER' | 'MANUAL';
  source_id?: string | null;
  lines: ReceivingReceiptLine[];
}

// Dashboard Stats
export interface DashboardStats {
  openWorkOrders: number;
  openSalesOrders: number;
  openPurchaseOrders: number;
  dailyRevenue: number;
  negativeInventoryItems: Part[];
  warrantyTotals: {
    partsCost: number;
    laborCost: number;
  };
}

// PM Interval Types
export type PMIntervalType = 'MILES' | 'HOURS' | 'DAYS';

// PM Schedule Status
export type PMScheduleStatus = 'OVERDUE' | 'DUE_SOON' | 'OK' | 'NOT_CONFIGURED';

// Unit PM Schedule
export interface UnitPMSchedule {
  id: string;
  unit_id: string;
  name: string;
  interval_type: PMIntervalType;
  interval_value: number;
  last_completed_date: string | null;
  last_completed_meter: number | null;
  default_labor_description: string | null;
  default_labor_hours: number | null;
  last_generated_due_key: string | null;
  last_generated_work_order_id: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Unit PM History
export interface UnitPMHistory {
  id: string;
  unit_id: string;
  schedule_id: string;
  completed_date: string;
  completed_meter: number | null;
  notes: string | null;
  related_work_order_id: string | null;
  is_active: boolean;
  created_at: string;
}

export type InvoiceSourceType = 'SALES_ORDER' | 'WORK_ORDER';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'VOID' | 'VOIDED' | 'PAID' | 'PARTIAL';
export type InvoiceLineType = 'PART' | 'LABOR' | 'FEE' | 'DISCOUNT' | 'TAX' | 'NOTE';

export interface Invoice {
  id: string;
  invoice_number: string;
  source_type: InvoiceSourceType;
  source_id: string;
  customer_id: string;
  unit_id?: string | null;
  status: InvoiceStatus;
  issued_at?: string | null;
  due_at?: string | null;
  subtotal_parts: number;
  subtotal_labor: number;
  subtotal_fees: number;
  tax_amount: number;
  total: number;
  balance_due: number;
  snapshot_json?: unknown;
  voided_at?: string | null;
  void_reason?: string | null;
}

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  line_type: InvoiceLineType;
  ref_type?: string | null;
  ref_id?: string | null;
  description: string;
  qty: number;
  unit_price: number;
  amount: number;
  taxable?: boolean | null;
  tax_rate?: number | null;
}
