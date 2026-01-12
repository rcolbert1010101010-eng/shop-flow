import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { calcPartPriceForLevel } from '@/domain/pricing/partPricing';
import { normalizePhone } from '@/lib/utils';
import type {
  SystemSettings,
  Customer,
  CustomerContact,
  Unit,
  UnitAttachment,
  UnitAttachmentTag,
  Vendor,
  PartCategory,
  Part,
  SalesOrder,
  SalesOrderLine,
  SalesOrderStatus,
  WorkOrder,
  WorkOrderPartLine,
  WorkOrderLaborLine,
  Technician,
  TimeEntry,
  PurchaseOrder,
  PurchaseOrderLine,
  ReceivingRecord,
  InventoryAdjustment,
  VendorCostHistory,
  UnitPMSchedule,
  UnitPMHistory,
  PartKitComponent,
  Return,
  ReturnLine,
  ReturnStatus,
  ReturnLineCondition,
  WarrantyPolicy,
  WarrantyClaim,
  WarrantyClaimLine,
  WarrantyClaimStatus,
  FabJob,
  FabJobLine,
  PlasmaJob,
  PlasmaJobLine,
  PlasmaTemplate,
  PlasmaTemplateLine,
  Remnant,
  WorkOrderChargeLine,
  WorkOrderChargeSourceType,
  SalesOrderChargeLine,
  SalesOrderChargeSourceType,
  PlasmaJobAttachment,
  PlasmaJobAttachmentKind,
  ScheduleItem,
  PreferredContactMethod,
  InventoryMovement,
  InventoryMovementType,
  InventoryRefType,
  ReceivingReceipt,
  WorkOrderJobLine,
  WorkOrderActivityEvent,
  WorkOrderJobStatus,
  WorkOrderTimeEntry,
  WorkOrderJobPartsStatus,
  WorkOrderJobPartsReadiness,
  CycleCountSession,
  CycleCountLine,
} from '@/types';
import { calculateFabJob, fabricationPricingDefaults, type FabricationPricingSettings } from '@/services/fabricationPricingService';
import { calculatePlasmaJob, plasmaPricingDefaults, type PlasmaPricingSettings } from '@/services/plasmaPricingService';
import { computePlasmaJobMetrics } from '@/services/plasmaJobSummary';


// Generate unique IDs
const generateId = () => crypto.randomUUID();
const SESSION_USER_KEY = 'rhp.session_user_name';
const NEG_QOH_POLICY_KEY = 'rhp.inventory_negative_qoh_policy';

// Generate order numbers
const generateOrderNumber = (prefix: string, count: number) => 
  `${prefix}-${String(count + 1).padStart(6, '0')}`;

const resolveTaxRateForCustomer = (customer: Customer | undefined, settings: SystemSettings) => {
  if (!customer) return settings.default_tax_rate;
  if (customer.is_tax_exempt) return 0;
  if (customer.tax_rate_override != null && Number.isFinite(customer.tax_rate_override) && customer.tax_rate_override >= 0) {
    return customer.tax_rate_override;
  }
  return settings.default_tax_rate;
};

const getKitComponentDeltas = (
  kitPartId: string,
  qty: number,
  kitComponents: PartKitComponent[]
): Record<string, number> => {
  const components = kitComponents.filter((c) => c.is_active && c.kit_part_id === kitPartId);
  return components.reduce<Record<string, number>>((acc, comp) => {
    acc[comp.component_part_id] = (acc[comp.component_part_id] || 0) + qty * comp.quantity;
    return acc;
  }, {});
};

interface ShopState {
  // System Settings
  settings: SystemSettings;
  updateSettings: (settings: Partial<SystemSettings>) => void;

  // Customers
  customers: Customer[];
  addCustomer: (
    customer: Omit<Customer, 'id' | 'is_active' | 'created_at' | 'updated_at'>
  ) => { success: boolean; customer?: Customer; error?: string };
  updateCustomer: (id: string, customer: Partial<Customer>) => { success: boolean; customer?: Customer; error?: string };
  deactivateCustomer: (id: string) => boolean;
  isCustomerOnCreditHold: (customerId: string) => boolean;

  // Customer Contacts
  customerContacts: CustomerContact[];
  getCustomerContacts: (customerId: string) => CustomerContact[];
  createCustomerContact: (
    customerId: string,
    contact: Omit<CustomerContact, 'id' | 'customer_id' | 'created_at' | 'updated_at'>
  ) => { success: boolean; contact?: CustomerContact; error?: string };
  updateCustomerContact: (
    contactId: string,
    patch: Partial<Omit<CustomerContact, 'id' | 'customer_id' | 'created_at' | 'updated_at'>>
  ) => { success: boolean; contact?: CustomerContact; error?: string };
  deleteCustomerContact: (contactId: string) => boolean;
  setPrimaryCustomerContact: (customerId: string, contactId: string) => void;

  // Units
  units: Unit[];
  addUnit: (unit: Omit<Unit, 'id' | 'is_active' | 'created_at' | 'updated_at'>) => Unit;
  updateUnit: (id: string, unit: Partial<Unit>) => void;
  deactivateUnit: (id: string) => void;
  getUnitsByCustomer: (customerId: string) => Unit[];

  // Unit Attachments (images)
  unitAttachments: UnitAttachment[];
  listUnitAttachments: (unitId: string) => UnitAttachment[];
  addUnitAttachment: (unitId: string, file: File, options?: { tag?: UnitAttachmentTag; notes?: string | null }) => { success: boolean; attachment?: UnitAttachment; error?: string };
  removeUnitAttachment: (attachmentId: string) => void;
  updateUnitAttachment: (attachmentId: string, patch: Partial<Pick<UnitAttachment, 'tag' | 'notes' | 'is_primary' | 'sort_order'>>) => void;
  setUnitAttachmentPrimary: (attachmentId: string) => void;
  reorderUnitAttachments: (unitId: string, orderedIds: string[]) => void;

  // Vendors
  vendors: Vendor[];
  addVendor: (vendor: Omit<Vendor, 'id' | 'is_active' | 'created_at' | 'updated_at'>) => Vendor;
  updateVendor: (id: string, vendor: Partial<Vendor>) => void;
  deactivateVendor: (id: string) => void;

  // Part Categories
  categories: PartCategory[];
  addCategory: (category: Omit<PartCategory, 'id' | 'is_active' | 'created_at' | 'updated_at'>) => PartCategory;
  updateCategory: (id: string, category: Partial<PartCategory>) => void;
  deactivateCategory: (id: string) => void;

  // Parts
  parts: Part[];
  addPart: (part: Omit<Part, 'id' | 'is_active' | 'created_at' | 'updated_at' | 'last_cost' | 'avg_cost' | 'barcode'> & Partial<Pick<Part, 'last_cost' | 'avg_cost' | 'barcode'>>) => Part;
  updatePart: (id: string, part: Partial<Part>) => void;
  updatePartWithQohAdjustment: (id: string, part: Partial<Part>, meta: { reason: string; adjusted_by: string }) => { success: boolean; warning?: string; error?: string };
  deactivatePart: (id: string) => void;
  reactivatePart: (id: string) => void;
  kitComponents: PartKitComponent[];
  addKitComponent: (component: Omit<PartKitComponent, 'id' | 'is_active' | 'created_at' | 'updated_at'>) => PartKitComponent;
  updateKitComponentQuantity: (id: string, quantity: number) => void;
  removeKitComponent: (id: string) => void;

  // Technicians
  technicians: Technician[];
  addTechnician: (technician: Omit<Technician, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<Technician, 'is_active' | 'employment_type' | 'skill_tags' | 'work_schedule' | 'certifications'>>) => Technician;
  updateTechnician: (id: string, technician: Partial<Technician>) => void;
  deactivateTechnician: (id: string) => void;

  // Time Entries
  timeEntries: TimeEntry[];
  clockIn: (technicianId: string, workOrderId: string) => { success: boolean; error?: string };
  clockOut: (technicianId: string) => { success: boolean; error?: string };
  getActiveTimeEntry: (technicianId: string) => TimeEntry | undefined;
  getTimeEntriesByWorkOrder: (workOrderId: string) => TimeEntry[];

  // Scheduling
  scheduleItems: ScheduleItem[];
  listScheduleItems: () => ScheduleItem[];
  getScheduleItemsByWorkOrder: (workOrderId: string) => ScheduleItem[];
  createScheduleItem: (item: Omit<ScheduleItem, 'id' | 'created_at' | 'updated_at'> & { id?: string }) => ScheduleItem;
  updateScheduleItem: (id: string, patch: Partial<ScheduleItem>) => ScheduleItem | null;
  removeScheduleItem: (id: string) => void;
  detectScheduleConflicts: (
    item?:
      | Pick<ScheduleItem, 'technician_id' | 'start_at' | 'duration_minutes'> & { id?: string | null }
      | string
  ) => ScheduleItem[];

  // Sales Orders
  salesOrders: SalesOrder[];
  salesOrderLines: SalesOrderLine[];
  createSalesOrder: (customerId: string, unitId: string | null) => SalesOrder;
  soAddPartLine: (orderId: string, partId: string, qty: number) => { success: boolean; error?: string };
  soUpdatePartQty: (lineId: string, newQty: number) => { success: boolean; error?: string };
  soUpdateLineUnitPrice: (lineId: string, newUnitPrice: number) => { success: boolean; error?: string };
  soRemovePartLine: (lineId: string) => { success: boolean; error?: string };
  soToggleWarranty: (lineId: string) => { success: boolean; error?: string };
  soToggleCoreReturned: (lineId: string) => { success: boolean; error?: string };
  soMarkCoreReturned: (lineId: string) => { success: boolean; error?: string };
  soConvertToOpen: (orderId: string) => { success: boolean; error?: string };
  soInvoice: (orderId: string) => { success: boolean; error?: string };
  soSetStatus: (orderId: string, status: SalesOrderStatus) => { success: boolean; error?: string };
  updateSalesOrderNotes: (orderId: string, notes: string | null) => void;
  getSalesOrderLines: (orderId: string) => SalesOrderLine[];
  salesOrderChargeLines: SalesOrderChargeLine[];
  getSalesOrderChargeLines: (orderId: string) => SalesOrderChargeLine[];
  addSalesOrderChargeLine: (line: Omit<SalesOrderChargeLine, 'id' | 'created_at' | 'updated_at'> & { id?: string }) => SalesOrderChargeLine | null;
  updateSalesOrderChargeLine: (id: string, patch: Partial<SalesOrderChargeLine>) => void;
  removeSalesOrderChargeLine: (id: string) => void;

  // Work Orders
  workOrders: WorkOrder[];
  workOrderPartLines: WorkOrderPartLine[];
  workOrderLaborLines: WorkOrderLaborLine[];
  workOrderJobLines: WorkOrderJobLine[];
  workOrderActivity: WorkOrderActivityEvent[];
  workOrderTimeEntries: WorkOrderTimeEntry[];
  getWorkOrderTimeEntries: (workOrderId: string) => WorkOrderTimeEntry[];
  getJobTimeEntries: (jobLineId: string) => WorkOrderTimeEntry[];
  getActiveJobTimers: (workOrderId: string) => WorkOrderTimeEntry[];
  getJobActualHours: (jobLineId: string) => number;
  getWorkOrderActualHours: (workOrderId: string) => number;
  createWorkOrder: (customerId: string, unitId: string) => WorkOrder;
  woAddPartLine: (orderId: string, partId: string, qty: number, jobLineId?: string | null) => { success: boolean; error?: string };
  woUpdatePartQty: (lineId: string, newQty: number) => { success: boolean; error?: string };
  woUpdateLineUnitPrice: (lineId: string, newUnitPrice: number) => { success: boolean; error?: string };
  woRemovePartLine: (lineId: string) => { success: boolean; error?: string };
  woTogglePartWarranty: (lineId: string) => { success: boolean; error?: string };
  woToggleCoreReturned: (lineId: string) => { success: boolean; error?: string };
  woMarkCoreReturned: (lineId: string) => { success: boolean; error?: string };
  woAddLaborLine: (
    orderId: string,
    description: string,
    hours: number,
    technicianId?: string,
    jobLineId?: string | null
  ) => { success: boolean; error?: string };
  woUpdateLaborLine: (lineId: string, description: string, hours: number) => { success: boolean; error?: string };
  woRemoveLaborLine: (lineId: string) => { success: boolean; error?: string };
  woToggleLaborWarranty: (lineId: string) => { success: boolean; error?: string };
  woUpdateStatus: (orderId: string, status: 'IN_PROGRESS') => { success: boolean; error?: string };
  woConvertToOpen: (orderId: string) => { success: boolean; error?: string };
  woInvoice: (orderId: string) => { success: boolean; error?: string };
  updateWorkOrderNotes: (orderId: string, notes: string | null) => void;
  updateWorkOrderPromisedAt?: (orderId: string, promisedAt: string | null) => void;
  getWorkOrderPartLines: (orderId: string) => WorkOrderPartLine[];
  getWorkOrderLaborLines: (orderId: string) => WorkOrderLaborLine[];
  getWorkOrderJobLines: (orderId: string) => WorkOrderJobLine[];
  getWorkOrderActivity: (orderId: string) => WorkOrderActivityEvent[];
  getJobPartReadiness: (jobLineId: string) => WorkOrderJobPartsStatus;
  woEnsureDefaultJobLine: (orderId: string) => WorkOrderJobLine;
  woCreateJobLine: (orderId: string, title: string) => WorkOrderJobLine;
  woUpdateJobLine: (
    jobLineId: string,
    patch: Partial<Pick<WorkOrderJobLine, 'title' | 'complaint' | 'cause' | 'correction' | 'status' | 'is_active'>>
  ) => WorkOrderJobLine | null;
  woSetJobStatus: (jobLineId: string, status: WorkOrderJobStatus) => WorkOrderJobLine | null;
  woDeleteJobLine: (jobLineId: string) => { success: boolean; error?: string };
  woClockIn: (
    workOrderId: string,
    jobLineId: string,
    technicianId?: string,
    technicianName?: string | null
  ) => { success: boolean; entry?: WorkOrderTimeEntry; error?: string };
  woClockOut: (timeEntryId: string) => { success: boolean; entry?: WorkOrderTimeEntry; error?: string };
  woClockOutActiveForJob: (
    workOrderId: string,
    jobLineId: string,
    technicianId?: string
  ) => { success: boolean; entry?: WorkOrderTimeEntry; error?: string };
  recalculateSalesOrderTotals: (orderId: string) => void;
  recalculateWorkOrderTotals: (orderId: string) => void;
  workOrderChargeLines: WorkOrderChargeLine[];
  getWorkOrderChargeLines: (orderId: string) => WorkOrderChargeLine[];
  addWorkOrderChargeLine: (line: Omit<WorkOrderChargeLine, 'id' | 'created_at' | 'updated_at'> & { id?: string }) => WorkOrderChargeLine | null;
  updateWorkOrderChargeLine: (id: string, patch: Partial<WorkOrderChargeLine>) => void;
  removeWorkOrderChargeLine: (id: string) => void;
  postPlasmaJobToWorkOrder: (plasmaJobId: string) => { success: boolean; error?: string };
  updateWorkOrderTechnician?: (orderId: string, technicianId: string | null) => void;
  postFabJobToWorkOrder: (fabJobId: string) => { success: boolean; error?: string };

  // Fabrication
  fabJobs: FabJob[];
  fabJobLines: FabJobLine[];
  createFabJobForWorkOrder: (workOrderId: string) => FabJob;
  getFabJobByWorkOrder: (workOrderId: string) => { job: FabJob; lines: FabJobLine[] } | null;
  updateFabJob: (id: string, patch: Partial<FabJob>) => FabJob | null;
  upsertFabJobLine: (jobId: string, line: Partial<FabJobLine>) => FabJobLine | null;
  deleteFabJobLine: (lineId: string) => void;
  recalculateFabJob: (
    jobId: string,
    settingsOverride?: Partial<FabricationPricingSettings>
  ) => { success: boolean; error?: string; warnings?: string[] };

  // Plasma
  plasmaJobs: PlasmaJob[];
  plasmaJobLines: PlasmaJobLine[];
  createPlasmaJobForWorkOrder: (workOrderId: string) => PlasmaJob;
  getPlasmaJobByWorkOrder: (workOrderId: string) => { job: PlasmaJob; lines: PlasmaJobLine[] } | null;
  createStandalonePlasmaJob: (payload?: { sales_order_id?: string | null }) => PlasmaJob;
  getPlasmaJob: (plasmaJobId: string) => { job: PlasmaJob; lines: PlasmaJobLine[] } | null;
  getPlasmaPrintView: (
    plasmaJobId: string
  ) =>
    | {
        job: PlasmaJob;
        lines: PlasmaJobLine[];
        workOrder?: WorkOrder | null;
        salesOrder?: SalesOrder | null;
        customerName?: string | null;
        metrics: import('@/services/plasmaJobSummary').PlasmaJobMetrics;
        attachments: PlasmaJobAttachment[];
      }
    | null;
  listStandalonePlasmaJobs: () => PlasmaJob[];
  linkPlasmaJobToSalesOrder: (plasmaJobId: string, salesOrderId: string) => PlasmaJob | null;
  updatePlasmaJob: (id: string, patch: Partial<PlasmaJob>) => PlasmaJob | null;
  upsertPlasmaJobLine: (jobId: string, line: Partial<PlasmaJobLine>) => PlasmaJobLine | null;
  deletePlasmaJobLine: (lineId: string) => void;
  recalculatePlasmaJob: (jobId: string, settingsOverride?: Partial<PlasmaPricingSettings>) => { success: boolean; error?: string; totals?: { sell_price_total: number }; warnings?: string[] };
  postPlasmaJobToSalesOrder: (plasmaJobId: string) => { success: boolean; error?: string };
  plasmaAttachments: PlasmaJobAttachment[];
  listPlasmaAttachments: (plasmaJobId: string) => PlasmaJobAttachment[];
  addPlasmaAttachment: (plasmaJobId: string, file: File, options?: { notes?: string | null }) => { success: boolean; error?: string };
  removePlasmaAttachment: (attachmentId: string) => void;
  updatePlasmaAttachment: (attachmentId: string, patch: Partial<PlasmaJobAttachment>) => void;
  remnants: Remnant[];
  listRemnants: () => Remnant[];
  createRemnant: (payload: Omit<Remnant, 'id' | 'created_at' | 'updated_at' | 'status'> & Partial<Pick<Remnant, 'status'>>) => Remnant;
  updateRemnant: (id: string, patch: Partial<Remnant>) => void;
  removeRemnant: (id: string) => void;
  consumeRemnant: (id: string) => void;
  plasmaTemplates: PlasmaTemplate[];
  plasmaTemplateLines: PlasmaTemplateLine[];
  listPlasmaTemplates: () => PlasmaTemplate[];
  getPlasmaTemplate: (templateId: string) => { template: PlasmaTemplate; lines: PlasmaTemplateLine[] } | null;
  createPlasmaTemplate: (payload: Omit<PlasmaTemplate, 'id' | 'created_at' | 'updated_at'>) => PlasmaTemplate;
  updatePlasmaTemplate: (templateId: string, patch: Partial<PlasmaTemplate>) => void;
  removePlasmaTemplate: (templateId: string) => void;
  addPlasmaTemplateLine: (templateId: string, line: Omit<PlasmaTemplateLine, 'id' | 'plasma_template_id' | 'created_at' | 'updated_at'>) => PlasmaTemplateLine;
  updatePlasmaTemplateLine: (lineId: string, patch: Partial<PlasmaTemplateLine>) => void;
  removePlasmaTemplateLine: (lineId: string) => void;
  applyPlasmaTemplateToJob: (templateId: string, plasmaJobId: string) => { success: boolean; error?: string };

  // Purchase Orders
  purchaseOrders: PurchaseOrder[];
  purchaseOrderLines: PurchaseOrderLine[];
  receivingRecords: ReceivingRecord[];
  inventoryAdjustments: InventoryAdjustment[];
  inventoryMovements: InventoryMovement[];
  getSessionUserName: () => string;
  recordInventoryMovement: (
    movement: Omit<InventoryMovement, 'id' | 'performed_at' | 'performed_by'> & {
      performed_by?: string;
      performed_at?: string;
    }
  ) => void;
  getMovementsForPart: (partId: string) => InventoryMovement[];
  receivingReceipts: ReceivingReceipt[];
  receiveInventory?: (payload: {
    lines: { part_id: string; quantity: number; unit_cost?: number | null }[];
    vendor_id?: string | null;
    reference?: string | null;
    received_at?: string | null;
    source_type?: 'PURCHASE_ORDER' | 'MANUAL';
    source_id?: string | null;
  }) => { success: boolean; error?: string };
  vendorCostHistory: VendorCostHistory[];
  returns: Return[];
  returnLines: ReturnLine[];
  warrantyPolicies: WarrantyPolicy[];
  warrantyClaims: WarrantyClaim[];
  warrantyClaimLines: WarrantyClaimLine[];
  createPurchaseOrder: (vendorId: string) => PurchaseOrder;
  poAddLine: (orderId: string, partId: string, quantity: number) => { success: boolean; error?: string };
  poUpdateLineQty: (lineId: string, newQty: number) => { success: boolean; error?: string };
  poRemoveLine: (lineId: string) => { success: boolean; error?: string };
  poReceive: (lineId: string, quantity: number) => { success: boolean; error?: string };
  poClose: (orderId: string) => { success: boolean; error?: string };
  updatePurchaseOrderNotes: (orderId: string, notes: string | null) => void;
  updatePurchaseOrderLinks: (orderId: string, links: { sales_order_id: string | null; work_order_id: string | null }) => void;
  getPurchaseOrderLines: (orderId: string) => PurchaseOrderLine[];
  getReceivingRecords: (lineId: string) => ReceivingRecord[];

