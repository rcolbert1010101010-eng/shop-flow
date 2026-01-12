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
  PartKitComponent,
  VendorCostHistory,
  Technician,
  TimeEntry,
  SalesOrder,
  SalesOrderLine,
  SalesOrderStatus,
  WorkOrder,
  WorkOrderPartLine,
  WorkOrderLaborLine,
  PurchaseOrder,
  PurchaseOrderLine,
  ReceivingRecord,
  CycleCountSession,
  CycleCountLine,
  Return,
  ReturnLine,
  ReturnStatus,
  WarrantyPolicy,
  WarrantyClaim,
  WarrantyClaimLine,
  WarrantyClaimStatus,
  FabJob,
  FabJobLine,
  WorkOrderChargeLine,
  PlasmaJob,
  PlasmaJobLine,
  PlasmaJobAttachment,
  PlasmaTemplate,
  PlasmaTemplateLine,
  Remnant,
  SalesOrderChargeLine,
  ScheduleItem,
  InventoryMovement,
  Invoice,
  InvoiceLine,
} from '@/types';
import type { FabricationPricingSettings } from '@/services/fabricationPricingService';
import type { PlasmaPricingSettings } from '@/services/plasmaPricingService';

export interface SettingsRepo {
  settings: SystemSettings;
  updateSettings: (settings: Partial<SystemSettings>) => void;
  logSettingHistory?: (payload: any) => Promise<void> | void;
  listSettingHistory?: (args?: { key?: string; limit?: number }) => Promise<any[]>;
}

export interface CustomersRepo {
  customers: Customer[];
  addCustomer: (
    customer: Omit<Customer, 'id' | 'is_active' | 'created_at' | 'updated_at'>
  ) => { success: boolean; customer?: Customer; error?: string };
  updateCustomer: (
    id: string,
    customer: Partial<Customer>
  ) => { success: boolean; customer?: Customer; error?: string };
  deactivateCustomer: (id: string) => boolean;
  isCustomerOnCreditHold?: (customerId: string) => boolean;
}

export interface CustomerContactsRepo {
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
}

export interface UnitsRepo {
  units: Unit[];
  addUnit: (unit: Omit<Unit, 'id' | 'is_active' | 'created_at' | 'updated_at'>) => Unit;
  updateUnit: (id: string, unit: Partial<Unit>) => void;
  deactivateUnit: (id: string) => void;
  getUnitsByCustomer: (customerId: string) => Unit[];
}

export interface UnitAttachmentsRepo {
  list: (unitId: string) => UnitAttachment[];
  add: (unitId: string, file: File, options?: { tag?: UnitAttachmentTag; notes?: string | null }) => { success: boolean; attachment?: UnitAttachment; error?: string };
  remove: (attachmentId: string) => void;
  update: (attachmentId: string, patch: Partial<Pick<UnitAttachment, 'tag' | 'notes' | 'is_primary' | 'sort_order'>>) => void;
  setPrimary: (attachmentId: string) => void;
  reorder: (unitId: string, orderedIds: string[]) => void;
}

export interface VendorsRepo {
  vendors: Vendor[];
  addVendor: (vendor: Omit<Vendor, 'id' | 'is_active' | 'created_at' | 'updated_at'>) => Vendor;
  updateVendor: (id: string, vendor: Partial<Vendor>) => void;
  deactivateVendor: (id: string) => void;
}

export interface CategoriesRepo {
  categories: PartCategory[];
  addCategory: (category: Omit<PartCategory, 'id' | 'is_active' | 'created_at' | 'updated_at'>) => PartCategory;
  updateCategory: (id: string, category: Partial<PartCategory>) => void;
  deactivateCategory: (id: string) => void;
}

export interface PartsRepo {
  parts: Part[];
  addPart: (part: Omit<Part, 'id' | 'is_active' | 'created_at' | 'updated_at' | 'last_cost' | 'avg_cost' | 'barcode'> & Partial<Pick<Part, 'last_cost' | 'avg_cost' | 'barcode'>>) => Part;
  updatePart: (id: string, part: Partial<Part>) => void;
  updatePartWithQohAdjustment: (
    id: string,
    part: Partial<Part>,
    meta: { reason: string; adjusted_by: string }
  ) => { success: boolean; warning?: string; error?: string };
  deactivatePart: (id: string) => void;
  reactivatePart: (id: string) => void;
  getMovementsForPart?: (partId: string) => InventoryMovement[];
  receiveInventory?: (payload: {
    lines: { part_id: string; quantity: number; unit_cost?: number | null }[];
    vendor_id?: string | null;
    reference?: string | null;
    received_at?: string | null;
    source_type?: 'PURCHASE_ORDER' | 'MANUAL';
    source_id?: string | null;
  }) => { success: boolean; error?: string };
}