  // Returns
  createReturn: (payload: { vendor_id: string; purchase_order_id?: string | null; sales_order_id?: string | null; work_order_id?: string | null }) => Return | null;
  updateReturn: (id: string, patch: Partial<Return>) => void;
  setReturnStatus: (id: string, status: ReturnStatus) => void;
  addReturnLine: (returnId: string, payload: { part_id: string; purchase_order_line_id?: string | null; quantity: number; unit_cost: number | null; condition: ReturnLine['condition']; reason?: string | null }) => ReturnLine | null;
  updateReturnLine: (lineId: string, patch: Partial<ReturnLine>) => void;
  removeReturnLine: (lineId: string) => void;
  getReturnLines: (returnId: string) => ReturnLine[];
  getReturnsByPurchaseOrder: (poId: string) => Return[];

  // Warranty
  upsertWarrantyPolicy: (vendorId: string, patch: Partial<WarrantyPolicy>) => WarrantyPolicy;
  createWarrantyClaim: (payload: { vendor_id: string; policy_id?: string | null; work_order_id?: string | null; sales_order_id?: string | null; purchase_order_id?: string | null }) => WarrantyClaim | null;
  updateWarrantyClaim: (id: string, patch: Partial<WarrantyClaim>) => void;
  setWarrantyClaimStatus: (id: string, status: WarrantyClaimStatus) => void;
  addWarrantyClaimLine: (claimId: string, payload: Partial<WarrantyClaimLine>) => WarrantyClaimLine | null;
  updateWarrantyClaimLine: (lineId: string, patch: Partial<WarrantyClaimLine>) => void;
  removeWarrantyClaimLine: (lineId: string) => void;
  getWarrantyPolicyByVendor: (vendorId: string) => WarrantyPolicy | undefined;
  getClaimsByVendor: (vendorId: string) => WarrantyClaim[];
  getClaimsByWorkOrder: (workOrderId: string) => WarrantyClaim[];
  getWarrantyClaimLines: (claimId: string) => WarrantyClaimLine[];

  // PM Schedules
  pmSchedules: UnitPMSchedule[];
  pmHistory: UnitPMHistory[];
  addPMSchedule: (schedule: Omit<UnitPMSchedule, 'id' | 'is_active' | 'created_at' | 'updated_at'>) => UnitPMSchedule;
  updatePMSchedule: (id: string, schedule: Partial<UnitPMSchedule>) => void;
  deactivatePMSchedule: (id: string) => void;
  getPMSchedulesByUnit: (unitId: string) => UnitPMSchedule[];
  addPMHistory: (history: Omit<UnitPMHistory, 'id' | 'is_active' | 'created_at'>) => UnitPMHistory;
  getPMHistoryByUnit: (unitId: string) => UnitPMHistory[];
  markPMCompleted: (scheduleId: string, completedDate: string, completedMeter: number | null, notes: string | null) => { success: boolean; error?: string };

  // Cycle Counts
  cycleCountSessions: CycleCountSession[];
  cycleCountLines: CycleCountLine[];
  createCycleCountSession: (session: { title?: string | null; notes?: string | null; created_by?: string }) => CycleCountSession;
  updateCycleCountSession: (id: string, session: Partial<Pick<CycleCountSession, 'title' | 'notes' | 'posted_by'>>) => void;
  cancelCycleCountSession: (id: string) => { success: boolean; error?: string };
  addCycleCountLine: (sessionId: string, partId: string) => { success: boolean; error?: string };
  updateCycleCountLine: (id: string, updates: Partial<Pick<CycleCountLine, 'counted_qty' | 'reason'>>) => { success: boolean; error?: string };
  postCycleCountSession: (id: string, posted_by?: string) => { success: boolean; error?: string };
  getCycleCountLines: (sessionId: string) => CycleCountLine[];
}

const now = () => new Date().toISOString();
const staticDate = '2024-01-01T00:00:00.000Z';

// Walk-in customer
const WALKIN_CUSTOMER: Customer = {
  id: 'walkin',
  company_name: 'Walk-in Customer',
  contact_name: null,
  phone: null,
  email: null,
  address: null,
  notes: 'Default walk-in customer for counter sales',
  price_level: 'RETAIL',
  is_tax_exempt: false,
  tax_rate_override: null,
  is_active: true,
  created_at: staticDate,
  updated_at: staticDate,
};

// Sample Vendors
const SAMPLE_VENDORS: Vendor[] = [];

// Sample Categories
const SAMPLE_CATEGORIES: PartCategory[] = [];

// Sample Parts
const SAMPLE_PARTS: Part[] = [];


// Sample Customers
const SAMPLE_CUSTOMERS: Customer[] = [];


const SAMPLE_CUSTOMER_CONTACTS: CustomerContact[] = [];


const INITIAL_CUSTOMERS: Customer[] = [];

const hydrateLegacyCustomerContacts = (
  customers: Customer[],
  customerContacts: CustomerContact[],
): CustomerContact[] => {
  const timestamp = now();
  const contactsByCustomer = customerContacts.reduce<Record<string, CustomerContact[]>>((acc, contact) => {
    acc[contact.customer_id] = acc[contact.customer_id] || [];
    acc[contact.customer_id].push(contact);
    return acc;
  }, {});

  const hydrated: CustomerContact[] = [];

  customers.forEach((customer) => {
    const contacts = contactsByCustomer[customer.id] || [];

    if (customer.id === WALKIN_CUSTOMER.id) {
      hydrated.push(...contacts);
      return;
    }

    if (contacts.length === 0) {
      hydrated.push({
        id: generateId(),
        customer_id: customer.id,
        name: customer.contact_name?.trim() || 'Primary Contact',
        role: null,
        phone: customer.phone?.trim() || null,
        email: customer.email?.trim() || null,
        is_primary: true,
        preferred_method: null,
        created_at: timestamp,
        updated_at: timestamp,
      });
      return;
    }

    if (!contacts.some((c) => c.is_primary)) {
      const [first, ...rest] = contacts;
      hydrated.push({ ...first, is_primary: true }, ...rest);
      return;
    }

    hydrated.push(...contacts);
  });

  // Preserve any contacts tied to customers not in the provided list
  customerContacts.forEach((contact) => {
    if (!customers.some((customer) => customer.id === contact.customer_id)) {
      hydrated.push(contact);
    }
  });

  return hydrated;
};

// Sample Units
const SAMPLE_UNITS: Unit[] = [];


const DEFAULT_TECH_SCHEDULE = {
  days: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false },
  start_time: '07:00',
  end_time: '15:30',
};

const buildDefaultSchedule = () => ({
  days: { ...DEFAULT_TECH_SCHEDULE.days },
  start_time: DEFAULT_TECH_SCHEDULE.start_time,
  end_time: DEFAULT_TECH_SCHEDULE.end_time,
});

// Sample Technicians
const SAMPLE_TECHNICIANS: Technician[] = [];


export const useShopStore = create<ShopState>()(
  persist<ShopState>(
    (set, get): ShopState => {
      const upsertPlasmaChargeLine = (params: {
        target: 'WORK_ORDER' | 'SALES_ORDER';
        orderId: string;
        plasmaJobId: string;
        description: string;
        totalPrice: number;
      }) => {
        if (params.target === 'WORK_ORDER') {
          const existingCharge = get().workOrderChargeLines.find(
            (cl) =>
              cl.work_order_id === params.orderId &&
              cl.source_ref_type === 'PLASMA_JOB' &&
              cl.source_ref_id === params.plasmaJobId
          );
          const payload = {
            work_order_id: params.orderId,
            description: params.description,
            qty: 1,
            unit_price: params.totalPrice,
            total_price: params.totalPrice,
            source_ref_type: 'PLASMA_JOB' as WorkOrderChargeSourceType,
            source_ref_id: params.plasmaJobId,
          };
          if (existingCharge) {
            get().updateWorkOrderChargeLine(existingCharge.id, payload);
          } else {
            get().addWorkOrderChargeLine(payload);
          }
          get().recalculateWorkOrderTotals(params.orderId);
        } else {
          const existingCharge = get().salesOrderChargeLines.find(
            (cl) =>
              cl.sales_order_id === params.orderId &&
              cl.source_ref_type === 'PLASMA_JOB' &&
              cl.source_ref_id === params.plasmaJobId
          );
          const payload = {
            sales_order_id: params.orderId,
            description: params.description,
            qty: 1,
            unit_price: params.totalPrice,
            total_price: params.totalPrice,
            source_ref_type: 'PLASMA_JOB' as SalesOrderChargeSourceType,
            source_ref_id: params.plasmaJobId,
          };
          if (existingCharge) {
            get().updateSalesOrderChargeLine(existingCharge.id, payload);
          } else {
            get().addSalesOrderChargeLine(payload);
          }
          get().recalculateSalesOrderTotals(params.orderId);
        }
      };

      const upsertFabChargeLine = (params: { orderId: string; fabJobId: string; description: string; totalPrice: number }) => {
        const existingCharge = get().workOrderChargeLines.find(
          (cl) =>
            cl.work_order_id === params.orderId &&
            cl.source_ref_type === 'FAB_JOB' &&
            cl.source_ref_id === params.fabJobId
        );
        const payload = {
          work_order_id: params.orderId,
          description: params.description,
          qty: 1,
          unit_price: params.totalPrice,
          total_price: params.totalPrice,
          source_ref_type: 'FAB_JOB' as WorkOrderChargeSourceType,
          source_ref_id: params.fabJobId,
        };
        if (existingCharge) {
          get().updateWorkOrderChargeLine(existingCharge.id, payload);
        } else {
          get().addWorkOrderChargeLine(payload);
        }
        get().recalculateWorkOrderTotals(params.orderId);
      };

      const logWorkOrderActivity = (event: Omit<WorkOrderActivityEvent, 'id' | 'created_at'>) => {
        const timestamp = now();
        const record: WorkOrderActivityEvent = { ...event, id: generateId(), created_at: timestamp };
        set((state) => ({
          workOrderActivity: [...state.workOrderActivity, record],
        }));
      };

      const calculateEntrySeconds = (entry: WorkOrderTimeEntry, endedAt?: string | null) => {
        const startMs = new Date(entry.started_at).getTime();
        const endTimestamp = endedAt ?? entry.ended_at ?? now();
        const endMs = new Date(endTimestamp).getTime();
        return Math.max(Math.round((endMs - startMs) / 1000), 0);
      };

      const deriveTechnicianKey = (technicianId?: string | null, technicianName?: string | null) => {
        if (technicianId) return `id:${technicianId}`;
        if (technicianName) return `name:${technicianName}`;
        return null;
      };

      const finishTimeEntry = (entry: WorkOrderTimeEntry) => {
        const endedAt = now();
        const seconds = calculateEntrySeconds(entry, endedAt);
        const updatedEntry: WorkOrderTimeEntry = {
          ...entry,
          ended_at: endedAt,
          seconds,
          updated_at: now(),
        };
        set((state) => ({
          workOrderTimeEntries: state.workOrderTimeEntries.map((te) =>
            te.id === entry.id ? updatedEntry : te
          ),
        }));
        return updatedEntry;
      };

      const createPOsForNegativeInventory = (
        projectedQuantities?: Record<string, number>,
        sourceNote?: string
      ) => {
        const baseNote = 'Auto-generated from invoicing to replenish negative inventory';
        const noteText = sourceNote ? `${baseNote} (${sourceNote})` : baseNote;
        const state = get();
        const shortages = state.parts
          .map((part) => {
            const qoh = projectedQuantities?.[part.id] ?? part.quantity_on_hand;
            return { part, qoh };
          })
          .filter(
            ({ part, qoh }) =>
              qoh < 0 && !!part.vendor_id && part.max_qty !== null && part.max_qty > 0
          );

        if (shortages.length === 0) return;

        const grouped = shortages.reduce<Record<string, { part: Part; qoh: number }[]>>(
          (acc, item) => {
            const key = item.part.vendor_id;
            if (!key) return acc;
            acc[key] = acc[key] || [];
            acc[key].push(item);
            return acc;
          },
          {}
        );

        Object.entries(grouped).forEach(([vendorId, items]) => {
          const stateSnapshot = get();
          const existingPo = stateSnapshot.purchaseOrders.find(
            (po) => po.vendor_id === vendorId && po.status === 'OPEN'
          );
          let poId = existingPo?.id;
          if (!poId) {
            const newPo = get().createPurchaseOrder(vendorId);
            poId = newPo.id;
            set((state) => ({
              purchaseOrders: state.purchaseOrders.map((po) =>
                po.id === poId ? { ...po, notes: noteText } : po
              ),
            }));
          } else if (noteText) {
            const needsNote =
              !existingPo.notes || !existingPo.notes.includes(baseNote);
            if (needsNote) {
              set((state) => ({
                purchaseOrders: state.purchaseOrders.map((po) =>
                  po.id === poId
                    ? { ...po, notes: po.notes ? `${po.notes}\n${noteText}` : noteText }
                    : po
                ),
              }));
            }
          }

          items.forEach(({ part, qoh }) => {
            const orderQty = (part.max_qty ?? 0) - qoh;
            if (orderQty <= 0) return;
            get().poAddLine(poId, part.id, orderQty);
          });
        });
      };

      return {
      // Initial Settings
      settings: {
        id: '1',
        shop_name: 'Heavy-Duty Repair Shop',
        default_labor_rate: 125.00,
        default_tax_rate: 8.25,
        currency: 'USD',
        units: 'imperial',
        markup_retail_percent: 60,
        markup_fleet_percent: 40,
        markup_wholesale_percent: 25,
        session_user_name:
          typeof localStorage !== 'undefined'
            ? (localStorage.getItem(SESSION_USER_KEY) || '').trim()
            : '',
        inventory_negative_qoh_policy:
          typeof localStorage !== 'undefined'
            ? ((localStorage.getItem(NEG_QOH_POLICY_KEY) as SystemSettings['inventory_negative_qoh_policy']) || 'WARN')
            : 'WARN',
        default_price_level: 'retail',
        minimum_margin_percent: 0,
        ai_enabled: true,
        ai_confirm_risky_actions: true,
        negative_inventory_policy: 'warn',
      },

      updateSettings: (newSettings) =>
        set((state) => {
          const merged = { ...state.settings, ...newSettings };
          if (typeof localStorage !== 'undefined') {
            if (newSettings.session_user_name !== undefined) {
              const trimmed = newSettings.session_user_name.trim();
              if (trimmed) {
                localStorage.setItem(SESSION_USER_KEY, trimmed);
              } else {
                localStorage.removeItem(SESSION_USER_KEY);
              }
            }
            if (newSettings.inventory_negative_qoh_policy) {
              localStorage.setItem(NEG_QOH_POLICY_KEY, newSettings.inventory_negative_qoh_policy);
            }
          }
          return {
            settings: merged,
          };
        }),

      getSessionUserName: () => {
        const name = get().settings.session_user_name?.trim();
        return name && name.length > 0 ? name : 'system';
      },

      inventoryMovements: [],

      recordInventoryMovement: (movement) => {
        const performed_at = movement.performed_at || now();
        const performed_by = movement.performed_by || get().getSessionUserName();
        const entry: InventoryMovement = {
          ...movement,
          id: generateId(),
          performed_at,
          performed_by,
        };
        set((state) => ({
          inventoryMovements: [...state.inventoryMovements, entry],
        }));
      },

      getMovementsForPart: (partId) => {
        return get()
          .inventoryMovements.filter((m) => m.part_id === partId)
          .sort((a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime());
      },

      // Customers
      customers: INITIAL_CUSTOMERS,

      addCustomer: (customer) => {
        if (customer.credit_hold && !customer.credit_hold_reason?.trim()) {
          return { success: false, error: 'Credit hold reason is required' };
        }

        const normalizedPhone = normalizePhone(customer.phone);
        if (normalizedPhone) {
          const state = get();
          const conflictCustomer = state.customers.find((c) => normalizePhone(c.phone) === normalizedPhone);
          if (conflictCustomer) {
            return { success: false, error: `Phone already used by ${conflictCustomer.company_name}` };
          }
          const conflictContact = state.customerContacts.find((cc) => normalizePhone(cc.phone) === normalizedPhone);
          if (conflictContact) {
            const conflictCust = state.customers.find((c) => c.id === conflictContact.customer_id);
            return {
              success: false,
              error: `Phone already used by ${conflictContact.name}${conflictCust ? ` (${conflictCust.company_name})` : ''}`,
            };
          }
        }

        const newCustomer: Customer = {
          ...customer,
          id: generateId(),
          price_level: customer.price_level ?? 'RETAIL',
          payment_terms: customer.payment_terms ?? 'COD',
          credit_limit: customer.credit_limit ?? null,
          credit_hold: customer.credit_hold ?? false,
          credit_hold_reason: customer.credit_hold_reason ?? null,
          is_tax_exempt: customer.is_tax_exempt ?? false,
          tax_rate_override: customer.tax_rate_override ?? null,
          phone: customer.phone?.trim() || null,
          email: customer.email?.trim() || null,
          address: customer.address?.trim() || null,
          contact_name: customer.contact_name?.trim() || null,
          notes: customer.notes?.trim() || null,
          is_active: true,
          created_at: now(),
          updated_at: now(),
        };
        set((state) => ({
          customers: [...state.customers, newCustomer],
        }));
        return { success: true, customer: newCustomer };
      },

      updateCustomer: (id, customer) => {
        const state = get();
        const existing = state.customers.find((c) => c.id === id);
        if (!existing) return { success: false, error: 'Customer not found' };

        if ((customer.credit_hold ?? existing.credit_hold) && !(customer.credit_hold_reason ?? existing.credit_hold_reason)?.trim()) {
          return { success: false, error: 'Credit hold reason is required' };
        }

        const normalizedPhone = normalizePhone(customer.phone ?? existing.phone);
        if (normalizedPhone) {
          const conflictCustomer = state.customers.find(
            (c) => c.id !== id && normalizePhone(c.phone) === normalizedPhone
          );
          if (conflictCustomer) {
            return { success: false, error: `Phone already used by ${conflictCustomer.company_name}` };
          }
          const conflictContact = state.customerContacts.find(
            (cc) => normalizePhone(cc.phone) === normalizedPhone && cc.customer_id !== id
          );
          if (conflictContact) {
            const conflictCust = state.customers.find((c) => c.id === conflictContact.customer_id);
            return {
              success: false,
              error: `Phone already used by ${conflictContact.name}${conflictCust ? ` (${conflictCust.company_name})` : ''}`,
            };
          }
        }

        let updatedCustomer: Customer | null = null;
        set((s) => ({
          customers: s.customers.map((c) => {
            if (c.id !== id) return c;
            updatedCustomer = {
              ...c,
              ...customer,
              phone: (customer.phone ?? c.phone)?.trim() || null,
              email: (customer.email ?? c.email)?.trim() || null,
              address: (customer.address ?? c.address)?.trim() || null,
              contact_name: (customer.contact_name ?? c.contact_name)?.trim() || null,
              notes: (customer.notes ?? c.notes)?.trim() || null,
              payment_terms: customer.payment_terms ?? c.payment_terms ?? 'COD',
              credit_limit:
                customer.credit_limit === undefined
                  ? c.credit_limit ?? null
                  : customer.credit_limit,
              credit_hold: customer.credit_hold ?? c.credit_hold ?? false,
              credit_hold_reason:
                customer.credit_hold_reason === undefined
                  ? c.credit_hold_reason ?? null
                  : (customer.credit_hold_reason?.trim() || null),
              updated_at: now(),
            };
            return updatedCustomer;
          }),
        }));

        return updatedCustomer ? { success: true, customer: updatedCustomer } : { success: false, error: 'Customer not found' };
      },

      deactivateCustomer: (id) => {
        const state = get();
        const hasActiveOrders =
          state.salesOrders.some((o) => o.customer_id === id && o.status !== 'INVOICED') ||
          state.workOrders.some((o) => o.customer_id === id && o.status !== 'INVOICED');
        
        if (hasActiveOrders) {
          return false;
        }
        
        set((state) => ({
          customers: state.customers.map((c) =>
            c.id === id ? { ...c, is_active: false, updated_at: now() } : c
          ),
        }));
        return true;
      },

      isCustomerOnCreditHold: (customerId) => {
        const customer = get().customers.find((c) => c.id === customerId);
        return Boolean(customer?.credit_hold);
      },

      // Customer Contacts
      customerContacts: hydrateLegacyCustomerContacts(
        INITIAL_CUSTOMERS,
        SAMPLE_CUSTOMER_CONTACTS,
      ),

      getCustomerContacts: (customerId) => {
        const contacts = useShopStore.getState().customerContacts;
        return contacts.filter((c) => c.customer_id === customerId);
      },

      setPrimaryCustomerContact: (customerId, contactId) =>
        set((state) => ({
          customerContacts: state.customerContacts.map((c) =>
            c.customer_id === customerId
              ? { ...c, is_primary: c.id === contactId }
              : c
          ),
        })),

      createCustomerContact: (customerId, contact) => {
        const state = useShopStore.getState();
        const contacts = state.customerContacts;
        const normalizedPhone = normalizePhone(contact.phone);
        if (normalizedPhone) {
          const conflictCustomer = state.customers.find((c) => normalizePhone(c.phone) === normalizedPhone);
          if (conflictCustomer) {
            return { success: false, error: `Phone already used by ${conflictCustomer.company_name}` };
          }
          const conflictContact = contacts.find((c) => normalizePhone(c.phone) === normalizedPhone);
          if (conflictContact) {
            const conflictCust = state.customers.find((c) => c.id === conflictContact.customer_id);
            return {
              success: false,
              error: `Phone already used by ${conflictContact.name}${conflictCust ? ` (${conflictCust.company_name})` : ''}`,
            };
          }
        }

        const newContact: CustomerContact = {
          ...contact,
          id: generateId(),
          customer_id: customerId,
          role: contact.role ?? null,
          phone: contact.phone?.trim() || null,
          email: contact.email?.trim() || null,
          preferred_method: contact.preferred_method ?? null,
          is_primary: contact.is_primary ?? false,
          created_at: now(),
          updated_at: now(),
        };

        set((state) => ({
          customerContacts: [...state.customerContacts, newContact],
        }));

        const hasPrimary = contacts.some((c) => c.customer_id === customerId && c.is_primary);
        if (newContact.is_primary || !hasPrimary) {
          useShopStore.getState().setPrimaryCustomerContact(customerId, newContact.id);
          newContact.is_primary = true;
        }

        return { success: true, contact: newContact };
      },

      updateCustomerContact: (contactId, patch) => {
        const state = useShopStore.getState();
        const contacts = state.customerContacts;
        const existing = contacts.find((c) => c.id === contactId);
        if (!existing) return { success: false, error: 'Contact not found' };

        const normalizedPhone = normalizePhone(patch.phone ?? existing.phone);
        if (normalizedPhone) {
          const conflictCustomer = state.customers.find(
            (c) => normalizePhone(c.phone) === normalizedPhone && c.id !== existing.customer_id
          );
          if (conflictCustomer) {
            return { success: false, error: `Phone already used by ${conflictCustomer.company_name}` };
          }
          const conflictContact = contacts.find(
            (c) => c.id !== contactId && normalizePhone(c.phone) === normalizedPhone
          );
          if (conflictContact) {
            const conflictCust = state.customers.find((c) => c.id === conflictContact.customer_id);
            return {
              success: false,
              error: `Phone already used by ${conflictContact.name}${conflictCust ? ` (${conflictCust.company_name})` : ''}`,
            };
          }
        }

        let updatedContact: CustomerContact | null = null;
        set((state) => ({
          customerContacts: state.customerContacts.map((c) => {
            if (c.id !== contactId) return c;
            updatedContact = {
              ...c,
              ...patch,
              phone: (patch.phone ?? c.phone)?.trim() || null,
              email: (patch.email ?? c.email)?.trim() || null,
              role: patch.role ?? c.role,
              preferred_method: patch.preferred_method ?? c.preferred_method,
              is_primary: patch.is_primary ?? c.is_primary,
              updated_at: now(),
            };
            return updatedContact;
          }),
        }));

        if (updatedContact?.is_primary) {
          useShopStore.getState().setPrimaryCustomerContact(updatedContact.customer_id, updatedContact.id);
          updatedContact.is_primary = true;
        }

        return updatedContact ? { success: true, contact: updatedContact } : { success: false, error: 'Contact not found' };
      },

      deleteCustomerContact: (contactId) => {
        const state = get();
        if (!state.customerContacts.some((c) => c.id === contactId)) return false;
        set((s) => ({
          customerContacts: s.customerContacts.filter((c) => c.id !== contactId),
        }));
        return true;
      },

      // Units
      units: [...SAMPLE_UNITS],

      addUnit: (unit) => {
        const newUnit: Unit = {
          ...unit,
          id: generateId(),
          is_active: true,
          created_at: now(),
          updated_at: now(),
        };
        set((state) => ({
          units: [...state.units, newUnit],
        }));
        return newUnit;
      },

      updateUnit: (id, unit) =>
        set((state) => ({
          units: state.units.map((u) =>
            u.id === id ? { ...u, ...unit, updated_at: now() } : u
          ),
        })),

      deactivateUnit: (id) =>
        set((state) => ({
          units: state.units.map((u) =>
            u.id === id ? { ...u, is_active: false, updated_at: now() } : u
          ),
        })),

      getUnitsByCustomer: (customerId) =>
        get().units.filter((u) => u.customer_id === customerId && u.is_active),

      // Unit Attachments
      unitAttachments: [],

      listUnitAttachments: (unitId) =>
        get()
          .unitAttachments.filter((att) => att.unit_id === unitId)
          .sort((a, b) => {
            if (a.is_primary && !b.is_primary) return -1;
            if (!a.is_primary && b.is_primary) return 1;
            return a.sort_order - b.sort_order;
          }),

      addUnitAttachment: (unitId, file, options) => {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        const sizeLimit = 10 * 1024 * 1024; // 10MB

        if (!file.type.startsWith('image/') && !allowedTypes.some((t) => file.type === t)) {
          return { success: false, error: 'Only image files are allowed' };
        }
        if (file.size > sizeLimit) {
          return { success: false, error: 'File too large. Max 10MB.' };
        }

        const existingAttachments = get().unitAttachments.filter((a) => a.unit_id === unitId);
        const maxSortOrder = existingAttachments.reduce((max, a) => Math.max(max, a.sort_order), 0);

        const attachment: UnitAttachment = {
          id: generateId(),
          unit_id: unitId,
          filename: file.name,
          mime_type: file.type || 'application/octet-stream',
          size_bytes: file.size,
          local_url: URL.createObjectURL(file),
          tag: options?.tag ?? 'GENERAL',
          notes: options?.notes ?? null,
          is_primary: existingAttachments.length === 0, // First image is primary by default
          sort_order: maxSortOrder + 1,
          created_at: now(),
          updated_at: now(),
        };

        set((state) => ({
          unitAttachments: [...state.unitAttachments, attachment],
        }));

        return { success: true, attachment };
      },

      removeUnitAttachment: (attachmentId) => {
        const att = get().unitAttachments.find((a) => a.id === attachmentId);
        if (!att) return;

        if (att.local_url) {
          URL.revokeObjectURL(att.local_url);
        }

        const wasPrimary = att.is_primary;
        const unitId = att.unit_id;

        set((state) => ({
          unitAttachments: state.unitAttachments.filter((a) => a.id !== attachmentId),
        }));

        // If deleted was primary, make first remaining image primary
        if (wasPrimary) {
          const remaining = get().unitAttachments.filter((a) => a.unit_id === unitId);
          if (remaining.length > 0) {
            const sorted = [...remaining].sort((a, b) => a.sort_order - b.sort_order);
            get().setUnitAttachmentPrimary(sorted[0].id);
          }
        }
      },

      updateUnitAttachment: (attachmentId, patch) => {
        set((state) => ({
          unitAttachments: state.unitAttachments.map((att) =>
            att.id === attachmentId ? { ...att, ...patch, updated_at: now() } : att
          ),
        }));
      },

      setUnitAttachmentPrimary: (attachmentId) => {
        const att = get().unitAttachments.find((a) => a.id === attachmentId);
        if (!att) return;

        set((state) => ({
          unitAttachments: state.unitAttachments.map((a) => {
            if (a.unit_id !== att.unit_id) return a;
            return {
              ...a,
              is_primary: a.id === attachmentId,
              updated_at: a.id === attachmentId ? now() : a.updated_at,
            };
          }),
        }));
      },

      reorderUnitAttachments: (unitId, orderedIds) => {
        set((state) => ({
          unitAttachments: state.unitAttachments.map((att) => {
            if (att.unit_id !== unitId) return att;
            const newOrder = orderedIds.indexOf(att.id);
            if (newOrder === -1) return att;
            return { ...att, sort_order: newOrder, updated_at: now() };
          }),
        }));
      },

      // Vendors
      vendors: [...SAMPLE_VENDORS],

      addVendor: (vendor) => {
        const newVendor: Vendor = {
          ...vendor,
          id: generateId(),
          is_active: true,
          created_at: now(),
          updated_at: now(),
        };
        set((state) => ({
          vendors: [...state.vendors, newVendor],
        }));
        return newVendor;
      },

      updateVendor: (id, vendor) =>
        set((state) => ({
          vendors: state.vendors.map((v) =>
            v.id === id ? { ...v, ...vendor, updated_at: now() } : v
          ),
        })),

      deactivateVendor: (id) =>
        set((state) => ({
          vendors: state.vendors.map((v) =>
            v.id === id ? { ...v, is_active: false, updated_at: now() } : v
          ),
        })),

      // Categories
      categories: [...SAMPLE_CATEGORIES],

      addCategory: (category) => {
        const newCategory: PartCategory = {
          ...category,
          id: generateId(),
          is_active: true,
          created_at: now(),
          updated_at: now(),
        };
        set((state) => ({
          categories: [...state.categories, newCategory],
        }));
        return newCategory;
      },

      updateCategory: (id, category) =>
        set((state) => ({
          categories: state.categories.map((c) =>
            c.id === id ? { ...c, ...category, updated_at: now() } : c
          ),
        })),

      deactivateCategory: (id) =>
        set((state) => ({
          categories: state.categories.map((c) =>
            c.id === id ? { ...c, is_active: false, updated_at: now() } : c
          ),
        })),

      // Parts
      parts: [...SAMPLE_PARTS],
      kitComponents: [],

      addPart: (part) => {
        const newPart: Part = {
          ...part,
          id: generateId(),
          min_qty: part.min_qty ?? null,
          max_qty: part.max_qty ?? null,
          bin_location: part.bin_location ?? null,
          last_cost: part.last_cost ?? null,
          avg_cost: part.avg_cost ?? null,
          model: part.model ?? null,
          serial_number: part.serial_number ?? null,
          barcode: part.barcode ?? null,
          is_kit: part.is_kit ?? false,
          is_active: true,
          created_at: now(),
          updated_at: now(),
        };
        set((state) => ({
          parts: [...state.parts, newPart],
        }));
        return newPart;
      },

      updatePart: (id, part) =>
        set((state) => ({
          parts: state.parts.map((p) =>
            p.id === id ? { ...p, ...part, updated_at: now() } : p
          ),
        })),

      updatePartWithQohAdjustment: (id, part, meta) => {
        const state = get();
        const existing = state.parts.find((p) => p.id === id);
        if (!existing) return { success: false, error: 'Part not found' };

        const old_qty = existing.quantity_on_hand;
        const new_qty = part.quantity_on_hand ?? old_qty;
        const qtyProvided = part.quantity_on_hand !== undefined;
        const deltaQty = new_qty - old_qty;
        const candidate = meta.adjusted_by?.trim();
        const performer = candidate && candidate !== 'system' ? candidate : get().getSessionUserName();
        const timestamp = now();
        const policy = state.settings.inventory_negative_qoh_policy ?? 'WARN';
        if (qtyProvided && new_qty < 0 && policy === 'BLOCK') {
          return { success: false, error: 'Negative inventory is blocked by policy' };
        }

        set((state) => ({
          parts: state.parts.map((p) =>
            p.id === id ? { ...p, ...part, updated_at: timestamp } : p
          ),
          inventoryAdjustments: [
            ...state.inventoryAdjustments,
            {
              id: generateId(),
              part_id: id,
              old_qty,
              new_qty,
              delta: deltaQty,
              reason: meta.reason,
              adjusted_by: performer,
              adjusted_at: timestamp,
            },
          ],
        }));

        let warning: string | undefined;
        if (qtyProvided && new_qty < 0 && policy === 'WARN') {
          warning = 'Negative inventory allowed (policy=WARN)';
        }
        if (qtyProvided && deltaQty !== 0) {
          get().recordInventoryMovement({
            part_id: id,
            movement_type: 'ADJUST',
            qty_delta: deltaQty,
            reason: meta.reason,
            ref_type: 'MANUAL',
            ref_id: id,
            performed_by: performer,
            performed_at: timestamp,
          });
        }
        return { success: true, warning };
      },

      deactivatePart: (id) =>
        set((state) => ({
          parts: state.parts.map((p) =>
            p.id === id ? { ...p, is_active: false, updated_at: now() } : p
          ),
        })),
      reactivatePart: (id) =>
        set((state) => ({
          parts: state.parts.map((p) =>
            p.id === id ? { ...p, is_active: true, updated_at: now() } : p
          ),
        })),
      receiveInventory: (payload) => {
        const lines = payload.lines || [];
        if (lines.length === 0) return { success: false, error: 'No lines to receive' };
        const timestamp = payload.received_at || now();
        const ref = payload.reference?.trim() || null;
        const performer = get().getSessionUserName();
        const sourceType = payload.source_type || 'MANUAL';
        const sourceId = payload.source_id || null;

        const totals = new Map<string, { qty: number; unit_cost?: number | null }>();
        for (const line of lines) {
          if (!line.part_id) return { success: false, error: 'Part required' };
          if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
            return { success: false, error: 'Quantity must be greater than 0' };
          }
          const existing = totals.get(line.part_id) || { qty: 0, unit_cost: line.unit_cost };
          totals.set(line.part_id, { qty: existing.qty + line.quantity, unit_cost: line.unit_cost ?? existing.unit_cost });
        }

        const state = get();
        for (const [partId] of totals) {
          const part = state.parts.find((p) => p.id === partId);
          if (!part) return { success: false, error: `Part not found: ${partId}` };
        }

        // Update parts with quantities and cost
        set((state) => ({
          parts: state.parts.map((p) => {
            const entry = totals.get(p.id);
            if (!entry) return p;
            const oldQoh = p.quantity_on_hand;
            const qty = entry.qty;
            const unitCost = entry.unit_cost ?? p.last_cost ?? null;
            let avgCost = p.avg_cost;
            if (unitCost != null) {
              if (avgCost === null || oldQoh <= 0) {
                avgCost = unitCost;
              } else {
                avgCost = ((avgCost * oldQoh) + (unitCost * qty)) / (oldQoh + qty);
              }
            }
            return {
              ...p,
              quantity_on_hand: p.quantity_on_hand + qty,
              last_cost: unitCost ?? p.last_cost ?? null,
              avg_cost: avgCost ?? p.avg_cost ?? null,
              updated_at: timestamp,
            };
          }),
          vendorCostHistory: [
            ...state.vendorCostHistory,
            ...Array.from(totals.entries())
              .filter(([, v]) => v.unit_cost != null)
              .map(([partId, v]) => ({
                id: generateId(),
                part_id: partId,
                vendor_id: payload.vendor_id || state.parts.find((p) => p.id === partId)?.vendor_id || null,
                unit_cost: v.unit_cost as number,
                quantity: v.qty,
                source: 'RECEIVING' as const,
                created_at: timestamp,
              })),
          ],
      receivingReceipts: [
        ...state.receivingReceipts,
        {
          id: generateId(),
          vendor_id: payload.vendor_id || null,
          reference: ref,
          received_at: timestamp,
          received_by: performer,
          source_type: sourceType,
          source_id: sourceId,
          lines: Array.from(totals.entries()).map(([part_id, v]) => ({
            part_id,
            quantity: v.qty,
            unit_cost: v.unit_cost ?? null,
          })),
        },
      ],
        }));

        totals.forEach((entry, partId) => {
          const reason = `RECEIVE: ${ref || (sourceType === 'PURCHASE_ORDER' ? 'PO' : 'manual')}`;
          get().recordInventoryMovement({
            part_id: partId,
            movement_type: 'RECEIVE',
            qty_delta: entry.qty,
            reason,
            ref_type: sourceType === 'PURCHASE_ORDER' ? 'PURCHASE_ORDER' : 'MANUAL',
            ref_id: sourceId || ref,
            performed_by: performer,
            performed_at: timestamp,
          });
        });

        if (sourceType === 'PURCHASE_ORDER' && sourceId) {
          set((state) => {
            const updatedLines = state.purchaseOrderLines.map((l) => {
              if (l.purchase_order_id !== sourceId) return l;
              const entry = totals.get(l.part_id);
              if (!entry) return l;
              const remaining = l.ordered_quantity - l.received_quantity;
              const received = Math.min(entry.qty, remaining);
              return { ...l, received_quantity: l.received_quantity + received, updated_at: timestamp };
            });
            const linesForOrder = updatedLines.filter((l) => l.purchase_order_id === sourceId);
            const allReceived = linesForOrder.every((l) => l.received_quantity >= l.ordered_quantity);
            return {
              purchaseOrderLines: updatedLines,
              purchaseOrders: state.purchaseOrders.map((o) =>
                o.id === sourceId ? { ...o, status: allReceived ? 'CLOSED' : o.status, updated_at: timestamp } : o
              ),
            };
          });
        }

        return { success: true };
      },

      addKitComponent: (component) => {
        const newComponent: PartKitComponent = {
          ...component,
          id: generateId(),
          is_active: true,
          created_at: now(),
          updated_at: now(),
        };
        set((state) => ({
          kitComponents: [...state.kitComponents, newComponent],
        }));
        return newComponent;
      },

      updateKitComponentQuantity: (id, quantity) => {
        set((state) => ({
          kitComponents: state.kitComponents.map((c) =>
            c.id === id ? { ...c, quantity, updated_at: now() } : c
          ),
        }));
      },

      removeKitComponent: (id) => {
        set((state) => ({
          kitComponents: state.kitComponents.map((c) =>
            c.id === id ? { ...c, is_active: false, updated_at: now() } : c
          ),
        }));
      },

      // Technicians
      technicians: [...SAMPLE_TECHNICIANS],

      addTechnician: (technician) => {
        const defaultSchedule = buildDefaultSchedule();
        const newTechnician: Technician = {
          ...technician,
          employment_type: technician.employment_type ?? 'HOURLY',
          skill_tags: technician.skill_tags ?? [],
          work_schedule: {
            ...defaultSchedule,
            ...(technician.work_schedule || {}),
            days: {
              ...defaultSchedule.days,
              ...(technician.work_schedule?.days || {}),
            },
          },
          certifications: technician.certifications ?? [],
          id: generateId(),
          is_active: technician.is_active ?? true,
          created_at: now(),
          updated_at: now(),
        };
        set((state) => ({
          technicians: [...state.technicians, newTechnician],
        }));
        return newTechnician;
      },

      updateTechnician: (id, technician) =>
        set((state) => ({
          technicians: state.technicians.map((t) =>
            t.id === id ? { ...t, ...technician, updated_at: now() } : t
          ),
        })),

      deactivateTechnician: (id) =>
        set((state) => ({
          technicians: state.technicians.map((t) =>
            t.id === id ? { ...t, is_active: false, updated_at: now() } : t
          ),
        })),

      // Time Entries
      timeEntries: [],
      workOrderTimeEntries: [],

      clockIn: (technicianId, workOrderId) => {
        const state = get();
        
        // Check if work order exists and is not invoiced
        const workOrder = state.workOrders.find((wo) => wo.id === workOrderId);
        if (!workOrder) return { success: false, error: 'Work order not found' };
        if (workOrder.status === 'INVOICED') return { success: false, error: 'Cannot clock into invoiced order' };

        // Check if technician is active
        const technician = state.technicians.find((t) => t.id === technicianId);
        if (!technician || !technician.is_active) return { success: false, error: 'Technician not found or inactive' };

        // Auto clock-out from any current job
        const activeEntry = state.timeEntries.find((te) => te.technician_id === technicianId && !te.clock_out);
        if (activeEntry) {
          const clockOutTime = now();
          const clockInDate = new Date(activeEntry.clock_in);
          const clockOutDate = new Date(clockOutTime);
          const totalMinutes = Math.round((clockOutDate.getTime() - clockInDate.getTime()) / 60000);

          set((state) => ({
            timeEntries: state.timeEntries.map((te) =>
              te.id === activeEntry.id
                ? { ...te, clock_out: clockOutTime, total_minutes: totalMinutes, updated_at: now() }
                : te
            ),
          }));

          // Recalculate that work order
          get().recalculateWorkOrderTotals(activeEntry.work_order_id);
        }

        // Create new time entry
        const newEntry: TimeEntry = {
          id: generateId(),
          technician_id: technicianId,
          work_order_id: workOrderId,
          clock_in: now(),
          clock_out: null,
          total_minutes: 0,
          created_at: now(),
          updated_at: now(),
        };

        set((state) => ({
          timeEntries: [...state.timeEntries, newEntry],
        }));

        // Auto-update work order status to IN_PROGRESS
        if (workOrder.status === 'OPEN') {
          set((state) => ({
            workOrders: state.workOrders.map((wo) =>
              wo.id === workOrderId ? { ...wo, status: 'IN_PROGRESS', updated_at: now() } : wo
            ),
          }));
        }

        return { success: true };
      },

      clockOut: (technicianId) => {
        const state = get();
        const activeEntry = state.timeEntries.find((te) => te.technician_id === technicianId && !te.clock_out);
        
        if (!activeEntry) return { success: false, error: 'No active clock-in found' };

        const clockOutTime = now();
        const clockInDate = new Date(activeEntry.clock_in);
        const clockOutDate = new Date(clockOutTime);
        const totalMinutes = Math.round((clockOutDate.getTime() - clockInDate.getTime()) / 60000);

        set((state) => ({
          timeEntries: state.timeEntries.map((te) =>
            te.id === activeEntry.id
              ? { ...te, clock_out: clockOutTime, total_minutes: totalMinutes, updated_at: now() }
              : te
          ),
        }));

        get().recalculateWorkOrderTotals(activeEntry.work_order_id);
        return { success: true };
      },

      getActiveTimeEntry: (technicianId) =>
        get().timeEntries.find((te) => te.technician_id === technicianId && !te.clock_out),

      getTimeEntriesByWorkOrder: (workOrderId) =>
        get().timeEntries.filter((te) => te.work_order_id === workOrderId),

      // Scheduling
      scheduleItems: [],

      listScheduleItems: () => get().scheduleItems,

      getScheduleItemsByWorkOrder: (workOrderId) =>
        get().scheduleItems.filter((item) => item.source_ref_id === workOrderId),

      createScheduleItem: (item) => {
        const timestamp = now();
        const newItem: ScheduleItem = {
          ...item,
          id: item.id ?? generateId(),
          source_ref_type: item.source_ref_type ?? 'WORK_ORDER',
          technician_id: item.technician_id ?? null,
          promised_at: item.promised_at ?? null,
          notes: item.notes ?? null,
          parts_ready: item.parts_ready ?? false,
          auto_scheduled: item.auto_scheduled ?? false,
          block_type: item.block_type ?? null,
          block_title: item.block_title ?? null,
          created_at: timestamp,
          updated_at: timestamp,
        };
        set((state) => ({
          scheduleItems: [...state.scheduleItems, newItem],
        }));
        return newItem;
      },

      updateScheduleItem: (id, patch) => {
        let updated: ScheduleItem | null = null;
        const timestamp = now();
        set((state) => ({
          scheduleItems: state.scheduleItems.map((item) => {
            if (item.id !== id) return item;
            updated = { ...item, ...patch, updated_at: timestamp };
            return updated;
          }),
        }));
        return updated;
      },

      removeScheduleItem: (id) =>
        set((state) => ({
          scheduleItems: state.scheduleItems.filter((item) => item.id !== id),
        })),

      detectScheduleConflicts: (itemInput) => {
        const state = get();
        if (!itemInput) return [];
        const candidate =
          typeof itemInput === 'string'
            ? state.scheduleItems.find((item) => item.id === itemInput)
            : itemInput.id
              ? {
                  ...state.scheduleItems.find((item) => item.id === itemInput.id),
                  ...itemInput,
                }
              : itemInput;

        if (!candidate || !candidate.technician_id) return [];

        const startMs = new Date(candidate.start_at).getTime();
        const endMs = startMs + candidate.duration_minutes * 60000;
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return [];

        return state.scheduleItems.filter((item) => {
          if (item.technician_id !== candidate.technician_id) return false;
          if (candidate.id && item.id === candidate.id) return false;
          const itemStart = new Date(item.start_at).getTime();
          const itemEnd = itemStart + item.duration_minutes * 60000;
          return startMs < itemEnd && endMs > itemStart;
        });
      },

      // Sales Orders
      salesOrders: [],
      salesOrderLines: [],
      salesOrderChargeLines: [],

      createSalesOrder: (customerId, unitId) => {
        const state = get();
        const customer = state.customers.find((c) => c.id === customerId);
        const taxRate = resolveTaxRateForCustomer(customer, state.settings);
        const newOrder: SalesOrder = {
          id: generateId(),
          order_number: generateOrderNumber('SO', state.salesOrders.length),
          customer_id: customerId,
          unit_id: unitId,
          status: 'ESTIMATE',
          notes: null,
          tax_rate: taxRate,
          charge_subtotal: 0,
          subtotal: 0,
          core_charges_total: 0,
          tax_amount: 0,
          total: 0,
          invoiced_at: null,
          created_at: now(),
          updated_at: now(),
        };
        set((state) => ({
          salesOrders: [...state.salesOrders, newOrder],
        }));
        return newOrder;
      },

      soAddPartLine: (orderId, partId, qty) => {
        const state = get();
        const order = state.salesOrders.find((o) => o.id === orderId);
        
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status === 'INVOICED') return { success: false, error: 'Cannot modify invoiced order' };
        
        const part = state.parts.find((p) => p.id === partId);
        if (!part) return { success: false, error: 'Part not found' };

        const customer = state.customers.find((c) => c.id === order.customer_id);
        const level = customer?.price_level ?? 'RETAIL';
        const suggested = calcPartPriceForLevel(part, state.settings, level);
        const unitPrice = suggested ?? part.selling_price ?? 0;

        const existingLine = state.salesOrderLines.find(
          (l) => l.sales_order_id === orderId && l.part_id === partId
        );

        if (existingLine) {
          const newQty = existingLine.quantity + qty;
          const lineTotal = newQty * existingLine.unit_price;
          
          set((state) => ({
            salesOrderLines: state.salesOrderLines.map((l) =>
              l.id === existingLine.id
                ? { ...l, quantity: newQty, line_total: lineTotal, updated_at: now() }
                : l
            ),
          }));
        } else {
          const newLine: SalesOrderLine = {
            id: generateId(),
            sales_order_id: orderId,
            part_id: partId,
            quantity: qty,
            unit_price: unitPrice,
            line_total: qty * unitPrice,
            is_warranty: false,
            core_charge: part.core_required ? part.core_charge : 0,
            core_returned: false,
            core_status: part.core_required && part.core_charge > 0 ? 'CORE_OWED' : 'NOT_APPLICABLE',
            core_returned_at: null,
            core_refunded_at: null,
            is_core_refund_line: false,
            core_refund_for_line_id: null,
            description: null,
            created_at: now(),
            updated_at: now(),
          };

          set((state) => ({
            salesOrderLines: [...state.salesOrderLines, newLine],
          }));
        }

        get().recalculateSalesOrderTotals(orderId);
        return { success: true };
      },

      soUpdatePartQty: (lineId, newQty) => {
        const state = get();
        const line = state.salesOrderLines.find((l) => l.id === lineId);
        if (!line) return { success: false, error: 'Line not found' };

        const order = state.salesOrders.find((o) => o.id === line.sales_order_id);
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status === 'INVOICED' || order.status === 'CANCELLED') return { success: false, error: 'Cannot modify locked order' };

        const delta = line.quantity - newQty;
        const lineTotal = newQty * line.unit_price;

        set((state) => ({
          salesOrderLines: state.salesOrderLines.map((l) =>
            l.id === lineId
              ? { ...l, quantity: newQty, line_total: lineTotal, updated_at: now() }
              : l
          ),
        }));

        get().recalculateSalesOrderTotals(line.sales_order_id);
        return { success: true };
      },

      soUpdateLineUnitPrice: (lineId, newUnitPrice) => {
        const state = get();
        const line = state.salesOrderLines.find((l) => l.id === lineId);
        if (!line) return { success: false, error: 'Line not found' };

        const order = state.salesOrders.find((o) => o.id === line.sales_order_id);
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status === 'INVOICED' || order.status === 'CANCELLED') return { success: false, error: 'Cannot modify locked order' };

        if (!Number.isFinite(newUnitPrice) || newUnitPrice < 0) {
          return { success: false, error: 'Invalid unit price' };
        }

        const updatedLineTotal = line.quantity * newUnitPrice;

        set((state) => ({
          salesOrderLines: state.salesOrderLines.map((l) =>
            l.id === lineId ? { ...l, unit_price: newUnitPrice, line_total: updatedLineTotal, updated_at: now() } : l
          ),
        }));

        get().recalculateSalesOrderTotals(line.sales_order_id);
        return { success: true };
      },

      soRemovePartLine: (lineId) => {
        const state = get();
        const line = state.salesOrderLines.find((l) => l.id === lineId);
        if (!line) return { success: false, error: 'Line not found' };

        const order = state.salesOrders.find((o) => o.id === line.sales_order_id);
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status === 'INVOICED' || order.status === 'CANCELLED') return { success: false, error: 'Cannot modify locked order' };

        set((state) => ({
          salesOrderLines: state.salesOrderLines.filter((l) => l.id !== lineId),
        }));

        get().recalculateSalesOrderTotals(line.sales_order_id);
        return { success: true };
      },

      soToggleWarranty: (lineId) => {
        const state = get();
        const line = state.salesOrderLines.find((l) => l.id === lineId);
        if (!line) return { success: false, error: 'Line not found' };

        const order = state.salesOrders.find((o) => o.id === line.sales_order_id);
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status === 'INVOICED' || order.status === 'CANCELLED') return { success: false, error: 'Cannot modify locked order' };

        set((state) => ({
          salesOrderLines: state.salesOrderLines.map((l) =>
            l.id === lineId ? { ...l, is_warranty: !l.is_warranty, updated_at: now() } : l
          ),
        }));

        get().recalculateSalesOrderTotals(line.sales_order_id);
        return { success: true };
      },

      soToggleCoreReturned: (lineId) => {
        const state = get();
        const line = state.salesOrderLines.find((l) => l.id === lineId);
        if (!line) return { success: false, error: 'Line not found' };

        const order = state.salesOrders.find((o) => o.id === line.sales_order_id);
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status === 'INVOICED' || order.status === 'CANCELLED') return { success: false, error: 'Cannot modify locked order' };

        set((state) => ({
          salesOrderLines: state.salesOrderLines.map((l) =>
            l.id === lineId ? { ...l, core_returned: !l.core_returned, updated_at: now() } : l
          ),
        }));

        get().recalculateSalesOrderTotals(line.sales_order_id);
        return { success: true };
      },

      soMarkCoreReturned: (lineId) => {
        const state = get();
        const line = state.salesOrderLines.find((l) => l.id === lineId);
        if (!line) return { success: false, error: 'Line not found' };
        if (line.core_status !== 'CORE_OWED') return { success: false, error: 'Core has already been processed' };
        if (line.is_core_refund_line) return { success: false, error: 'Cannot mark refund line as returned' };

        const order = state.salesOrders.find((o) => o.id === line.sales_order_id);
        if (!order) return { success: false, error: 'Order not found' };

        const part = state.parts.find((p) => p.id === line.part_id);
        const partDesc = part?.description || part?.part_number || 'Part';
        const timestamp = now();

        // Create refund line
        const refundLine: SalesOrderLine = {
          id: generateId(),
          sales_order_id: line.sales_order_id,
          part_id: line.part_id,
          quantity: line.quantity,
          unit_price: -line.core_charge,
          line_total: -(line.core_charge * line.quantity),
          is_warranty: false,
          core_charge: 0,
          core_returned: true,
          core_status: 'NOT_APPLICABLE',
          core_returned_at: null,
          core_refunded_at: null,
          is_core_refund_line: true,
          core_refund_for_line_id: lineId,
          description: `Core Refund (${partDesc})`,
          created_at: timestamp,
          updated_at: timestamp,
        };

        // Update original line status and add refund line
        set((state) => ({
          salesOrderLines: [
            ...state.salesOrderLines.map((l) =>
              l.id === lineId
                ? {
                    ...l,
                    core_returned: true,
                    core_status: 'CORE_CREDITED' as const,
                    core_returned_at: timestamp,
                    core_refunded_at: timestamp,
                    updated_at: timestamp,
                  }
                : l
            ),
            refundLine,
          ],
        }));

        get().recalculateSalesOrderTotals(line.sales_order_id);
        return { success: true };
      },

      soInvoice: (orderId) => {
        const state = get();
        const order = state.salesOrders.find((o) => o.id === orderId);
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status === 'INVOICED') return { success: false, error: 'Order already invoiced' };
        if (order.status !== 'OPEN') return { success: false, error: 'Order must be open before invoicing' };

        const linesForOrder = state.salesOrderLines.filter(
          (l) => l.sales_order_id === orderId && !l.is_core_refund_line
        );
        const consumptionByPart = linesForOrder.reduce<Record<string, number>>((acc, line) => {
          if (!line.part_id) return acc;
          const part = state.parts.find((p) => p.id === line.part_id);
          if (part?.is_kit) {
            const kitDeltas = getKitComponentDeltas(part.id, line.quantity, state.kitComponents);
            Object.entries(kitDeltas).forEach(([componentId, qty]) => {
              acc[componentId] = (acc[componentId] || 0) + qty;
            });
            return acc;
          }
          acc[line.part_id] = (acc[line.part_id] || 0) + line.quantity;
          return acc;
        }, {});
        const projectedQuantities = state.parts.reduce<Record<string, number>>((acc, part) => {
          const qty = consumptionByPart[part.id] || 0;
          acc[part.id] = part.quantity_on_hand - qty;
          return acc;
        }, {});
        const timestamp = now();

        set((state) => ({
          salesOrders: state.salesOrders.map((o) =>
            o.id === orderId
              ? { ...o, status: 'INVOICED', invoiced_at: timestamp, updated_at: timestamp }
              : o
          ),
          parts: state.parts.map((p) => {
            const qty = consumptionByPart[p.id];
            if (!qty) return p;
            return { ...p, quantity_on_hand: p.quantity_on_hand - qty, updated_at: timestamp };
          }),
        }));
        Object.entries(consumptionByPart).forEach(([partId, qty]) => {
          if (!qty) return;
          get().recordInventoryMovement({
            part_id: partId,
            movement_type: 'ISSUE',
            qty_delta: -qty,
            reason: `SO ${order.order_number || order.id} invoice`,
            ref_type: 'SALES_ORDER',
            ref_id: order.id,
            performed_at: timestamp,
          });
        });
        createPOsForNegativeInventory(
          projectedQuantities,
          order.order_number ? `SO ${order.order_number}` : `SO ${order.id}`
        );
        return { success: true };
      },

      soConvertToOpen: (orderId) => {
        const state = get();
        const order = state.salesOrders.find((o) => o.id === orderId);
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status === 'INVOICED') return { success: false, error: 'Cannot convert invoiced order' };
        if (order.status === 'OPEN') return { success: true };

        set((state) => ({
          salesOrders: state.salesOrders.map((o) =>
            o.id === orderId ? { ...o, status: 'OPEN', invoiced_at: null, updated_at: now() } : o
          ),
        }));

        return { success: true };
      },

      soSetStatus: (orderId, status) => {
        const order = get().salesOrders.find((o) => o.id === orderId);
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status === 'INVOICED') return { success: false, error: 'Cannot change invoiced order' };
        const allowed: SalesOrderStatus[] = ['OPEN', 'ESTIMATE', 'PARTIAL', 'COMPLETED', 'CANCELLED'];
        if (!allowed.includes(status)) return { success: false, error: 'Unsupported status' };
        const timestamp = now();
        set((state) => ({
          salesOrders: state.salesOrders.map((o) =>
            o.id === orderId ? { ...o, status, updated_at: timestamp } : o
          ),
        }));
        return { success: true };
      },

      getSalesOrderLines: (orderId) =>
        get().salesOrderLines.filter((l) => l.sales_order_id === orderId),

      getSalesOrderChargeLines: (orderId) =>
        get().salesOrderChargeLines.filter((l) => l.sales_order_id === orderId),

      addSalesOrderChargeLine: (line) => {
        if (line.qty <= 0) return null;
        const timestamp = now();
        const chargeLine: SalesOrderChargeLine = {
          ...line,
          id: line.id ?? generateId(),
          total_price: line.qty * line.unit_price,
          created_at: timestamp,
          updated_at: timestamp,
        };
        set((state) => ({
          salesOrderChargeLines: [
            ...state.salesOrderChargeLines.filter((l) => l.id !== chargeLine.id),
            chargeLine,
          ],
        }));
        get().recalculateSalesOrderTotals(chargeLine.sales_order_id);
        return chargeLine;
      },

      updateSalesOrderChargeLine: (id, patch) => {
        const state = get();
        const existing = state.salesOrderChargeLines.find((l) => l.id === id);
        if (!existing) return;
        const qty = patch.qty ?? existing.qty;
        const unit_price = patch.unit_price ?? existing.unit_price;
        const updated: SalesOrderChargeLine = {
          ...existing,
          ...patch,
          qty,
          unit_price,
          total_price: qty * unit_price,
          updated_at: now(),
        };
        set((state) => ({
          salesOrderChargeLines: state.salesOrderChargeLines.map((l) =>
            l.id === id ? updated : l
          ),
        }));
        get().recalculateSalesOrderTotals(updated.sales_order_id);
      },

      removeSalesOrderChargeLine: (id) => {
        const state = get();
        const line = state.salesOrderChargeLines.find((l) => l.id === id);
        if (!line) return;
        set((state) => ({
          salesOrderChargeLines: state.salesOrderChargeLines.filter((l) => l.id !== id),
        }));
        get().recalculateSalesOrderTotals(line.sales_order_id);
      },

      updateSalesOrderNotes: (orderId, notes) =>
        set((state) => ({
          salesOrders: state.salesOrders.map((o) =>
            o.id === orderId ? { ...o, notes, updated_at: now() } : o
          ),
        })),

      recalculateSalesOrderTotals: (orderId: string) => {
        const state = get();
        const lines = state.salesOrderLines.filter((l) => l.sales_order_id === orderId);
        const chargeLines = state.salesOrderChargeLines.filter((l) => l.sales_order_id === orderId);
        
        // Calculate subtotal (warranty items are $0 to customer, include refund lines)
        const subtotal = lines.reduce((sum, l) => {
          if (l.is_warranty) return sum;
          // Refund lines have negative line_total and should be included
          return sum + l.line_total;
        }, 0);

        const charge_subtotal = chargeLines.reduce((sum, l) => sum + l.total_price, 0);
        
        // Calculate core charges (only for non-returned cores, exclude refund lines which are already in subtotal)
        const core_charges_total = lines.reduce((sum, l) => {
          if (l.is_core_refund_line) return sum; // Refund lines already included in subtotal
          if (l.core_charge > 0 && !l.core_returned) {
            return sum + (l.core_charge * l.quantity);
          }
          return sum;
        }, 0);
        
        const order = state.salesOrders.find((o) => o.id === orderId);
        if (!order) return;
        const customer = state.customers.find((c) => c.id === order.customer_id);
        const tax_rate = resolveTaxRateForCustomer(customer, state.settings);
        
        const taxableAmount = subtotal + core_charges_total + charge_subtotal;
        const tax_amount = taxableAmount * (tax_rate / 100);
        const total = taxableAmount + tax_amount;

        set((state) => ({
          salesOrders: state.salesOrders.map((o) =>
            o.id === orderId
              ? { ...o, subtotal, core_charges_total, charge_subtotal, tax_rate, tax_amount, total, updated_at: now() }
              : o
          ),
        }));
      },

      postPlasmaJobToSalesOrder: (plasmaJobId) => {
        const state = get();
        const job = state.plasmaJobs.find((j) => j.id === plasmaJobId);
        if (!job) return { success: false, error: 'Plasma job not found' };
        if (!job.sales_order_id) return { success: false, error: 'Plasma job is not linked to a sales order' };
        const order = state.salesOrders.find((o) => o.id === job.sales_order_id);
        if (!order) return { success: false, error: 'Sales order not found' };
        if (order.status === 'INVOICED') return { success: false, error: 'Cannot post to invoiced sales order' };

        const calculation = job.calculated_at ? { success: true } : get().recalculatePlasmaJob(plasmaJobId);
        if (!calculation?.success) return calculation;
        const updatedLines = get().plasmaJobLines.filter((l) => l.plasma_job_id === plasmaJobId);
        const totalPrice = updatedLines.reduce((sum, line) => sum + line.sell_price_total, 0);
        const description = `Plasma Job ${job.id}`;
        upsertPlasmaChargeLine({
          target: 'SALES_ORDER',
          orderId: job.sales_order_id,
          plasmaJobId,
          description,
          totalPrice,
        });
        set((state) => ({
          plasmaJobs: state.plasmaJobs.map((j) =>
            j.id === plasmaJobId
              ? { ...j, status: j.status === 'CUT' ? 'CUT' : 'APPROVED', posted_at: now(), updated_at: now() }
              : j
          ),
        }));
        return { success: true };
      },

      listPlasmaAttachments: (plasmaJobId) =>
        get().plasmaAttachments.filter((att) => att.plasma_job_id === plasmaJobId),

      updatePlasmaAttachment: (attachmentId, patch) => {
        set((state) => ({
          plasmaAttachments: state.plasmaAttachments.map((att) =>
            att.id === attachmentId ? { ...att, ...patch, updated_at: now() } : att
          ),
        }));
      },

      addPlasmaAttachment: (plasmaJobId, file, options) => {
        const allowed = ['dxf', 'pdf', 'png', 'jpg', 'jpeg'];
        const sizeLimit = 25 * 1024 * 1024;
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (!allowed.includes(ext)) {
          return { success: false, error: 'File type not allowed. Allowed: DXF, PDF, PNG, JPG.' };
        }
        if (file.size > sizeLimit) {
          return { success: false, error: 'File too large. Max 25MB.' };
        }
        const kindMap: Record<string, PlasmaJobAttachmentKind> = {
          dxf: 'DXF',
          pdf: 'PDF',
          png: 'IMAGE',
          jpg: 'IMAGE',
          jpeg: 'IMAGE',
        };
        const attachment: PlasmaJobAttachment = {
          id: generateId(),
          plasma_job_id: plasmaJobId,
          filename: file.name,
          mime_type: file.type || 'application/octet-stream',
          size_bytes: file.size,
          kind: kindMap[ext] ?? 'OTHER',
          notes: options?.notes ?? null,
          local_url: URL.createObjectURL(file),
          created_at: now(),
          updated_at: now(),
        };
        set((state) => ({
          plasmaAttachments: [...state.plasmaAttachments, attachment],
        }));
        return { success: true };
      },

      removePlasmaAttachment: (attachmentId) => {
        const att = get().plasmaAttachments.find((a) => a.id === attachmentId);
        if (att?.local_url) {
          URL.revokeObjectURL(att.local_url);
        }
        set((state) => ({
          plasmaAttachments: state.plasmaAttachments.filter((a) => a.id !== attachmentId),
        }));
      },

      listRemnants: () => get().remnants,

      createRemnant: (payload) => {
        const timestamp = now();
        const rem: Remnant = {
          id: generateId(),
          label: payload.label,
          material_type: payload.material_type,
          thickness: payload.thickness,
          width: payload.width ?? null,
          height: payload.height ?? null,
          notes: payload.notes ?? null,
          status: payload.status ?? 'AVAILABLE',
          created_at: timestamp,
          updated_at: timestamp,
        };
        set((state) => ({
          remnants: [...state.remnants, rem],
        }));
        return rem;
      },

      updateRemnant: (id, patch) => {
        set((state) => ({
          remnants: state.remnants.map((r) => (r.id === id ? { ...r, ...patch, updated_at: now() } : r)),
        }));
      },

      removeRemnant: (id) => {
        set((state) => ({
          remnants: state.remnants.filter((r) => r.id !== id),
        }));
      },

      consumeRemnant: (id) => {
        set((state) => ({
          remnants: state.remnants.map((r) => (r.id === id ? { ...r, status: 'CONSUMED', updated_at: now() } : r)),
        }));
      },

      listPlasmaTemplates: () => get().plasmaTemplates,

      getPlasmaTemplate: (templateId) => {
        const template = get().plasmaTemplates.find((t) => t.id === templateId);
        if (!template) return null;
        const lines = get().plasmaTemplateLines.filter((l) => l.plasma_template_id === templateId);
        return { template, lines };
      },

      createPlasmaTemplate: (payload) => {
        const timestamp = now();
        const template: PlasmaTemplate = {
          id: generateId(),
          name: payload.name,
          description: payload.description ?? null,
          default_material_type: payload.default_material_type ?? null,
          default_thickness: payload.default_thickness ?? null,
          created_at: timestamp,
          updated_at: timestamp,
        };
        set((state) => ({
          plasmaTemplates: [...state.plasmaTemplates, template],
        }));
        return template;
      },

      updatePlasmaTemplate: (templateId, patch) => {
        set((state) => ({
          plasmaTemplates: state.plasmaTemplates.map((t) =>
            t.id === templateId ? { ...t, ...patch, updated_at: now() } : t
          ),
        }));
      },

      removePlasmaTemplate: (templateId) => {
        set((state) => ({
          plasmaTemplates: state.plasmaTemplates.filter((t) => t.id !== templateId),
          plasmaTemplateLines: state.plasmaTemplateLines.filter((l) => l.plasma_template_id !== templateId),
        }));
      },

      addPlasmaTemplateLine: (templateId, line) => {
        const timestamp = now();
        const newLine: PlasmaTemplateLine = {
          id: generateId(),
          plasma_template_id: templateId,
          qty_default: line.qty_default,
          cut_length_default: line.cut_length_default ?? null,
          pierce_count_default: line.pierce_count_default ?? null,
          notes: line.notes ?? null,
          created_at: timestamp,
          updated_at: timestamp,
        };
        set((state) => ({
          plasmaTemplateLines: [...state.plasmaTemplateLines, newLine],
        }));
        return newLine;
      },

      updatePlasmaTemplateLine: (lineId, patch) => {
        set((state) => ({
          plasmaTemplateLines: state.plasmaTemplateLines.map((l) =>
            l.id === lineId ? { ...l, ...patch, updated_at: now() } : l
          ),
        }));
      },

      removePlasmaTemplateLine: (lineId) => {
        set((state) => ({
          plasmaTemplateLines: state.plasmaTemplateLines.filter((l) => l.id !== lineId),
        }));
      },

      applyPlasmaTemplateToJob: (templateId, plasmaJobId) => {
        const template = get().plasmaTemplates.find((t) => t.id === templateId);
        if (!template) return { success: false, error: 'Template not found' };
        const lines = get().plasmaTemplateLines.filter((l) => l.plasma_template_id === templateId);
        if (lines.length === 0) return { success: false, error: 'Template has no lines' };
        const timestamp = now();
        set((state) => ({
          plasmaJobLines: [
            ...state.plasmaJobLines,
            ...lines.map<PlasmaJobLine>((l) => ({
              id: generateId(),
              plasma_job_id: plasmaJobId,
              qty: l.qty_default,
              material_type: template.default_material_type ?? null,
              thickness: template.default_thickness ?? null,
              cut_length: l.cut_length_default ?? null,
              pierce_count: l.pierce_count_default ?? null,
              setup_minutes: null,
              machine_minutes: null,
              derived_machine_minutes: null,
              overrides: {},
              material_cost: 0,
              consumables_cost: 0,
              derived_consumables_cost: null,
              labor_cost: 0,
              overhead_cost: 0,
              sell_price_each: 0,
              sell_price_total: 0,
              calc_version: 0,
              override_machine_minutes: false,
              override_consumables_cost: false,
            })),
          ],
          plasmaJobs: state.plasmaJobs.map((j) =>
            j.id === plasmaJobId ? { ...j, updated_at: timestamp } : j
          ),
        }));
        get().recalculatePlasmaJob(plasmaJobId);
        return { success: true };
      },
        // Work Orders
        workOrders: [],
        workOrderPartLines: [],
        workOrderLaborLines: [],
        workOrderJobLines: [],
        workOrderActivity: [],
        workOrderChargeLines: [],
        fabJobs: [],
        fabJobLines: [],
        plasmaJobs: [],
        plasmaJobLines: [],
        plasmaAttachments: [],
        remnants: [],
        plasmaTemplates: [],
        plasmaTemplateLines: [],

        createWorkOrder: (customerId, unitId) => {
        const state = get();
        const customer = state.customers.find((c) => c.id === customerId);
        const taxRate = resolveTaxRateForCustomer(customer, state.settings);
        const newOrder: WorkOrder = {
          id: generateId(),
          order_number: generateOrderNumber('WO', state.workOrders.length),
          customer_id: customerId,
          unit_id: unitId,
          status: 'ESTIMATE',
          notes: null,
          tax_rate: taxRate,
          parts_subtotal: 0,
          labor_subtotal: 0,
          charge_subtotal: 0,
          core_charges_total: 0,
          subtotal: 0,
          tax_amount: 0,
          total: 0,
          labor_cost: 0,
          invoiced_at: null,
          created_at: now(),
          updated_at: now(),
        };
        set((state) => ({
          workOrders: [...state.workOrders, newOrder],
        }));
        return newOrder;
      },

      woAddPartLine: (orderId, partId, qty, jobLineId) => {
        const state = get();
        const order = state.workOrders.find((o) => o.id === orderId);
        const normalizedJobLineId = jobLineId ?? null;
        
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status === 'INVOICED') return { success: false, error: 'Cannot modify invoiced order' };
        
        const part = state.parts.find((p) => p.id === partId);
        if (!part) return { success: false, error: 'Part not found' };
        const componentDeltas = part.is_kit ? getKitComponentDeltas(part.id, qty, state.kitComponents) : null;
        const customer = state.customers.find((c) => c.id === order.customer_id);
        const level = customer?.price_level ?? 'RETAIL';
        const suggested = calcPartPriceForLevel(part, state.settings, level);
        const unitPrice = suggested ?? part.selling_price;

        const existingLine = state.workOrderPartLines.find(
          (l) =>
            l.work_order_id === orderId &&
            l.part_id === partId &&
            l.job_line_id === normalizedJobLineId
        );

        if (existingLine) {
          const newQty = existingLine.quantity + qty;
          const lineTotal = newQty * existingLine.unit_price;
          const timestamp = now();
          set((state) => ({
            workOrderPartLines: state.workOrderPartLines.map((l) =>
              l.id === existingLine.id
                ? { ...l, quantity: newQty, line_total: lineTotal, updated_at: timestamp }
                : l
            ),
            parts: state.parts.map((p) => {
              if (componentDeltas && componentDeltas[p.id]) {
                return { ...p, quantity_on_hand: p.quantity_on_hand - componentDeltas[p.id], updated_at: timestamp };
              }
              if (!part.is_kit && p.id === partId) {
                return { ...p, quantity_on_hand: p.quantity_on_hand - qty, updated_at: timestamp };
              }
              return p;
            }),
          }));
          if (componentDeltas) {
            Object.entries(componentDeltas).forEach(([compId, compQty]) => {
              get().recordInventoryMovement({
                part_id: compId,
                movement_type: 'ISSUE',
                qty_delta: -compQty,
                reason: `WO ${order.order_number || order.id} part issue`,
                ref_type: 'WORK_ORDER',
                ref_id: orderId,
                performed_at: timestamp,
              });
            });
          } else {
            get().recordInventoryMovement({
              part_id: partId,
              movement_type: 'ISSUE',
              qty_delta: -qty,
              reason: `WO ${order.order_number || order.id} part issue`,
              ref_type: 'WORK_ORDER',
              ref_id: orderId,
              performed_at: timestamp,
            });
          }
        } else {
          const timestamp = now();
          const newLine: WorkOrderPartLine = {
            id: generateId(),
            work_order_id: orderId,
            part_id: partId,
            quantity: qty,
            unit_price: unitPrice,
            line_total: qty * unitPrice,
            is_warranty: false,
            core_charge: part.core_required ? part.core_charge : 0,
            core_returned: false,
            core_status: part.core_required && part.core_charge > 0 ? 'CORE_OWED' : 'NOT_APPLICABLE',
            core_returned_at: null,
            core_refunded_at: null,
            is_core_refund_line: false,
            core_refund_for_line_id: null,
            description: null,
            created_at: timestamp,
            updated_at: timestamp,
            job_line_id: normalizedJobLineId,
          };

          set((state) => ({
            workOrderPartLines: [...state.workOrderPartLines, newLine],
            parts: state.parts.map((p) => {
              if (componentDeltas && componentDeltas[p.id]) {
                return { ...p, quantity_on_hand: p.quantity_on_hand - componentDeltas[p.id], updated_at: timestamp };
              }
              if (!part.is_kit && p.id === partId) {
                return { ...p, quantity_on_hand: p.quantity_on_hand - qty, updated_at: timestamp };
              }
              return p;
            }),
          }));
          if (componentDeltas) {
            Object.entries(componentDeltas).forEach(([compId, compQty]) => {
              get().recordInventoryMovement({
                part_id: compId,
                movement_type: 'ISSUE',
                qty_delta: -compQty,
                reason: `WO ${order.order_number || order.id} part issue`,
                ref_type: 'WORK_ORDER',
                ref_id: orderId,
                performed_at: timestamp,
              });
            });
          } else {
            get().recordInventoryMovement({
              part_id: partId,
              movement_type: 'ISSUE',
              qty_delta: -qty,
              reason: `WO ${order.order_number || order.id} part issue`,
              ref_type: 'WORK_ORDER',
              ref_id: orderId,
              performed_at: timestamp,
            });
          }
        }

        get().recalculateWorkOrderTotals(orderId);
        return { success: true };
      },

      woUpdatePartQty: (lineId, newQty) => {
        const state = get();
        const line = state.workOrderPartLines.find((l) => l.id === lineId);
        if (!line) return { success: false, error: 'Line not found' };

        const order = state.workOrders.find((o) => o.id === line.work_order_id);
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status === 'INVOICED') return { success: false, error: 'Cannot modify invoiced order' };

        const qtyChange = newQty - line.quantity;
        const lineTotal = newQty * line.unit_price;
        const part = state.parts.find((p) => p.id === line.part_id);
        const isKit = part?.is_kit;
        const timestamp = now();
        const kitDeltas =
          isKit && line.part_id
            ? getKitComponentDeltas(line.part_id, qtyChange, state.kitComponents)
            : null;

        set((state) => ({
          workOrderPartLines: state.workOrderPartLines.map((l) =>
            l.id === lineId
              ? { ...l, quantity: newQty, line_total: lineTotal, updated_at: timestamp }
              : l
          ),
          parts: state.parts.map((p) => {
            if (kitDeltas && kitDeltas[p.id]) {
              return { ...p, quantity_on_hand: p.quantity_on_hand - kitDeltas[p.id], updated_at: timestamp };
            }
            if (!isKit && p.id === line.part_id) {
              return { ...p, quantity_on_hand: p.quantity_on_hand - qtyChange, updated_at: timestamp };
            }
            return p;
          }),
        }));

        if (kitDeltas) {
          Object.entries(kitDeltas).forEach(([compId, compQty]) => {
            const delta = -compQty;
            get().recordInventoryMovement({
              part_id: compId,
              movement_type: qtyChange > 0 ? 'ISSUE' : 'RETURN',
              qty_delta: delta,
              reason: `WO ${order.order_number || order.id} part ${qtyChange > 0 ? 'issue' : 'return'}`,
              ref_type: 'WORK_ORDER',
              ref_id: order.id,
              performed_at: timestamp,
            });
          });
        } else {
          const delta = -qtyChange;
          if (delta !== 0) {
            get().recordInventoryMovement({
              part_id: line.part_id,
              movement_type: qtyChange > 0 ? 'ISSUE' : 'RETURN',
              qty_delta: delta,
              reason: `WO ${order.order_number || order.id} part ${qtyChange > 0 ? 'issue' : 'return'}`,
              ref_type: 'WORK_ORDER',
              ref_id: order.id,
              performed_at: timestamp,
            });
          }
        }

        get().recalculateWorkOrderTotals(line.work_order_id);
        return { success: true };
      },

      woUpdateLineUnitPrice: (lineId, newUnitPrice) => {
        const state = get();
        const line = state.workOrderPartLines.find((l) => l.id === lineId);
        if (!line) return { success: false, error: 'Line not found' };

        const order = state.workOrders.find((o) => o.id === line.work_order_id);
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status === 'INVOICED') return { success: false, error: 'Cannot modify invoiced order' };

        if (!Number.isFinite(newUnitPrice) || newUnitPrice < 0) {
          return { success: false, error: 'Invalid unit price' };
        }

        const updatedLineTotal = line.quantity * newUnitPrice;

        set((state) => ({
          workOrderPartLines: state.workOrderPartLines.map((l) =>
            l.id === lineId ? { ...l, unit_price: newUnitPrice, line_total: updatedLineTotal, updated_at: now() } : l
          ),
        }));

        get().recalculateWorkOrderTotals(line.work_order_id);
        return { success: true };
      },

      woRemovePartLine: (lineId) => {
        const state = get();
        const line = state.workOrderPartLines.find((l) => l.id === lineId);
        if (!line) return { success: false, error: 'Line not found' };

        const order = state.workOrders.find((o) => o.id === line.work_order_id);
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status === 'INVOICED') return { success: false, error: 'Cannot modify invoiced order' };

        const part = state.parts.find((p) => p.id === line.part_id);
        const isKit = part?.is_kit;
        const restoration = isKit && line.part_id
          ? getKitComponentDeltas(line.part_id, line.quantity, state.kitComponents)
          : null;
        const timestamp = now();

        set((state) => ({
          workOrderPartLines: state.workOrderPartLines.filter((l) => l.id !== lineId),
          parts: state.parts.map((p) => {
            if (restoration && restoration[p.id]) {
              return { ...p, quantity_on_hand: p.quantity_on_hand + restoration[p.id], updated_at: timestamp };
            }
            if (!isKit && p.id === line.part_id) {
              return { ...p, quantity_on_hand: p.quantity_on_hand + line.quantity, updated_at: timestamp };
            }
            return p;
          }),
        }));

        if (restoration) {
          Object.entries(restoration).forEach(([compId, compQty]) => {
            get().recordInventoryMovement({
              part_id: compId,
              movement_type: 'RETURN',
              qty_delta: compQty,
              reason: `WO ${order.order_number || order.id} part return`,
              ref_type: 'WORK_ORDER',
              ref_id: order.id,
              performed_at: timestamp,
            });
          });
        } else {
          get().recordInventoryMovement({
            part_id: line.part_id,
            movement_type: 'RETURN',
            qty_delta: line.quantity,
            reason: `WO ${order.order_number || order.id} part return`,
            ref_type: 'WORK_ORDER',
            ref_id: order.id,
            performed_at: timestamp,
          });
        }

        get().recalculateWorkOrderTotals(line.work_order_id);
        return { success: true };
      },

      woTogglePartWarranty: (lineId) => {
        const state = get();
        const line = state.workOrderPartLines.find((l) => l.id === lineId);
        if (!line) return { success: false, error: 'Line not found' };

        const order = state.workOrders.find((o) => o.id === line.work_order_id);
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status === 'INVOICED') return { success: false, error: 'Cannot modify invoiced order' };

        set((state) => ({
          workOrderPartLines: state.workOrderPartLines.map((l) =>
            l.id === lineId ? { ...l, is_warranty: !l.is_warranty, updated_at: now() } : l
          ),
        }));

        get().recalculateWorkOrderTotals(line.work_order_id);
        return { success: true };
      },

      woToggleCoreReturned: (lineId) => {
        const state = get();
        const line = state.workOrderPartLines.find((l) => l.id === lineId);
        if (!line) return { success: false, error: 'Line not found' };

        const order = state.workOrders.find((o) => o.id === line.work_order_id);
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status === 'INVOICED') return { success: false, error: 'Cannot modify invoiced order' };

        set((state) => ({
          workOrderPartLines: state.workOrderPartLines.map((l) =>
            l.id === lineId ? { ...l, core_returned: !l.core_returned, updated_at: now() } : l
          ),
        }));

        get().recalculateWorkOrderTotals(line.work_order_id);
        return { success: true };
      },

      woMarkCoreReturned: (lineId) => {
        const state = get();
        const line = state.workOrderPartLines.find((l) => l.id === lineId);
        if (!line) return { success: false, error: 'Line not found' };
        if (line.core_status !== 'CORE_OWED') return { success: false, error: 'Core has already been processed' };
        if (line.is_core_refund_line) return { success: false, error: 'Cannot mark refund line as returned' };

        const order = state.workOrders.find((o) => o.id === line.work_order_id);
        if (!order) return { success: false, error: 'Order not found' };

        const part = state.parts.find((p) => p.id === line.part_id);
        const partDesc = part?.description || part?.part_number || 'Part';
        const timestamp = now();

        // Create refund line
        const refundLine: WorkOrderPartLine = {
          id: generateId(),
          work_order_id: line.work_order_id,
          part_id: line.part_id,
          quantity: line.quantity,
          unit_price: -line.core_charge,
          line_total: -(line.core_charge * line.quantity),
          is_warranty: false,
          core_charge: 0,
          core_returned: true,
          core_status: 'NOT_APPLICABLE',
          core_returned_at: null,
          core_refunded_at: null,
          is_core_refund_line: true,
          core_refund_for_line_id: lineId,
          description: `Core Refund (${partDesc})`,
          created_at: timestamp,
          updated_at: timestamp,
        };

        // Update original line status and add refund line
        set((state) => ({
          workOrderPartLines: [
            ...state.workOrderPartLines.map((l) =>
              l.id === lineId
                ? {
                    ...l,
                    core_returned: true,
                    core_status: 'CORE_CREDITED' as const,
                    core_returned_at: timestamp,
                    core_refunded_at: timestamp,
                    updated_at: timestamp,
                  }
                : l
            ),
            refundLine,
          ],
        }));

        get().recalculateWorkOrderTotals(line.work_order_id);
        return { success: true };
      },

      woAddLaborLine: (orderId, description, hours, technicianId, jobLineId) => {
        const state = get();
        const order = state.workOrders.find((o) => o.id === orderId);
        const normalizedJobLineId = jobLineId ?? null;
        
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status === 'INVOICED') return { success: false, error: 'Cannot modify invoiced order' };

        const rate = state.settings.default_labor_rate;
        const newLine: WorkOrderLaborLine = {
          id: generateId(),
          work_order_id: orderId,
          description,
          hours,
          rate,
          line_total: hours * rate,
          is_warranty: false,
          technician_id: technicianId || null,
          job_line_id: normalizedJobLineId,
          created_at: now(),
          updated_at: now(),
        };

        set((state) => ({
          workOrderLaborLines: [...state.workOrderLaborLines, newLine],
        }));

        get().recalculateWorkOrderTotals(orderId);
        return { success: true };
      },

      woUpdateLaborLine: (lineId, description, hours) => {
        const state = get();
        const line = state.workOrderLaborLines.find((l) => l.id === lineId);
        if (!line) return { success: false, error: 'Line not found' };

        const order = state.workOrders.find((o) => o.id === line.work_order_id);
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status === 'INVOICED') return { success: false, error: 'Cannot modify invoiced order' };

        set((state) => ({
          workOrderLaborLines: state.workOrderLaborLines.map((l) =>
            l.id === lineId
              ? { ...l, description, hours, line_total: hours * l.rate, updated_at: now() }
              : l
          ),
        }));

        get().recalculateWorkOrderTotals(line.work_order_id);
        return { success: true };
      },

      woRemoveLaborLine: (lineId) => {
        const state = get();
        const line = state.workOrderLaborLines.find((l) => l.id === lineId);
        if (!line) return { success: false, error: 'Line not found' };

        const order = state.workOrders.find((o) => o.id === line.work_order_id);
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status === 'INVOICED') return { success: false, error: 'Cannot modify invoiced order' };

        set((state) => ({
          workOrderLaborLines: state.workOrderLaborLines.filter((l) => l.id !== lineId),
        }));

        get().recalculateWorkOrderTotals(line.work_order_id);
        return { success: true };
      },

      getWorkOrderJobLines: (workOrderId) =>
        get().workOrderJobLines.filter((job) => job.work_order_id === workOrderId && job.is_active),
      getWorkOrderActivity: (workOrderId) =>
        get()
          .workOrderActivity.filter((event) => event.work_order_id === workOrderId)
          .sort((a, b) => b.created_at.localeCompare(a.created_at)),
      getWorkOrderTimeEntries: (workOrderId) =>
        get().workOrderTimeEntries.filter((entry) => entry.work_order_id === workOrderId),
      getJobTimeEntries: (jobLineId) => get().workOrderTimeEntries.filter((entry) => entry.job_line_id === jobLineId),
      getActiveJobTimers: (workOrderId) =>
        get().workOrderTimeEntries.filter((entry) => entry.work_order_id === workOrderId && entry.ended_at == null),
      getJobActualHours: (jobLineId) =>
        get()
          .workOrderTimeEntries.filter((entry) => entry.job_line_id === jobLineId)
          .reduce((sum, entry) => sum + calculateEntrySeconds(entry) / 3600, 0),
      getWorkOrderActualHours: (workOrderId) =>
        get()
          .workOrderTimeEntries.filter((entry) => entry.work_order_id === workOrderId)
          .reduce((sum, entry) => sum + calculateEntrySeconds(entry) / 3600, 0),
      getJobPartReadiness: (jobLineId) => {
        const state = get();
        const jobPartLines = state.workOrderPartLines.filter(
          (line) => line.job_line_id === jobLineId && !line.is_core_refund_line
        );
        let missing = 0;
        let risk = 0;
        jobPartLines.forEach((line) => {
          const part = state.parts.find((p) => p.id === line.part_id);
          const qoh = part?.quantity_on_hand ?? 0;
          if (qoh < line.quantity) {
            missing += 1;
          }
          if (qoh < 0 || qoh - line.quantity < 0) {
            risk += 1;
          }
        });
        const readiness: WorkOrderJobPartsReadiness =
          missing > 0 ? 'MISSING' : risk > 0 ? 'RISK' : 'OK';
        return {
          job_line_id: jobLineId,
          partsRequiredCount: jobPartLines.length,
          partsMissingCount: missing,
          partsRiskCount: risk,
          readiness,
        };
      },
      woClockIn: (workOrderId, jobLineId, technicianId, technicianName) => {
        const state = get();
        const workOrder = state.workOrders.find((wo) => wo.id === workOrderId);
        if (!workOrder) return { success: false, error: 'Work order not found' };
        if (workOrder.status === 'INVOICED') return { success: false, error: 'Cannot track time on invoiced order' };

        if (!jobLineId) return { success: false, error: 'Job is required' };
        const job = state.workOrderJobLines.find((j) => j.id === jobLineId);

        const technician = technicianId ? state.technicians.find((t) => t.id === technicianId) : undefined;
        const techName = technicianName ?? technician?.name ?? null;
        const techKey = deriveTechnicianKey(technicianId ?? null, techName ?? null);
        const closeMatchingEntry = (entry: WorkOrderTimeEntry) => {
          const finished = finishTimeEntry(entry);
          const finishedJob = state.workOrderJobLines.find((j) => j.id === finished.job_line_id);
          logWorkOrderActivity({
            work_order_id: finished.work_order_id,
            job_line_id: finished.job_line_id,
            type: 'CLOCK_OUT',
            message: `Clock out: ${finished.technician_name || 'Technician'} → ${
              finishedJob?.title ?? 'Job'
            }`,
          });
        };

        if (techKey) {
          state.workOrderTimeEntries
            .filter(
              (entry) =>
                entry.ended_at == null &&
                deriveTechnicianKey(entry.technician_id ?? null, entry.technician_name ?? null) === techKey
            )
            .forEach(closeMatchingEntry);
        }

        const timestamp = now();
        const newEntry: WorkOrderTimeEntry = {
          id: generateId(),
          work_order_id: workOrderId,
          job_line_id: jobLineId,
          technician_id: technicianId ?? null,
          technician_name: techName,
          started_at: timestamp,
          ended_at: null,
          seconds: 0,
          notes: null,
          created_at: timestamp,
          updated_at: timestamp,
        };

        set((state) => ({
          workOrderTimeEntries: [...state.workOrderTimeEntries, newEntry],
        }));

        logWorkOrderActivity({
          work_order_id: workOrderId,
          job_line_id: jobLineId,
          type: 'CLOCK_IN',
          message: `Clock in: ${techName ?? 'Technician'} → ${job?.title ?? 'Job'}`,
        });

        return { success: true, entry: newEntry };
      },
      woClockOut: (timeEntryId) => {
        const state = get();
        const entry = state.workOrderTimeEntries.find((te) => te.id === timeEntryId);
        if (!entry) return { success: false, error: 'Time entry not found' };
        if (entry.ended_at) return { success: false, error: 'Time entry already ended' };

        const updatedEntry = finishTimeEntry(entry);
        const job = state.workOrderJobLines.find((j) => j.id === entry.job_line_id);
        logWorkOrderActivity({
          work_order_id: updatedEntry.work_order_id,
          job_line_id: updatedEntry.job_line_id,
          type: 'CLOCK_OUT',
          message: `Clock out: ${updatedEntry.technician_name || 'Technician'} → ${job?.title ?? 'Job'}`,
        });
        return { success: true, entry: updatedEntry };
      },
      woClockOutActiveForJob: (workOrderId, jobLineId, technicianId) => {
        const state = get();
        const entry = state.workOrderTimeEntries.find(
          (te) =>
            te.work_order_id === workOrderId &&
            te.job_line_id === jobLineId &&
            te.ended_at == null &&
            (technicianId ? te.technician_id === technicianId : true)
        );
        if (!entry) return { success: false, error: 'No active timer found' };
        return get().woClockOut(entry.id);
      },
      woEnsureDefaultJobLine: (workOrderId) => {
        const state = get();
        const existing = state.workOrderJobLines.find((jobLine) => jobLine.work_order_id === workOrderId && jobLine.is_active);
        const job = existing ?? get().woCreateJobLine(workOrderId, 'General');
        const jobId = job.id;
        set((state) => ({
          workOrderLaborLines: state.workOrderLaborLines.map((line) =>
            line.work_order_id === workOrderId && line.job_line_id == null
              ? { ...line, job_line_id: jobId }
              : line
          ),
          workOrderPartLines: state.workOrderPartLines.map((line) =>
            line.work_order_id === workOrderId && line.job_line_id == null
              ? { ...line, job_line_id: jobId }
              : line
          ),
        }));
        return job;
      },
      woCreateJobLine: (workOrderId, title) => {
        const timestamp = now();
        const jobLine: WorkOrderJobLine = {
          id: generateId(),
          work_order_id: workOrderId,
          title: title.trim() || 'General',
          complaint: null,
          cause: null,
          correction: null,
          status: 'INTAKE',
          is_active: true,
          created_at: timestamp,
          updated_at: timestamp,
        };
        set((state) => ({
          workOrderJobLines: [...state.workOrderJobLines, jobLine],
        }));
        logWorkOrderActivity({
          work_order_id: workOrderId,
          job_line_id: jobLine.id,
          type: 'JOB_CREATED',
          message: `Created job: ${jobLine.title}`,
        });
        return jobLine;
      },
      woUpdateJobLine: (jobLineId, patch) => {
        const state = get();
        const job = state.workOrderJobLines.find((j) => j.id === jobLineId);
        if (!job) return null;
        const updated: WorkOrderJobLine = {
          ...job,
          ...patch,
          title: patch.title !== undefined ? patch.title.trim() || job.title : job.title,
          complaint: patch.complaint !== undefined ? patch.complaint : job.complaint,
          cause: patch.cause !== undefined ? patch.cause : job.cause,
          correction: patch.correction !== undefined ? patch.correction : job.correction,
          status: patch.status ?? job.status,
          is_active: patch.is_active ?? job.is_active,
          updated_at: now(),
        };
        set((state) => ({
          workOrderJobLines: state.workOrderJobLines.map((j) => (j.id === jobLineId ? updated : j)),
        }));
        const eventType: WorkOrderActivityEvent['type'] =
          patch.status && patch.status !== job.status ? 'JOB_STATUS_CHANGED' : 'JOB_UPDATED';
        logWorkOrderActivity({
          work_order_id: job.work_order_id,
          job_line_id: jobLineId,
          type: eventType,
          message:
            eventType === 'JOB_STATUS_CHANGED'
              ? `Job ${updated.title} status changed to ${updated.status}`
              : `Updated job: ${updated.title}`,
        });
        return updated;
      },
      woSetJobStatus: (jobLineId, status) => get().woUpdateJobLine(jobLineId, { status }),

      woDeleteJobLine: (jobLineId) => {
        const state = get();
        const job = state.workOrderJobLines.find((j) => j.id === jobLineId);
        if (!job) return { success: false, error: 'Job not found' };
        
        const order = state.workOrders.find((o) => o.id === job.work_order_id);
        if (!order) return { success: false, error: 'Work order not found' };
        if (order.status === 'INVOICED') return { success: false, error: 'Cannot delete job on invoiced order' };
        
        // Check for time entries on this job
        const hasTimeEntries = state.workOrderTimeEntries.some((e) => e.job_line_id === jobLineId);
        if (hasTimeEntries) return { success: false, error: 'Cannot delete job with time entries' };
        
        // Check for part lines on this job
        const hasPartLines = state.workOrderPartLines.some((l) => l.job_line_id === jobLineId);
        if (hasPartLines) return { success: false, error: 'Cannot delete job with part lines' };
        
        // Check for labor lines on this job
        const hasLaborLines = state.workOrderLaborLines.some((l) => l.job_line_id === jobLineId);
        if (hasLaborLines) return { success: false, error: 'Cannot delete job with labor lines' };
        
        set((state) => ({
          workOrderJobLines: state.workOrderJobLines.filter((j) => j.id !== jobLineId),
        }));
        
        logWorkOrderActivity({
          work_order_id: job.work_order_id,
          job_line_id: null,
          type: 'JOB_UPDATED',
          message: `Deleted job: ${job.title}`,
        });
        
        return { success: true };
      },

      woToggleLaborWarranty: (lineId) => {
        const state = get();
        const line = state.workOrderLaborLines.find((l) => l.id === lineId);
        if (!line) return { success: false, error: 'Line not found' };

        const order = state.workOrders.find((o) => o.id === line.work_order_id);
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status === 'INVOICED') return { success: false, error: 'Cannot modify invoiced order' };

        set((state) => ({
          workOrderLaborLines: state.workOrderLaborLines.map((l) =>
            l.id === lineId ? { ...l, is_warranty: !l.is_warranty, updated_at: now() } : l
          ),
        }));

        get().recalculateWorkOrderTotals(line.work_order_id);
        return { success: true };
      },

      woUpdateStatus: (orderId, status) => {
        const state = get();
        const order = state.workOrders.find((o) => o.id === orderId);
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status === 'INVOICED') return { success: false, error: 'Cannot modify invoiced order' };
        if (order.status === 'ESTIMATE') return { success: false, error: 'Estimate must be converted before starting work' };
        if (order.status === 'IN_PROGRESS' && status === 'IN_PROGRESS') {
          return { success: false, error: 'Order already in progress' };
        }

        set((state) => ({
          workOrders: state.workOrders.map((o) =>
            o.id === orderId ? { ...o, status, updated_at: now() } : o
          ),
        }));
        return { success: true };
      },

      woInvoice: (orderId) => {
        const state = get();
        const order = state.workOrders.find((o) => o.id === orderId);
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status === 'INVOICED') return { success: false, error: 'Order already invoiced' };
        if (order.status === 'ESTIMATE') return { success: false, error: 'Order must be open before invoicing' };

        // Clock out all active technicians on this order
        const activeEntries = state.timeEntries.filter(
          (te) => te.work_order_id === orderId && !te.clock_out
        );
        
        for (const entry of activeEntries) {
          get().clockOut(entry.technician_id);
        }

        set((state) => ({
          workOrders: state.workOrders.map((o) =>
            o.id === orderId
              ? { ...o, status: 'INVOICED', invoiced_at: now(), updated_at: now() }
              : o
          ),
        }));
        createPOsForNegativeInventory(
          undefined,
          order.order_number ? `WO ${order.order_number}` : `WO ${order.id}`
        );
        return { success: true };
      },

      getWorkOrderPartLines: (orderId) =>
        get().workOrderPartLines.filter((l) => l.work_order_id === orderId),

      getWorkOrderLaborLines: (orderId) =>
        get().workOrderLaborLines.filter((l) => l.work_order_id === orderId),

      getWorkOrderChargeLines: (orderId) =>
        get().workOrderChargeLines.filter((l) => l.work_order_id === orderId),

      addWorkOrderChargeLine: (line) => {
        if (line.qty <= 0) return null;
        const timestamp = now();
        const chargeLine: WorkOrderChargeLine = {
          ...line,
          id: line.id ?? generateId(),
          total_price: line.qty * line.unit_price,
          created_at: timestamp,
          updated_at: timestamp,
        };
        set((state) => ({
          workOrderChargeLines: [
            ...state.workOrderChargeLines.filter((l) => l.id !== chargeLine.id),
            chargeLine,
          ],
        }));
        get().recalculateWorkOrderTotals(chargeLine.work_order_id);
        return chargeLine;
      },

      updateWorkOrderChargeLine: (id, patch) => {
        const state = get();
        const existing = state.workOrderChargeLines.find((l) => l.id === id);
        if (!existing) return;
        const qty = patch.qty ?? existing.qty;
        const unit_price = patch.unit_price ?? existing.unit_price;
        const updated: WorkOrderChargeLine = {
          ...existing,
          ...patch,
          qty,
          unit_price,
          total_price: qty * unit_price,
          updated_at: now(),
        };
        set((state) => ({
          workOrderChargeLines: state.workOrderChargeLines.map((l) =>
            l.id === id ? updated : l
          ),
        }));
        get().recalculateWorkOrderTotals(updated.work_order_id);
      },

      removeWorkOrderChargeLine: (id) => {
        const state = get();
        const line = state.workOrderChargeLines.find((l) => l.id === id);
        if (!line) return;
        set((state) => ({
          workOrderChargeLines: state.workOrderChargeLines.filter((l) => l.id !== id),
        }));
        get().recalculateWorkOrderTotals(line.work_order_id);
      },

      updateWorkOrderTechnician: (orderId, technicianId) =>
        set((state) => ({
          workOrders: state.workOrders.map((o) =>
            o.id === orderId ? { ...o, technician_id: technicianId, updated_at: now() } : o
          ),
        })),

      updateWorkOrderPromisedAt: (orderId, promisedAt) =>
        set((state) => ({
          workOrders: state.workOrders.map((o) =>
            o.id === orderId ? { ...o, promised_at: promisedAt, updated_at: now() } : o
          ),
        })),

      updateWorkOrderNotes: (orderId, notes) =>
        set((state) => ({
          workOrders: state.workOrders.map((o) =>
            o.id === orderId ? { ...o, notes, updated_at: now() } : o
          ),
        })),

      woConvertToOpen: (orderId) => {
        const state = get();
        const order = state.workOrders.find((o) => o.id === orderId);
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status === 'INVOICED') return { success: false, error: 'Cannot convert invoiced order' };
        if (order.status === 'OPEN' || order.status === 'IN_PROGRESS') return { success: true };
        set((state) => ({
          workOrders: state.workOrders.map((o) =>
            o.id === orderId ? { ...o, status: 'OPEN', updated_at: now() } : o
          ),
        }));
        return { success: true };
      },

      recalculateWorkOrderTotals: (orderId: string) => {
        const state = get();
        const partLines = state.workOrderPartLines.filter((l) => l.work_order_id === orderId);
        const laborLines = state.workOrderLaborLines.filter((l) => l.work_order_id === orderId);
        const timeEntries = state.timeEntries.filter((te) => te.work_order_id === orderId);
        const chargeLines = state.workOrderChargeLines.filter((l) => l.work_order_id === orderId);
        
        // Parts: warranty items are $0 to customer, include refund lines (they have negative line_total)
        const parts_subtotal = partLines.reduce((sum, l) => {
          if (l.is_warranty) return sum;
          return sum + l.line_total;
        }, 0);
        
        // Core charges (only for non-returned cores, exclude refund lines)
        const core_charges_total = partLines.reduce((sum, l) => {
          if (l.is_core_refund_line) return sum;
          if (l.core_charge > 0 && !l.core_returned) {
            return sum + (l.core_charge * l.quantity);
          }
          return sum;
        }, 0);
        
        // Labor: warranty items are $0 to customer
        const labor_subtotal = laborLines.reduce((sum, l) => sum + (l.is_warranty ? 0 : l.line_total), 0);

        const charge_subtotal = chargeLines.reduce((sum, l) => sum + l.total_price, 0);
        
        // Calculate labor cost (internal) from time entries
        let labor_cost = 0;
        for (const entry of timeEntries) {
          const technician = state.technicians.find((t) => t.id === entry.technician_id);
          if (technician) {
            const hours = entry.total_minutes / 60;
            labor_cost += hours * technician.hourly_cost_rate;
          }
        }
        
        const subtotal = parts_subtotal + labor_subtotal + charge_subtotal + core_charges_total;
        
        const order = state.workOrders.find((o) => o.id === orderId);
        if (!order) return;
        const customer = state.customers.find((c) => c.id === order.customer_id);
        const tax_rate = resolveTaxRateForCustomer(customer, state.settings);
        
        const tax_amount = subtotal * (order.tax_rate / 100);
        const total = subtotal + tax_amount;

        set((state) => ({
          workOrders: state.workOrders.map((o) =>
            o.id === orderId
              ? { ...o, parts_subtotal, labor_subtotal, charge_subtotal, core_charges_total, subtotal, tax_rate, tax_amount, total, labor_cost, updated_at: now() }
              : o
          ),
        }));
      },

      createFabJobForWorkOrder: (workOrderId) => {
        const state = get();
        const existing = state.fabJobs.find((j) => j.work_order_id === workOrderId);
        if (existing) return existing;
        const timestamp = now();
        const job: FabJob = {
          id: generateId(),
          source_type: 'WORK_ORDER',
          work_order_id: workOrderId,
          sales_order_id: null,
          status: 'DRAFT',
          notes: null,
          posted_at: null,
          posted_by: null,
          calculated_at: null,
          calc_version: 0,
          created_at: timestamp,
          updated_at: timestamp,
          warnings: [],
        };
        set((state) => ({
          fabJobs: [...state.fabJobs, job],
        }));
        return job;
      },

      getFabJobByWorkOrder: (workOrderId) => {
        const job = get().fabJobs.find((j) => j.work_order_id === workOrderId);
        if (!job) return null;
        const lines = get().fabJobLines.filter((l) => l.fab_job_id === job.id);
        return { job, lines };
      },

      updateFabJob: (id, patch) => {
        const state = get();
        const existing = state.fabJobs.find((j) => j.id === id);
        if (!existing) return null;
        if (existing.status !== 'DRAFT' && existing.status !== 'QUOTED' && existing.status !== 'APPROVED') {
          return null;
        }
        const updated: FabJob = { ...existing, ...patch, updated_at: now() };
        set((state) => ({
          fabJobs: state.fabJobs.map((j) => (j.id === id ? updated : j)),
        }));
        return updated;
      },

      upsertFabJobLine: (jobId, line) => {
        const state = get();
        const job = state.fabJobs.find((j) => j.id === jobId);
        if (!job) return null;
        if (job.status !== 'DRAFT' && job.status !== 'QUOTED' && job.status !== 'APPROVED') return null;
        if (job.work_order_id) {
          const wo = state.workOrders.find((o) => o.id === job.work_order_id);
          if (wo?.status === 'INVOICED') return null;
        }
        if (job.sales_order_id) {
          const so = state.salesOrders.find((o) => o.id === job.sales_order_id);
          if (so?.status === 'INVOICED') return null;
        }
        const existing = line.id ? state.fabJobLines.find((l) => l.id === line.id) : undefined;
        const baseLine: FabJobLine = existing
          ? { ...existing, ...line, fab_job_id: jobId }
          : {
              id: line.id ?? generateId(),
              fab_job_id: jobId,
              operation_type: line.operation_type ?? 'PRESS_BRAKE',
              qty: line.qty ?? 1,
              description: line.description ?? null,
              notes: line.notes ?? null,
              material_type: line.material_type ?? null,
              thickness: line.thickness ?? null,
              bends_count: line.bends_count ?? null,
              bend_length: line.bend_length ?? null,
              setup_minutes: line.setup_minutes ?? null,
              machine_minutes: line.machine_minutes ?? null,
              derived_machine_minutes: null,
              tooling: line.tooling ?? null,
              tonnage_estimate: line.tonnage_estimate ?? null,
              weld_process: line.weld_process ?? null,
              weld_length: line.weld_length ?? null,
              weld_type: line.weld_type ?? null,
              position: line.position ?? null,
              override_machine_minutes: line.override_machine_minutes ?? false,
              override_consumables_cost: line.override_consumables_cost ?? false,
              override_labor_cost: line.override_labor_cost ?? false,
              consumables_cost: line.consumables_cost ?? 0,
              labor_cost: line.labor_cost ?? 0,
              overhead_cost: line.overhead_cost ?? 0,
              sell_price_each: line.sell_price_each ?? 0,
              sell_price_total: line.sell_price_total ?? 0,
              calc_version: 0,
            };
        set((state) => ({
          fabJobLines: existing
            ? state.fabJobLines.map((l) => (l.id === baseLine.id ? baseLine : l))
            : [...state.fabJobLines, baseLine],
        }));
        get().recalculateFabJob(jobId);
        return get().fabJobLines.find((l) => l.id === baseLine.id) ?? null;
      },

      deleteFabJobLine: (lineId) => {
        const state = get();
        const line = state.fabJobLines.find((l) => l.id === lineId);
        if (!line) return;
        const job = state.fabJobs.find((j) => j.id === line.fab_job_id);
        if (!job) return;
        if (job.status !== 'DRAFT' && job.status !== 'QUOTED' && job.status !== 'APPROVED') return;
        if (job.work_order_id) {
          const wo = state.workOrders.find((o) => o.id === job.work_order_id);
          if (wo?.status === 'INVOICED') return;
        }
        set((state) => ({
          fabJobLines: state.fabJobLines.filter((l) => l.id !== lineId),
        }));
        get().recalculateFabJob(line.fab_job_id);
      },

      recalculateFabJob: (jobId, settingsOverride) => {
        const state = get();
        const job = state.fabJobs.find((j) => j.id === jobId);
        if (!job) return { success: false, error: 'Fabrication job not found' };
        if (job.work_order_id) {
          const wo = state.workOrders.find((o) => o.id === job.work_order_id);
          if (wo?.status === 'INVOICED') return { success: false, error: 'Work order is invoiced' };
        }
        const lines = state.fabJobLines.filter((l) => l.fab_job_id === jobId);
        const mergedSettings: Partial<FabricationPricingSettings> = { ...fabricationPricingDefaults, ...settingsOverride };
        const { lines: pricedLines, warnings } = calculateFabJob(job, lines, mergedSettings);
        const calcVersion = mergedSettings.calcVersion ?? fabricationPricingDefaults.calcVersion;
        set((state) => ({
          fabJobs: state.fabJobs.map((j) =>
            j.id === jobId
              ? {
                  ...j,
                  calculated_at: now(),
                  calc_version: calcVersion,
                  warnings,
                  updated_at: now(),
                }
              : j
          ),
          fabJobLines: state.fabJobLines.map((line) => {
            const updated = pricedLines.find((l) => l.id === line.id);
            return updated && line.fab_job_id === jobId ? updated : line;
          }),
        }));
        return { success: true, warnings };
      },

      postFabJobToWorkOrder: (fabJobId) => {
        const state = get();
        const job = state.fabJobs.find((j) => j.id === fabJobId);
        if (!job) return { success: false, error: 'Fabrication job not found' };
        if (!job.work_order_id) return { success: false, error: 'Fabrication job is not linked to a work order' };
        const order = state.workOrders.find((o) => o.id === job.work_order_id);
        if (order?.status === 'INVOICED') return { success: false, error: 'Work order is invoiced' };
        if (job.status === 'VOID') return { success: false, error: 'Fabrication job is voided' };

        const calculation = job.calculated_at ? { success: true } : get().recalculateFabJob(fabJobId);
        if (!calculation?.success) return calculation;
        const updatedLines = get().fabJobLines.filter((l) => l.fab_job_id === fabJobId);
        const totalPrice = updatedLines.reduce((sum, line) => sum + (line.sell_price_total ?? 0), 0);
        const description = `Fabrication Job ${job.id}`;
        upsertFabChargeLine({
          orderId: job.work_order_id,
          fabJobId,
          description,
          totalPrice,
        });
        set((state) => ({
          fabJobs: state.fabJobs.map((j) =>
            j.id === fabJobId
              ? {
                  ...j,
                  status: 'APPROVED',
                  posted_at: now(),
                  posted_by: 'system',
                  updated_at: now(),
                  calculated_at: j.calculated_at ?? now(),
                  calc_version: j.calc_version ?? fabricationPricingDefaults.calcVersion,
                }
              : j
          ),
        }));
        return { success: true };
      },

      createPlasmaJobForWorkOrder: (workOrderId) => {
        const state = get();
        const existing = state.plasmaJobs.find((j) => j.work_order_id === workOrderId);
        if (existing) return existing;
        const timestamp = now();
        const job: PlasmaJob = {
          id: generateId(),
          source_type: 'WORK_ORDER',
          work_order_id: workOrderId,
          sales_order_id: null,
          status: 'DRAFT',
          calculated_at: null,
          posted_at: null,
          notes: null,
          created_at: timestamp,
          updated_at: timestamp,
        };
        set((state) => ({
          plasmaJobs: [...state.plasmaJobs, job],
        }));
        return job;
      },

      getPlasmaJobByWorkOrder: (workOrderId) => {
        const job = get().plasmaJobs.find((j) => j.work_order_id === workOrderId);
        if (!job) return null;
        const lines = get().plasmaJobLines.filter((l) => l.plasma_job_id === job.id);
        return { job, lines };
      },

      createStandalonePlasmaJob: (payload) => {
        const timestamp = now();
        const job: PlasmaJob = {
          id: generateId(),
          source_type: 'STANDALONE',
          work_order_id: null,
          sales_order_id: payload?.sales_order_id ?? null,
          status: 'DRAFT',
          calculated_at: null,
          posted_at: null,
          notes: null,
          created_at: timestamp,
          updated_at: timestamp,
        };
        set((state) => ({
          plasmaJobs: [...state.plasmaJobs, job],
        }));
        return job;
      },

      getPlasmaJob: (plasmaJobId) => {
        const job = get().plasmaJobs.find((j) => j.id === plasmaJobId);
        if (!job) return null;
        const lines = get().plasmaJobLines.filter((l) => l.plasma_job_id === job.id);
        return { job, lines };
      },

      getPlasmaPrintView: (plasmaJobId) => {
        const job = get().plasmaJobs.find((j) => j.id === plasmaJobId);
        if (!job) return null;
        const lines = get().plasmaJobLines.filter((l) => l.plasma_job_id === plasmaJobId);
        const workOrder = job.work_order_id ? get().workOrders.find((wo) => wo.id === job.work_order_id) : null;
        const salesOrder = job.sales_order_id ? get().salesOrders.find((so) => so.id === job.sales_order_id) : null;
        const customerId = workOrder?.customer_id ?? salesOrder?.customer_id;
        const customerName = customerId ? get().customers.find((c) => c.id === customerId)?.company_name ?? null : null;
        const metrics = computePlasmaJobMetrics(lines);
        const attachments = get().plasmaAttachments.filter((att) => att.plasma_job_id === plasmaJobId);
        return { job, lines, workOrder, salesOrder, customerName, metrics, attachments };
      },

      listStandalonePlasmaJobs: () => get().plasmaJobs.filter((j) => j.source_type === 'STANDALONE'),

      linkPlasmaJobToSalesOrder: (plasmaJobId, salesOrderId) => {
        const state = get();
        const job = state.plasmaJobs.find((j) => j.id === plasmaJobId);
        if (!job) return null;
        const orderExists = state.salesOrders.some((o) => o.id === salesOrderId);
        if (!orderExists) return null;
        const updated: PlasmaJob = {
          ...job,
          source_type: job.source_type === 'WORK_ORDER' ? job.source_type : 'STANDALONE',
          sales_order_id: salesOrderId,
          updated_at: now(),
        };
        set((state) => ({
          plasmaJobs: state.plasmaJobs.map((j) => (j.id === plasmaJobId ? updated : j)),
        }));
        return updated;
      },

      updatePlasmaJob: (id, patch) => {
        const state = get();
        const existing = state.plasmaJobs.find((j) => j.id === id);
        if (!existing) return null;
        if (existing.status !== 'DRAFT' && existing.status !== 'QUOTED') {
          return null;
        }
        const updated: PlasmaJob = { ...existing, ...patch, updated_at: now() };
        set((state) => ({
          plasmaJobs: state.plasmaJobs.map((j) => (j.id === id ? updated : j)),
        }));
        return updated;
      },

      upsertPlasmaJobLine: (jobId, line) => {
        const state = get();
        const job = state.plasmaJobs.find((j) => j.id === jobId);
        if (!job) return null;
        if (job.status !== 'DRAFT' && job.status !== 'QUOTED') return null;
        if (job.work_order_id) {
          const wo = state.workOrders.find((o) => o.id === job.work_order_id);
          if (wo?.status === 'INVOICED') return null;
        }
        if (job.sales_order_id) {
          const so = state.salesOrders.find((o) => o.id === job.sales_order_id);
          if (so?.status === 'INVOICED') return null;
        }
        const existing = line.id ? state.plasmaJobLines.find((l) => l.id === line.id) : undefined;
        const baseLine: PlasmaJobLine = existing
          ? { ...existing, ...line, plasma_job_id: jobId }
          : {
              id: line.id ?? generateId(),
              plasma_job_id: jobId,
              qty: line.qty ?? 1,
              material_type: line.material_type ?? null,
              thickness: line.thickness ?? null,
              cut_length: line.cut_length ?? null,
              pierce_count: line.pierce_count ?? null,
              setup_minutes: line.setup_minutes ?? null,
              machine_minutes: line.machine_minutes ?? null,
              overrides: line.overrides,
              material_cost: 0,
              consumables_cost: 0,
              labor_cost: 0,
              overhead_cost: 0,
              sell_price_each: 0,
              sell_price_total: 0,
              calc_version: 0,
            };
        set((state) => ({
          plasmaJobLines: existing
            ? state.plasmaJobLines.map((l) => (l.id === baseLine.id ? baseLine : l))
            : [...state.plasmaJobLines, baseLine],
        }));
        get().recalculatePlasmaJob(jobId);
        return get().plasmaJobLines.find((l) => l.id === baseLine.id) ?? null;
      },

      deletePlasmaJobLine: (lineId) => {
        const state = get();
        const line = state.plasmaJobLines.find((l) => l.id === lineId);
        if (!line) return;
        const job = state.plasmaJobs.find((j) => j.id === line.plasma_job_id);
        if (!job) return;
        if (job.status !== 'DRAFT' && job.status !== 'QUOTED') return;
        if (job.work_order_id) {
          const wo = state.workOrders.find((o) => o.id === job.work_order_id);
          if (wo?.status === 'INVOICED') return;
        }
        if (job.sales_order_id) {
          const so = state.salesOrders.find((o) => o.id === job.sales_order_id);
          if (so?.status === 'INVOICED') return;
        }
        set((state) => ({
          plasmaJobLines: state.plasmaJobLines.filter((l) => l.id !== lineId),
        }));
        get().recalculatePlasmaJob(line.plasma_job_id);
      },

      recalculatePlasmaJob: (jobId, settingsOverride) => {
        const state = get();
        const job = state.plasmaJobs.find((j) => j.id === jobId);
        if (!job) return { success: false, error: 'Plasma job not found' };
        if (job.work_order_id) {
          const wo = state.workOrders.find((o) => o.id === job.work_order_id);
          if (wo?.status === 'INVOICED') return { success: false, error: 'Work order is invoiced' };
        }
        if (job.sales_order_id) {
          const so = state.salesOrders.find((o) => o.id === job.sales_order_id);
          if (so?.status === 'INVOICED') return { success: false, error: 'Sales order is invoiced' };
        }
        const lines = state.plasmaJobLines.filter((l) => l.plasma_job_id === jobId);
        const { lines: pricedLines, totals, warnings } = calculatePlasmaJob(job, lines, {
          ...plasmaPricingDefaults,
          ...settingsOverride,
        });
        set((state) => ({
          plasmaJobs: state.plasmaJobs.map((j) =>
            j.id === jobId ? { ...j, calculated_at: now(), updated_at: now() } : j
          ),
          plasmaJobLines: state.plasmaJobLines.map((line) => {
            const updated = pricedLines.find((l) => l.id === line.id);
            return updated && line.plasma_job_id === jobId ? updated : line;
          }),
        }));
        return { success: true, totals, warnings: warnings?.map((w) => w.message) };
      },

      postPlasmaJobToWorkOrder: (plasmaJobId) => {
        const state = get();
        const job = state.plasmaJobs.find((j) => j.id === plasmaJobId);
        if (!job) return { success: false, error: 'Plasma job not found' };
        if (!job.work_order_id) return { success: false, error: 'Plasma job is not linked to a work order' };
        const order = state.workOrders.find((o) => o.id === job.work_order_id);
        if (order?.status === 'INVOICED') return { success: false, error: 'Work order is invoiced' };

        const calculation = job.calculated_at ? { success: true } : get().recalculatePlasmaJob(plasmaJobId);
        if (!calculation?.success) return calculation;
        const updatedLines = get().plasmaJobLines.filter((l) => l.plasma_job_id === plasmaJobId);
        const totalPrice = updatedLines.reduce((sum, line) => sum + line.sell_price_total, 0);
        const description = `Plasma Job ${job.id}`;
        upsertPlasmaChargeLine({
          target: 'WORK_ORDER',
          orderId: job.work_order_id,
          plasmaJobId,
          description,
          totalPrice,
        });
        set((state) => ({
          plasmaJobs: state.plasmaJobs.map((j) =>
            j.id === plasmaJobId
              ? { ...j, status: j.status === 'CUT' ? 'CUT' : 'APPROVED', posted_at: now(), updated_at: now() }
              : j
          ),
        }));
        return { success: true };
      },

      // Purchase Orders
      purchaseOrders: [],
      purchaseOrderLines: [],
      receivingRecords: [],
      receivingReceipts: [],
      inventoryAdjustments: [],
      vendorCostHistory: [],

      // Returns
      returns: [
        {
          id: 'return-1',
          vendor_id: 'vendor-1',
          purchase_order_id: null,
          sales_order_id: null,
          work_order_id: null,
          status: 'DRAFT' as ReturnStatus,
          reason: 'Damaged packaging on arrival',
          rma_number: null,
          carrier: null,
          tracking_number: null,
          shipped_at: null,
          received_at: null,
          credited_at: null,
          credit_amount: null,
          credit_memo_number: null,
          credit_memo_amount: null,
          credit_memo_date: null,
          reimbursed_amount: null,
          reimbursed_date: null,
          reimbursement_reference: null,
          approved_amount: null,
          notes: null,
          created_at: now(),
          updated_at: now(),
          is_active: true,
        },
      ] as Return[],
      returnLines: [
        {
          id: 'return-line-1',
          return_id: 'return-1',
          part_id: 'part-1',
          purchase_order_line_id: null,
          quantity: 1,
          unit_cost: 45,
          condition: 'DAMAGED' as ReturnLineCondition,
          reason: 'Bent during transit',
          created_at: now(),
          updated_at: now(),
          is_active: true,
        },
      ] as ReturnLine[],

      // Warranty
      warrantyPolicies: [
        {
          id: 'policy-1',
          vendor_id: 'vendor-1',
          default_labor_rate: 100,
          labor_coverage_percent: 50,
          parts_coverage_percent: 100,
          days_covered: 180,
          miles_covered: null,
          requires_rma: true,
          notes: 'Standard policy',
          is_active: true,
          created_at: now(),
          updated_at: now(),
        },
      ],
      warrantyClaims: [
        {
          id: 'claim-1',
          vendor_id: 'vendor-1',
          policy_id: 'policy-1',
          work_order_id: null,
          sales_order_id: null,
          purchase_order_id: null,
          status: 'OPEN' as WarrantyClaimStatus,
          claim_number: 'CLM-001',
          rma_number: null,
          submitted_at: null,
          decided_at: null,
          paid_at: null,
          amount_requested: 150,
          approved_amount: null,
          credit_memo_number: null,
          credit_memo_amount: null,
          credit_memo_date: null,
          reimbursed_amount: null,
          reimbursed_date: null,
          reimbursement_reference: null,
          reason: 'Defective part',
          notes: null,
          is_active: true,
          created_at: now(),
          updated_at: now(),
        },
      ] as WarrantyClaim[],
      warrantyClaimLines: [
        {
          id: 'claim-line-1',
          claim_id: 'claim-1',
          part_id: 'part-1',
          labor_line_id: null,
          description: 'Return defective part',
          quantity: 1,
          unit_cost: 150,
          labor_hours: null,
          labor_rate: null,
          amount: 150,
          is_active: true,
          created_at: now(),
          updated_at: now(),
        },
      ],

      createPurchaseOrder: (vendorId) => {
        const state = get();
        const newOrder: PurchaseOrder = {
          id: generateId(),
          po_number: generateOrderNumber('PO', state.purchaseOrders.length),
          vendor_id: vendorId,
          status: 'OPEN',
          sales_order_id: null,
          work_order_id: null,
          notes: null,
          created_at: now(),
          updated_at: now(),
        };
        set((state) => ({
          purchaseOrders: [...state.purchaseOrders, newOrder],
        }));
        return newOrder;
      },

      poAddLine: (orderId, partId, quantity) => {
        const state = get();
        const order = state.purchaseOrders.find((o) => o.id === orderId);
        
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status === 'CLOSED') return { success: false, error: 'Cannot modify closed PO' };
        
        const part = state.parts.find((p) => p.id === partId);
        if (!part) return { success: false, error: 'Part not found' };

        // Check for existing line
        const existingLine = state.purchaseOrderLines.find(
          (l) => l.purchase_order_id === orderId && l.part_id === partId
        );

        if (existingLine) {
          const newQty = existingLine.ordered_quantity + quantity;
          set((state) => ({
            purchaseOrderLines: state.purchaseOrderLines.map((l) =>
              l.id === existingLine.id
                ? { ...l, ordered_quantity: newQty, updated_at: now() }
                : l
            ),
          }));
        } else {
          const newLine: PurchaseOrderLine = {
            id: generateId(),
            purchase_order_id: orderId,
            part_id: partId,
            ordered_quantity: quantity,
            received_quantity: 0,
            unit_cost: part.cost, // Snapshot cost
            created_at: now(),
            updated_at: now(),
          };

          set((state) => ({
            purchaseOrderLines: [...state.purchaseOrderLines, newLine],
          }));
        }

        return { success: true };
      },

      poUpdateLineQty: (lineId, newQty) => {
        const state = get();
        const line = state.purchaseOrderLines.find((l) => l.id === lineId);
        if (!line) return { success: false, error: 'Line not found' };

        const order = state.purchaseOrders.find((o) => o.id === line.purchase_order_id);
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status === 'CLOSED') return { success: false, error: 'Cannot modify closed PO' };

        if (newQty < line.received_quantity) {
          return { success: false, error: 'Cannot reduce quantity below received amount' };
        }

        set((state) => ({
          purchaseOrderLines: state.purchaseOrderLines.map((l) =>
            l.id === lineId ? { ...l, ordered_quantity: newQty, updated_at: now() } : l
          ),
        }));

        return { success: true };
      },

      poRemoveLine: (lineId) => {
        const state = get();
        const line = state.purchaseOrderLines.find((l) => l.id === lineId);
        if (!line) return { success: false, error: 'Line not found' };

        const order = state.purchaseOrders.find((o) => o.id === line.purchase_order_id);
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status === 'CLOSED') return { success: false, error: 'Cannot modify closed PO' };

        if (line.received_quantity > 0) {
          return { success: false, error: 'Cannot remove line with received items' };
        }

        set((state) => ({
          purchaseOrderLines: state.purchaseOrderLines.filter((l) => l.id !== lineId),
        }));

        return { success: true };
      },

      poReceive: (lineId, quantity) => {
        const state = get();
        const line = state.purchaseOrderLines.find((l) => l.id === lineId);
        if (!line) return { success: false, error: 'Line not found' };

        const order = state.purchaseOrders.find((o) => o.id === line.purchase_order_id);
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status === 'CLOSED') return { success: false, error: 'Cannot receive on closed PO' };

        const remaining = line.ordered_quantity - line.received_quantity;
        if (quantity > remaining) {
          return { success: false, error: `Cannot receive more than remaining quantity (${remaining})` };
        }

        const newReceivedQty = line.received_quantity + quantity;
        const part = state.parts.find((p) => p.id === line.part_id);
        if (!part) return { success: false, error: 'Part not found' };

        // Create receiving record
        const receivingRecord: ReceivingRecord = {
          id: generateId(),
          purchase_order_line_id: lineId,
          quantity_received: quantity,
          received_at: now(),
          notes: null,
        };
        const costHistory: VendorCostHistory = {
          id: generateId(),
          part_id: line.part_id,
          vendor_id: order.vendor_id,
          unit_cost: line.unit_cost,
          quantity,
          source: 'RECEIVING',
          created_at: now(),
        };
        const oldQoh = part.quantity_on_hand;
        const receivedCost = line.unit_cost;
        const receivedQty = quantity;
        let avgCost = part.avg_cost;
        if (avgCost === null || oldQoh <= 0) {
          avgCost = receivedCost;
        } else {
          avgCost = ((avgCost * oldQoh) + (receivedCost * receivedQty)) / (oldQoh + receivedQty);
        }
        const timestamp = now();

        set((state) => ({
          purchaseOrderLines: state.purchaseOrderLines.map((l) =>
            l.id === lineId
              ? { ...l, received_quantity: newReceivedQty, updated_at: timestamp }
              : l
          ),
          // Update part inventory and cost
          parts: state.parts.map((p) =>
            p.id === line.part_id
              ? { 
                  ...p, 
                  quantity_on_hand: p.quantity_on_hand + quantity,
                  cost: line.unit_cost, // Update to last received cost
                  last_cost: receivedCost,
                  avg_cost: avgCost,
                  updated_at: timestamp, 
                }
              : p
          ),
          receivingRecords: [...state.receivingRecords, receivingRecord],
          vendorCostHistory: [...state.vendorCostHistory, costHistory],
        }));

        get().recordInventoryMovement({
          part_id: line.part_id,
          movement_type: 'RECEIVE',
          qty_delta: quantity,
          reason: 'PO Receiving',
          ref_type: 'PURCHASE_ORDER',
          ref_id: order.id,
        });

        return { success: true };
      },

      poClose: (orderId) => {
        const state = get();
        const order = state.purchaseOrders.find((o) => o.id === orderId);
        if (!order) return { success: false, error: 'Order not found' };
        if (order.status === 'CLOSED') return { success: false, error: 'Order already closed' };

        // Check all lines are fully received
        const lines = state.purchaseOrderLines.filter((l) => l.purchase_order_id === orderId);
        const hasOutstanding = lines.some((l) => l.received_quantity < l.ordered_quantity);
        
        if (hasOutstanding) {
          return { success: false, error: 'Cannot close PO with outstanding quantities' };
        }

        set((state) => ({
          purchaseOrders: state.purchaseOrders.map((o) =>
            o.id === orderId ? { ...o, status: 'CLOSED', updated_at: now() } : o
          ),
        }));

        return { success: true };
      },

      updatePurchaseOrderNotes: (orderId, notes) =>
        set((state) => ({
          purchaseOrders: state.purchaseOrders.map((o) =>
            o.id === orderId ? { ...o, notes, updated_at: now() } : o
          ),
        })),

      updatePurchaseOrderLinks: (orderId, links) =>
        set((state) => ({
          purchaseOrders: state.purchaseOrders.map((o) =>
            o.id === orderId
              ? { ...o, sales_order_id: links.sales_order_id, work_order_id: links.work_order_id, updated_at: now() }
              : o
          ),
        })),

      getPurchaseOrderLines: (orderId) =>
        get().purchaseOrderLines.filter((l) => l.purchase_order_id === orderId),

      getReceivingRecords: (lineId) =>
        get().receivingRecords.filter((r) => r.purchase_order_line_id === lineId),

      // Returns
      createReturn: (payload) => {
        if (!payload.vendor_id) return null;
        const timestamp = now();
        const newReturn: Return = {
          id: generateId(),
          vendor_id: payload.vendor_id,
          purchase_order_id: payload.purchase_order_id ?? null,
          sales_order_id: payload.sales_order_id ?? null,
          work_order_id: payload.work_order_id ?? null,
          status: 'DRAFT',
          reason: null,
          rma_number: null,
          carrier: null,
          tracking_number: null,
          shipped_at: null,
          received_at: null,
          credited_at: null,
          credit_amount: null,
          credit_memo_number: null,
          credit_memo_amount: null,
          credit_memo_date: null,
          reimbursed_amount: null,
          reimbursed_date: null,
          reimbursement_reference: null,
          approved_amount: null,
          notes: null,
          created_at: timestamp,
          updated_at: timestamp,
          is_active: true,
        };
        set((state) => ({
          returns: [...state.returns, newReturn],
        }));
        return newReturn;
      },

      updateReturn: (id, patch) =>
        set((state) => ({
          returns: state.returns.map((ret) =>
            ret.id === id ? { ...ret, ...patch, updated_at: now() } : ret
          ),
        })),

      setReturnStatus: (id, status) =>
        set((state) => ({
          returns: state.returns.map((ret) =>
            ret.id === id ? { ...ret, status, updated_at: now() } : ret
          ),
        })),

      addReturnLine: (returnId, payload) => {
        if (payload.quantity <= 0) return null;
        const timestamp = now();
        const newLine: ReturnLine = {
          id: generateId(),
          return_id: returnId,
          part_id: payload.part_id,
          purchase_order_line_id: payload.purchase_order_line_id ?? null,
          quantity: payload.quantity,
          unit_cost: payload.unit_cost ?? null,
          condition: payload.condition,
          reason: payload.reason ?? null,
          created_at: timestamp,
          updated_at: timestamp,
          is_active: true,
        };
        set((state) => ({
          returnLines: [...state.returnLines, newLine],
        }));
        return newLine;
      },

      updateReturnLine: (lineId, patch) =>
        set((state) => ({
          returnLines: state.returnLines.map((line) =>
            line.id === lineId ? { ...line, ...patch, updated_at: now() } : line
          ),
        })),

      removeReturnLine: (lineId) =>
        set((state) => ({
          returnLines: state.returnLines.map((line) =>
            line.id === lineId ? { ...line, is_active: false, updated_at: now() } : line
          ),
        })),

      getReturnLines: (returnId) =>
        get().returnLines.filter((line) => line.return_id === returnId && line.is_active),

      getReturnsByPurchaseOrder: (poId) =>
        get().returns.filter((ret) => ret.purchase_order_id === poId && ret.is_active),

      // Warranty
      upsertWarrantyPolicy: (vendorId, patch) => {
        if (!vendorId) throw new Error('vendor_id required');
        const state = get();
        const existing = state.warrantyPolicies.find((p) => p.vendor_id === vendorId && p.is_active);
        const timestamp = now();
        if (existing) {
          const updated: WarrantyPolicy = {
            ...existing,
            ...patch,
            vendor_id: vendorId,
            updated_at: timestamp,
          };
          set((state) => ({
            warrantyPolicies: state.warrantyPolicies.map((p) => (p.id === existing.id ? updated : p)),
          }));
          return updated;
        }
        const newPolicy: WarrantyPolicy = {
          id: generateId(),
          vendor_id: vendorId,
          default_labor_rate: patch.default_labor_rate ?? null,
          labor_coverage_percent: patch.labor_coverage_percent ?? null,
          parts_coverage_percent: patch.parts_coverage_percent ?? null,
          days_covered: patch.days_covered ?? null,
          miles_covered: patch.miles_covered ?? null,
          requires_rma: patch.requires_rma ?? false,
          notes: patch.notes ?? null,
          is_active: true,
          created_at: timestamp,
          updated_at: timestamp,
        };
        set((state) => ({
          warrantyPolicies: [...state.warrantyPolicies, newPolicy],
        }));
        return newPolicy;
      },

      createWarrantyClaim: (payload) => {
        if (!payload.vendor_id) return null;
        const timestamp = now();
        const newClaim: WarrantyClaim = {
          id: generateId(),
          vendor_id: payload.vendor_id,
          policy_id: payload.policy_id ?? null,
          work_order_id: payload.work_order_id ?? null,
          sales_order_id: payload.sales_order_id ?? null,
          purchase_order_id: payload.purchase_order_id ?? null,
          status: 'OPEN',
          claim_number: null,
          rma_number: null,
          submitted_at: null,
          decided_at: null,
          paid_at: null,
          amount_requested: null,
          approved_amount: null,
          credit_memo_number: null,
          credit_memo_amount: null,
          credit_memo_date: null,
          reimbursed_amount: null,
          reimbursed_date: null,
          reimbursement_reference: null,
          reason: null,
          notes: null,
          is_active: true,
          created_at: timestamp,
          updated_at: timestamp,
        };
        set((state) => ({
          warrantyClaims: [...state.warrantyClaims, newClaim],
        }));
        return newClaim;
      },

      updateWarrantyClaim: (id, patch) =>
        set((state) => ({
          warrantyClaims: state.warrantyClaims.map((c) =>
            c.id === id ? { ...c, ...patch, updated_at: now() } : c
          ),
        })),

      setWarrantyClaimStatus: (id, status) => {
        const timestamp = now();
        set((state) => ({
          warrantyClaims: state.warrantyClaims.map((c) => {
            if (c.id !== id) return c;
            const updates: Partial<WarrantyClaim> = { status, updated_at: timestamp };
            if (status === 'SUBMITTED') updates.submitted_at = timestamp;
            if (status === 'APPROVED' || status === 'DENIED') updates.decided_at = timestamp;
            if (status === 'PAID') updates.paid_at = timestamp;
            if (status === 'CLOSED') updates.decided_at = c.decided_at ?? timestamp;
            return { ...c, ...updates };
          }),
        }));
      },

      addWarrantyClaimLine: (claimId, payload) => {
        const claim = get().warrantyClaims.find((c) => c.id === claimId);
        if (!claim) return null;
        const timestamp = now();
        const newLine: WarrantyClaimLine = {
          id: generateId(),
          claim_id: claimId,
          part_id: payload.part_id ?? null,
          labor_line_id: payload.labor_line_id ?? null,
          description: payload.description ?? null,
          quantity: payload.quantity ?? null,
          unit_cost: payload.unit_cost ?? null,
          labor_hours: payload.labor_hours ?? null,
          labor_rate: payload.labor_rate ?? null,
          amount: payload.amount ?? null,
          is_active: true,
          created_at: timestamp,
          updated_at: timestamp,
        };
        set((state) => ({
          warrantyClaimLines: [...state.warrantyClaimLines, newLine],
        }));
        return newLine;
      },

      updateWarrantyClaimLine: (lineId, patch) =>
        set((state) => ({
          warrantyClaimLines: state.warrantyClaimLines.map((line) =>
            line.id === lineId ? { ...line, ...patch, updated_at: now() } : line
          ),
        })),

      removeWarrantyClaimLine: (lineId) =>
        set((state) => ({
          warrantyClaimLines: state.warrantyClaimLines.map((line) =>
            line.id === lineId ? { ...line, is_active: false, updated_at: now() } : line
          ),
        })),

      getWarrantyPolicyByVendor: (vendorId) =>
        get().warrantyPolicies.find((p) => p.vendor_id === vendorId && p.is_active),

      getClaimsByVendor: (vendorId) =>
        get().warrantyClaims.filter((c) => c.vendor_id === vendorId && c.is_active),

      getClaimsByWorkOrder: (workOrderId) =>
        get().warrantyClaims.filter((c) => c.work_order_id === workOrderId && c.is_active),

      getWarrantyClaimLines: (claimId) =>
        get().warrantyClaimLines.filter((l) => l.claim_id === claimId && l.is_active),

      // Cycle Counts
      cycleCountSessions: [],
      cycleCountLines: [],

      createCycleCountSession: (session) => {
        const timestamp = now();
        const newSession: CycleCountSession = {
          id: generateId(),
          status: 'DRAFT',
          title: session.title?.trim() || null,
          notes: session.notes?.trim() || null,
          created_at: timestamp,
          created_by: session.created_by?.trim() || 'system',
          posted_at: null,
          posted_by: null,
        };
        set((state) => ({
          cycleCountSessions: [...state.cycleCountSessions, newSession],
        }));
        return newSession;
      },

      updateCycleCountSession: (id, session) =>
        set((state) => ({
          cycleCountSessions: state.cycleCountSessions.map((s) =>
            s.id === id ? { ...s, ...session } : s
          ),
        })),

      cancelCycleCountSession: (id) => {
        const state = get();
        const existing = state.cycleCountSessions.find((s) => s.id === id);
        if (!existing) return { success: false, error: 'Cycle count not found' };
        if (existing.status !== 'DRAFT') return { success: false, error: 'Cannot cancel posted cycle count' };
        set((state) => ({
          cycleCountSessions: state.cycleCountSessions.map((s) =>
            s.id === id ? { ...s, status: 'CANCELLED' as const } : s
          ),
        }));
        return { success: true };
      },

      addCycleCountLine: (sessionId, partId) => {
        const state = get();
        const session = state.cycleCountSessions.find((s) => s.id === sessionId);
        if (!session) return { success: false, error: 'Cycle count not found' };
        if (session.status !== 'DRAFT') return { success: false, error: 'Cannot modify a posted cycle count' };
        const part = state.parts.find((p) => p.id === partId);
        if (!part) return { success: false, error: 'Part not found' };
        if (part.is_kit) return { success: false, error: 'Kits cannot be counted directly' };
        if (state.cycleCountLines.some((l) => l.session_id === sessionId && l.part_id === partId)) {
          return { success: false, error: 'Part already added' };
        }

        const expected = part.quantity_on_hand;
        const timestamp = now();
        const newLine: CycleCountLine = {
          id: generateId(),
          session_id: sessionId,
          part_id: partId,
          expected_qty: expected,
          counted_qty: expected,
          variance: 0,
          reason: null,
          created_at: timestamp,
          updated_at: timestamp,
        };

        set((state) => ({
          cycleCountLines: [...state.cycleCountLines, newLine],
        }));

        return { success: true };
      },

      updateCycleCountLine: (id, updates) => {
        const state = get();
        const line = state.cycleCountLines.find((l) => l.id === id);
        if (!line) return { success: false, error: 'Line not found' };
        const session = state.cycleCountSessions.find((s) => s.id === line.session_id);
        if (!session || session.status !== 'DRAFT') return { success: false, error: 'Cannot edit this cycle count' };

        const hasCountUpdate = Object.prototype.hasOwnProperty.call(updates, 'counted_qty');
        const counted_qty = hasCountUpdate ? updates.counted_qty ?? null : line.counted_qty;
        const variance = counted_qty == null ? 0 : counted_qty - line.expected_qty;
        set((state) => ({
          cycleCountLines: state.cycleCountLines.map((l) =>
            l.id === id
              ? {
                  ...l,
                  counted_qty,
                  variance,
                  reason: Object.prototype.hasOwnProperty.call(updates, 'reason') ? updates.reason ?? null : l.reason,
                  updated_at: now(),
                }
              : l
          ),
        }));
        return { success: true };
      },

      postCycleCountSession: (id, posted_by = 'system') => {
        const state = get();
        const session = state.cycleCountSessions.find((s) => s.id === id);
        if (!session) return { success: false, error: 'Cycle count not found' };
        if (session.status !== 'DRAFT') return { success: false, error: 'Cycle count already processed' };

        const lines = state.cycleCountLines.filter((l) => l.session_id === id);
        for (const line of lines) {
          if (line.variance !== 0 && (!line.reason || !line.reason.trim())) {
            return { success: false, error: 'Reason required for all variances before posting' };
          }
        }

        const poster = posted_by?.trim() || 'system';
        const timestamp = now();

        for (const line of lines) {
          if (line.variance === 0) continue;
          const reasonText = line.reason?.trim() || 'Variance';
          const reason = `Cycle Count ${id}: ${reasonText}`;
          const expected = line.expected_qty;
          const delta = line.counted_qty - expected;
          get().updatePartWithQohAdjustment(line.part_id, { quantity_on_hand: line.counted_qty }, { reason, adjusted_by: poster });
          get().recordInventoryMovement({
            part_id: line.part_id,
            movement_type: 'COUNT',
            qty_delta: delta,
            reason,
            ref_type: 'CYCLE_COUNT',
            ref_id: id,
            performed_by: poster,
            performed_at: timestamp,
          });
        }

        set((state) => ({
          cycleCountSessions: state.cycleCountSessions.map((s) =>
            s.id === id
              ? { ...s, status: 'POSTED' as const, posted_at: timestamp, posted_by: poster }
              : s
          ),
        }));

        return { success: true };
      },

      getCycleCountLines: (sessionId) =>
        get().cycleCountLines.filter((l) => l.session_id === sessionId),

      // PM Schedules
      pmSchedules: [],
      pmHistory: [],

      addPMSchedule: (schedule) => {
        const newSchedule: UnitPMSchedule = {
          ...schedule,
          id: generateId(),
          last_generated_due_key: schedule.last_generated_due_key ?? null,
          last_generated_work_order_id: schedule.last_generated_work_order_id ?? null,
          is_active: true,
          created_at: now(),
          updated_at: now(),
        };
        set((state) => ({
          pmSchedules: [...state.pmSchedules, newSchedule],
        }));
        return newSchedule;
      },

      updatePMSchedule: (id, schedule) =>
        set((state) => ({
          pmSchedules: state.pmSchedules.map((s) =>
            s.id === id ? { ...s, ...schedule, updated_at: now() } : s
          ),
        })),

      deactivatePMSchedule: (id) =>
        set((state) => ({
          pmSchedules: state.pmSchedules.map((s) =>
            s.id === id ? { ...s, is_active: false, updated_at: now() } : s
          ),
        })),

      getPMSchedulesByUnit: (unitId) =>
        get().pmSchedules.filter((s) => s.unit_id === unitId && s.is_active),

      addPMHistory: (history) => {
        const newHistory: UnitPMHistory = {
          ...history,
          id: generateId(),
          is_active: true,
          created_at: now(),
        };
        set((state) => ({
          pmHistory: [...state.pmHistory, newHistory],
        }));
        return newHistory;
      },

      getPMHistoryByUnit: (unitId) =>
        get().pmHistory.filter((h) => h.unit_id === unitId && h.is_active),

      markPMCompleted: (scheduleId, completedDate, completedMeter, notes) => {
        const state = get();
        const schedule = state.pmSchedules.find((s) => s.id === scheduleId);
        if (!schedule) return { success: false, error: 'Schedule not found' };

        // Add history record
        const historyRecord: UnitPMHistory = {
          id: generateId(),
          unit_id: schedule.unit_id,
          schedule_id: scheduleId,
          completed_date: completedDate,
          completed_meter: completedMeter,
          notes: notes,
          related_work_order_id: schedule.last_generated_work_order_id ?? null,
          is_active: true,
          created_at: now(),
        };

        // Update schedule with last completed info
        set((state) => ({
          pmSchedules: state.pmSchedules.map((s) =>
            s.id === scheduleId
              ? {
                  ...s,
                  last_completed_date: completedDate,
                  last_completed_meter: completedMeter,
                  last_generated_due_key: null,
                  last_generated_work_order_id: null,
                  updated_at: now(),
                }
              : s
          ),
          pmHistory: [...state.pmHistory, historyRecord],
        }));

        return { success: true };
      },
      };
    },
    {
      name: 'shop-storage-v2',
    }
  )
);