export interface KitComponentsRepo {
  kitComponents: PartKitComponent[];
  addKitComponent: (component: Omit<PartKitComponent, 'id' | 'is_active' | 'created_at' | 'updated_at'>) => PartKitComponent;
  updateKitComponentQuantity: (id: string, quantity: number) => void;
  removeKitComponent: (id: string) => void;
}

export interface VendorCostHistoryRepo {
  vendorCostHistory: VendorCostHistory[];
}

export interface TechniciansRepo {
  technicians: Technician[];
  addTechnician: (technician: Omit<Technician, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<Technician, 'is_active' | 'employment_type' | 'skill_tags' | 'work_schedule' | 'certifications'>>) => Technician;
  updateTechnician: (id: string, technician: Partial<Technician>) => void;
  deactivateTechnician: (id: string) => void;
}

export interface TimeEntriesRepo {
  timeEntries: TimeEntry[];
  clockIn: (technicianId: string, workOrderId: string) => { success: boolean; error?: string };
  clockOut: (technicianId: string) => { success: boolean; error?: string };
  getActiveTimeEntry: (technicianId: string) => TimeEntry | undefined;
  getTimeEntriesByWorkOrder: (workOrderId: string) => TimeEntry[];
}

export interface SalesOrdersRepo {
  salesOrders: SalesOrder[];
  salesOrderLines: SalesOrderLine[];
  salesOrderChargeLines: SalesOrderChargeLine[];
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
  getSalesOrderChargeLines: (orderId: string) => SalesOrderChargeLine[];
  addSalesOrderChargeLine: (line: Omit<SalesOrderChargeLine, 'id' | 'created_at' | 'updated_at'> & { id?: string }) => SalesOrderChargeLine | null;
  updateSalesOrderChargeLine: (id: string, patch: Partial<SalesOrderChargeLine>) => void;
  removeSalesOrderChargeLine: (id: string) => void;
  recalculateSalesOrderTotals: (orderId: string) => void;
}

export interface WorkOrdersRepo {
  workOrders: WorkOrder[];
  workOrderPartLines: WorkOrderPartLine[];
  workOrderLaborLines: WorkOrderLaborLine[];
  workOrderChargeLines: WorkOrderChargeLine[];
  createWorkOrder: (customerId: string, unitId: string) => WorkOrder;
  woAddPartLine: (orderId: string, partId: string, qty: number, jobLineId?: string | null) => { success: boolean; error?: string };
  woUpdatePartQty: (lineId: string, newQty: number) => { success: boolean; error?: string };
  woUpdateLineUnitPrice: (lineId: string, newUnitPrice: number) => { success: boolean; error?: string };
  woRemovePartLine: (lineId: string) => { success: boolean; error?: string };
  woTogglePartWarranty: (lineId: string) => { success: boolean; error?: string };
  woToggleCoreReturned: (lineId: string) => { success: boolean; error?: string };
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
  getWorkOrderPartLines: (orderId: string) => WorkOrderPartLine[];
  getWorkOrderLaborLines: (orderId: string) => WorkOrderLaborLine[];
  getWorkOrderChargeLines: (orderId: string) => WorkOrderChargeLine[];
  updateWorkOrderNotes: (orderId: string, notes: string | null) => void;
  addWorkOrderChargeLine: (line: Omit<WorkOrderChargeLine, 'id' | 'created_at' | 'updated_at'> & { id?: string }) => WorkOrderChargeLine | null;
  updateWorkOrderChargeLine: (id: string, patch: Partial<WorkOrderChargeLine>) => void;
  removeWorkOrderChargeLine: (id: string) => void;
  recalculateWorkOrderTotals: (orderId: string) => void;
}

export interface FabricationRepo {
  fabJobs: FabJob[];
  fabJobLines: FabJobLine[];
  createForWorkOrder: (workOrderId: string) => FabJob;
  getByWorkOrder: (workOrderId: string) => { job: FabJob; lines: FabJobLine[] } | null;
  updateJob: (id: string, patch: Partial<FabJob>) => FabJob | null;
  upsertLine: (jobId: string, line: Partial<FabJobLine>) => FabJobLine | null;
  deleteLine: (lineId: string) => void;
  recalculate: (
    fabJobId: string,
    settingsOverride?: Partial<FabricationPricingSettings>
  ) => { success: boolean; error?: string; warnings?: string[] };
  postToWorkOrder: (fabJobId: string) => { success: boolean; error?: string };
}

export interface PlasmaRepo {
  plasmaJobs: PlasmaJob[];
  plasmaJobLines: PlasmaJobLine[];
  plasmaAttachments: PlasmaJobAttachment[];
  plasmaTemplates: PlasmaTemplate[];
  plasmaTemplateLines: PlasmaTemplateLine[];
  createForWorkOrder: (workOrderId: string) => PlasmaJob;
  getByWorkOrder: (workOrderId: string) => { job: PlasmaJob; lines: PlasmaJobLine[] } | null;
  createStandalone: (payload?: { sales_order_id?: string | null }) => PlasmaJob;
  get: (plasmaJobId: string) => { job: PlasmaJob; lines: PlasmaJobLine[] } | null;
  getPrintView: (
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
  listStandalone: () => PlasmaJob[];
  linkToSalesOrder: (plasmaJobId: string, salesOrderId: string) => PlasmaJob | null;
  updateJob: (id: string, patch: Partial<PlasmaJob>) => PlasmaJob | null;
  upsertLine: (jobId: string, line: Partial<PlasmaJobLine>) => PlasmaJobLine | null;
  deleteLine: (lineId: string) => void;
  recalc: (jobId: string, settingsOverride?: Partial<PlasmaPricingSettings>) => { success: boolean; error?: string; totals?: { sell_price_total: number }; warnings?: string[] };
  postToWorkOrder: (plasmaJobId: string) => { success: boolean; error?: string };
  postToSalesOrder: (plasmaJobId: string) => { success: boolean; error?: string };
  templates: {
    list: () => PlasmaTemplate[];
    get: (templateId: string) => { template: PlasmaTemplate; lines: PlasmaTemplateLine[] } | null;
    create: (payload: Omit<PlasmaTemplate, 'id' | 'created_at' | 'updated_at'>) => PlasmaTemplate;
    update: (templateId: string, patch: Partial<PlasmaTemplate>) => void;
    remove: (templateId: string) => void;
    addLine: (templateId: string, line: Omit<PlasmaTemplateLine, 'id' | 'plasma_template_id' | 'created_at' | 'updated_at'>) => PlasmaTemplateLine;
    updateLine: (lineId: string, patch: Partial<PlasmaTemplateLine>) => void;
    removeLine: (lineId: string) => void;
    applyToJob: (templateId: string, plasmaJobId: string) => { success: boolean; error?: string };
  };
  attachments: {
    list: (plasmaJobId: string) => PlasmaJobAttachment[];
    add: (plasmaJobId: string, file: File, options?: { notes?: string | null }) => { success: boolean; error?: string };
    remove: (attachmentId: string) => void;
    update: (attachmentId: string, patch: Partial<PlasmaJobAttachment>) => void;
  };
  remnants: {
    list: () => Remnant[];
    create: (remnant: Omit<Remnant, 'id' | 'created_at' | 'updated_at' | 'status'> & Partial<Pick<Remnant, 'status'>>) => Remnant;
    update: (remnantId: string, patch: Partial<Remnant>) => void;
    remove: (remnantId: string) => void;
    consume: (remnantId: string) => void;
  };
}

export interface PurchaseOrdersRepo {
  purchaseOrders: PurchaseOrder[];
  purchaseOrderLines: PurchaseOrderLine[];
  receivingRecords: ReceivingRecord[];
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
}

export interface ReturnsRepo {
  returns: Return[];
  returnLines: ReturnLine[];
  createReturn: (payload: { vendor_id: string; purchase_order_id?: string | null; sales_order_id?: string | null; work_order_id?: string | null }) => Return | null;
  updateReturn: (id: string, patch: Partial<Return>) => void;
  setReturnStatus: (id: string, status: ReturnStatus) => void;
  addReturnLine: (returnId: string, payload: { part_id: string; purchase_order_line_id?: string | null; quantity: number; unit_cost: number | null; condition: ReturnLine['condition']; reason?: string | null }) => ReturnLine | null;
  updateReturnLine: (lineId: string, patch: Partial<ReturnLine>) => void;
  removeReturnLine: (lineId: string) => void;
  getReturnLines: (returnId: string) => ReturnLine[];
  getReturnsByPurchaseOrder: (poId: string) => Return[];
}

export interface WarrantyRepo {
  warrantyPolicies: WarrantyPolicy[];
  warrantyClaims: WarrantyClaim[];
  warrantyClaimLines: WarrantyClaimLine[];
  upsertWarrantyPolicy: (vendorId: string, patch: Partial<WarrantyPolicy>) => WarrantyPolicy;
  createWarrantyClaim: (payload: { vendor_id: string; policy_id?: string | null; work_order_id?: string | null; sales_order_id?: string | null; purchase_order_id?: string | null }) => WarrantyClaim | null;
  updateWarrantyClaim: (id: string, patch: Partial<WarrantyClaim>) => void;
  setWarrantyClaimStatus: (id: string, status: WarrantyClaimStatus) => void;
  addWarrantyClaimLine: (claimId: string, payload: Partial<WarrantyClaimLine> & { claim_id?: string }) => WarrantyClaimLine | null;
  updateWarrantyClaimLine: (lineId: string, patch: Partial<WarrantyClaimLine>) => void;
  removeWarrantyClaimLine: (lineId: string) => void;
  getWarrantyPolicyByVendor: (vendorId: string) => WarrantyPolicy | undefined;
  getClaimsByVendor: (vendorId: string) => WarrantyClaim[];
  getClaimsByWorkOrder: (workOrderId: string) => WarrantyClaim[];
  getWarrantyClaimLines: (claimId: string) => WarrantyClaimLine[];
}

export interface CycleCountsRepo {
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

export interface SchedulingRepo {
  list: () => ScheduleItem[];
  getByWorkOrder: (workOrderId: string) => ScheduleItem[];
  create: (item: Omit<ScheduleItem, 'id' | 'created_at' | 'updated_at'> & { id?: string }) => ScheduleItem;
  update: (id: string, patch: Partial<ScheduleItem>) => ScheduleItem | null;
  remove: (id: string) => void;
  detectConflicts: (
    item?:
      | Pick<ScheduleItem, 'technician_id' | 'start_at' | 'duration_minutes'> & { id?: string | null }
      | string
  ) => ScheduleItem[];
  ensureScheduleItemForWorkOrder: (
    workOrderOrId: WorkOrder | string
  ) => { item: ScheduleItem | null; reason?: string };
}

export interface InvoicesRepo {
  createFromSalesOrder(input: { salesOrderId: string }): Promise<{ invoiceId: string }>;
  createFromWorkOrder(input: { workOrderId: string }): Promise<{ invoiceId: string }>;
  getById(input: { invoiceId: string }): Promise<import('@/types').Invoice>;
  listLines(input: { invoiceId: string }): Promise<import('@/types').InvoiceLine[]>;
  voidInvoice?(input: { invoiceId: string; reason: string }): Promise<import('@/types').Invoice>;
  listAll?(): Promise<import('@/types').Invoice[]>;
}

export interface Repos {
  settings: SettingsRepo;
  customers: CustomersRepo;
  customerContacts: CustomerContactsRepo;
  units: UnitsRepo;
  unitAttachments: UnitAttachmentsRepo;
  vendors: VendorsRepo;
  categories: CategoriesRepo;
  parts: PartsRepo;
  kitComponents: KitComponentsRepo;
  vendorCostHistory: VendorCostHistoryRepo;
  technicians: TechniciansRepo;
  timeEntries: TimeEntriesRepo;
  salesOrders: SalesOrdersRepo;
  workOrders: WorkOrdersRepo;
  invoices: InvoicesRepo;
  purchaseOrders: PurchaseOrdersRepo;
  cycleCounts: CycleCountsRepo;
  returns: ReturnsRepo;
  warranty: WarrantyRepo;
  fabrication: FabricationRepo;
  plasma: PlasmaRepo;
  scheduling: SchedulingRepo;
}
