import { useShopStore } from '@/stores/shopStore';
import {
  listUnitTypes,
  createUnitType,
  updateUnitType,
  setUnitTypeActive,
  ensureUnitTypesSeeded,
} from '@/integrations/supabase/units';
import type { ScheduleItem, WorkOrder } from '@/types';

const SCHEDULABLE_WORK_ORDER_STATUSES: WorkOrder['status'][] = ['OPEN', 'IN_PROGRESS'];

const parseTimeString = (time: string | undefined) => {
  if (!time) return { hours: 8, minutes: 0 };
  const [h, m] = time.split(':').map((p) => parseInt(p, 10));
  return {
    hours: Number.isFinite(h) ? h : 8,
    minutes: Number.isFinite(m) ? m : 0,
  };
};

const getPromisedAt = (workOrder: WorkOrder) => (workOrder as any).promised_at ?? null;
const getTechnicianId = (workOrder: WorkOrder) => (workOrder as any).technician_id ?? null;
const getWorkOrderPriority = (workOrder: WorkOrder) => (workOrder as any).priority;

const getLaborDurationMinutes = (workOrder: WorkOrder, state: ReturnType<typeof useShopStore.getState>) => {
  const lines = state.workOrderLaborLines.filter((l) => l.work_order_id === workOrder.id);
  if (lines.length === 0) return null;
  const minutes = lines.reduce((sum, line) => sum + Math.max(0, line.hours || 0) * 60, 0);
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return Math.min(480, Math.max(30, Math.round(minutes)));
};

const getDefaultDurationMinutes = (workOrder: WorkOrder, state: ReturnType<typeof useShopStore.getState>) => {
  const laborDuration = getLaborDurationMinutes(workOrder, state);
  if (laborDuration) return laborDuration;
  return 120;
};

const isWeekend = (date: Date) => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

const nextBusinessDay = (date: Date) => {
  const d = new Date(date);
  do {
    d.setDate(d.getDate() + 1);
  } while (isWeekend(d));
  d.setHours(0, 0, 0, 0);
  return d;
};

const getStartAtForWorkOrder = (
  workOrder: WorkOrder,
  durationMinutes: number,
  state: ReturnType<typeof useShopStore.getState>
) => {
  const promisedAt = getPromisedAt(workOrder);
  const techId = getTechnicianId(workOrder);
  const settings = state.settings as any;
  const { hours: startHour, minutes: startMinute } = parseTimeString(settings?.shop_hours_start ?? '08:00');
  const { hours: endHour, minutes: endMinute } = parseTimeString(settings?.shop_hours_end ?? '17:00');

  const buildDayStart = (base: Date) => {
    const d = new Date(base);
    d.setHours(startHour, startMinute, 0, 0);
    return d;
  };
  const buildDayEnd = (base: Date) => {
    const d = new Date(base);
    d.setHours(endHour, endMinute, 0, 0);
    return d;
  };

  let candidate = promisedAt ? new Date(promisedAt) : nextBusinessDay(new Date());
  if (Number.isNaN(candidate.getTime())) candidate = nextBusinessDay(new Date());
  candidate = isWeekend(candidate) ? nextBusinessDay(candidate) : candidate;
  candidate.setHours(startHour, startMinute, 0, 0);

  if (!techId) return candidate.toISOString();

  const horizon = 10;
  for (let i = 0; i < horizon; i++) {
    const dayStart = buildDayStart(candidate);
    const dayEnd = buildDayEnd(candidate);
    const items = state.scheduleItems
      .filter((item) => item.technician_id === techId)
      .filter((item) => {
        const start = new Date(item.start_at);
        return (
          start.getFullYear() === candidate.getFullYear() &&
          start.getMonth() === candidate.getMonth() &&
          start.getDate() === candidate.getDate()
        );
      })
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

    let slotStart = dayStart;
    for (const item of items) {
      const itemStart = new Date(item.start_at);
      const itemEnd = new Date(itemStart.getTime() + item.duration_minutes * 60000);
      if (slotStart.getTime() + durationMinutes * 60000 <= itemStart.getTime()) {
        if (slotStart.getTime() + durationMinutes * 60000 <= dayEnd.getTime()) {
          return slotStart.toISOString();
        }
      }
      if (itemEnd.getTime() > slotStart.getTime()) {
        slotStart = itemEnd;
      }
      if (slotStart.getTime() + durationMinutes * 60000 > dayEnd.getTime()) break;
    }
    if (slotStart.getTime() + durationMinutes * 60000 <= dayEnd.getTime()) {
      return slotStart.toISOString();
    }
    candidate = nextBusinessDay(candidate);
  }

  return candidate.toISOString();
};

const ensureScheduleItemForWorkOrder = (
  workOrderOrId: WorkOrder | string
): { item: ScheduleItem | null; reason?: string } => {
  const state = useShopStore.getState();
  if (!state) return { item: null, reason: 'Scheduling store unavailable' };

  const workOrders = state.workOrders || [];
  const resolved =
    typeof workOrderOrId === 'string'
      ? workOrders.find((wo) => wo.id === workOrderOrId)
      : workOrders.find((wo) => wo.id === workOrderOrId.id) || workOrderOrId;

  if (!resolved) return { item: null, reason: 'Work order not found' };
  if (!resolved.customer_id || !resolved.unit_id) {
    return { item: null, reason: 'Work order missing customer or unit' };
  }
  if (!SCHEDULABLE_WORK_ORDER_STATUSES.includes(resolved.status)) {
    return { item: null, reason: 'Work order status not schedulable' };
  }

  const existing = state.scheduleItems.find(
    (item) => item.source_ref_type === 'WORK_ORDER' && item.source_ref_id === resolved.id
  );

  const promised_at = getPromisedAt(resolved);
  const woPriority = getWorkOrderPriority(resolved);

  if (existing) {
    const updates: Partial<ScheduleItem> = {};
    if (promised_at && existing.promised_at !== promised_at) {
      updates.promised_at = promised_at;
    }
    if (
      existing.priority === 3 &&
      typeof woPriority === 'number' &&
      woPriority >= 1 &&
      woPriority <= 5
    ) {
      updates.priority = Math.round(woPriority) as ScheduleItem['priority'];
    }
    if (Object.keys(updates).length > 0) {
      return { item: state.updateScheduleItem(existing.id, updates) ?? existing };
    }
    return { item: existing };
  }

  const priority =
    typeof woPriority === 'number' && woPriority >= 1 && woPriority <= 5
      ? (Math.round(woPriority) as ScheduleItem['priority'])
      : 3;

  const duration_minutes = getDefaultDurationMinutes(resolved, state);
  const start_at = getStartAtForWorkOrder(resolved, duration_minutes, state);

  const newItem: Omit<ScheduleItem, 'id' | 'created_at' | 'updated_at'> = {
    source_ref_type: 'WORK_ORDER',
    source_ref_id: resolved.id,
    block_type: null,
    block_title: null,
    auto_scheduled: true,
    technician_id: getTechnicianId(resolved),
    start_at,
    duration_minutes,
    priority,
    promised_at,
    parts_ready: false,
    status: 'ON_TRACK',
    notes: null,
  };

  return { item: state.createScheduleItem(newItem) };
};

import type { Repos } from './repos';

export const zustandRepos: Omit<Repos, 'invoices'> = {
  settings: {
    get settings() {
      return useShopStore.getState().settings;
    },
    updateSettings(settings) {
      return useShopStore.getState().updateSettings(settings);
    },
  },
  customers: {
    get customers() {
      return useShopStore.getState().customers;
    },
    addCustomer(customer) {
      return useShopStore.getState().addCustomer(customer);
    },
    updateCustomer(id, customer) {
      return useShopStore.getState().updateCustomer(id, customer);
    },
    deactivateCustomer(id) {
      return useShopStore.getState().deactivateCustomer(id);
    },
    isCustomerOnCreditHold(customerId) {
      return useShopStore.getState().isCustomerOnCreditHold(customerId);
    },
  },
  customerContacts: {
    get customerContacts() {
      return useShopStore.getState().customerContacts;
    },
    getCustomerContacts(customerId) {
      return useShopStore.getState().getCustomerContacts(customerId);
    },
    createCustomerContact(customerId, contact) {
      return useShopStore.getState().createCustomerContact(customerId, contact);
    },
    updateCustomerContact(contactId, patch) {
      return useShopStore.getState().updateCustomerContact(contactId, patch);
    },
    deleteCustomerContact(contactId) {
      return useShopStore.getState().deleteCustomerContact(contactId);
    },
    setPrimaryCustomerContact(customerId, contactId) {
      return useShopStore.getState().setPrimaryCustomerContact(customerId, contactId);
    },
  },
  units: {
    get units() {
      return useShopStore.getState().units;
    },
    addUnit(unit) {
      return useShopStore.getState().addUnit(unit);
    },
    updateUnit(id, unit) {
      return useShopStore.getState().updateUnit(id, unit);
    },
    deactivateUnit(id) {
      return useShopStore.getState().deactivateUnit(id);
    },
    getUnitsByCustomer(customerId) {
      return useShopStore.getState().getUnitsByCustomer(customerId);
    },
    listUnitTypes(options) {
      return listUnitTypes(options);
    },
    createUnitType(name) {
      return createUnitType(name);
    },
    updateUnitType(id, name) {
      return updateUnitType(id, name);
    },
    setUnitTypeActive(id, is_active) {
      return setUnitTypeActive(id, is_active);
    },
    ensureUnitTypesSeeded() {
      return ensureUnitTypesSeeded();
    },
  },
  unitAttachments: {
    list(unitId) {
      return useShopStore.getState().listUnitAttachments(unitId);
    },
    add(unitId, file, options) {
      return useShopStore.getState().addUnitAttachment(unitId, file, options);
    },
    remove(attachmentId) {
      return useShopStore.getState().removeUnitAttachment(attachmentId);
    },
    update(attachmentId, patch) {
      return useShopStore.getState().updateUnitAttachment(attachmentId, patch);
    },
    setPrimary(attachmentId) {
      return useShopStore.getState().setUnitAttachmentPrimary(attachmentId);
    },
    reorder(unitId, orderedIds) {
      return useShopStore.getState().reorderUnitAttachments(unitId, orderedIds);
    },
  },
  vendors: {
    get vendors() {
      return useShopStore.getState().vendors;
    },
    addVendor(vendor) {
      return useShopStore.getState().addVendor(vendor);
    },
    updateVendor(id, vendor) {
      return useShopStore.getState().updateVendor(id, vendor);
    },
    deactivateVendor(id) {
      return useShopStore.getState().deactivateVendor(id);
    },
  },
  categories: {
    get categories() {
      return useShopStore.getState().categories;
    },
    addCategory(category) {
      return useShopStore.getState().addCategory(category);
    },
    updateCategory(id, category) {
      return useShopStore.getState().updateCategory(id, category);
    },
    deactivateCategory(id) {
      return useShopStore.getState().deactivateCategory(id);
    },
  },
  parts: {
    get parts() {
      return useShopStore.getState().parts;
    },
    addPart(part) {
      return useShopStore.getState().addPart(part);
    },
    updatePart(id, part) {
      return useShopStore.getState().updatePart(id, part);
    },
    updatePartWithQohAdjustment(id, part, meta): { success: boolean; warning?: string; error?: string } {
      useShopStore.getState().updatePartWithQohAdjustment(id, part, meta);
      return { success: true };
    },
    deactivatePart(id) {
      return useShopStore.getState().deactivatePart(id);
    },
    receiveInventory(payload) {
      return useShopStore.getState().receiveInventory?.(payload);
    },
    getMovementsForPart(partId) {
      return useShopStore.getState().getMovementsForPart(partId);
    },
    reactivatePart(id) {
      return useShopStore.getState().reactivatePart(id);
    },
  },
  kitComponents: {
    get kitComponents() {
      return useShopStore.getState().kitComponents;
    },
    addKitComponent(component) {
      return useShopStore.getState().addKitComponent(component);
    },
    updateKitComponentQuantity(id, quantity) {
      return useShopStore.getState().updateKitComponentQuantity(id, quantity);
    },
    removeKitComponent(id) {
      return useShopStore.getState().removeKitComponent(id);
    },
  },
  technicians: {
    get technicians() {
      return useShopStore.getState().technicians;
    },
    addTechnician(technician) {
      return useShopStore.getState().addTechnician({ ...technician, is_active: true });
    },
    updateTechnician(id, technician) {
      return useShopStore.getState().updateTechnician(id, technician);
    },
    deactivateTechnician(id) {
      return useShopStore.getState().deactivateTechnician(id);
    },
  },
  timeEntries: {
    get timeEntries() {
      return useShopStore.getState().timeEntries;
    },
    clockIn(technicianId, workOrderId) {
      return useShopStore.getState().clockIn(technicianId, workOrderId);
    },
    clockOut(technicianId) {
      return useShopStore.getState().clockOut(technicianId);
    },
    getActiveTimeEntry(technicianId) {
      return useShopStore.getState().getActiveTimeEntry(technicianId);
    },
    getTimeEntriesByWorkOrder(workOrderId) {
      return useShopStore.getState().getTimeEntriesByWorkOrder(workOrderId);
    },
  },
  scheduling: {
    list() {
      return useShopStore.getState().listScheduleItems();
    },
    getByWorkOrder(workOrderId) {
      return useShopStore.getState().getScheduleItemsByWorkOrder(workOrderId);
    },
    create(item) {
      return useShopStore.getState().createScheduleItem(item);
    },
    update(id, patch) {
      const updated = useShopStore.getState().updateScheduleItem(id, patch);
      if (updated && updated.source_ref_type === 'WORK_ORDER') {
        const technician_id =
          patch.technician_id !== undefined ? patch.technician_id : updated.technician_id;
        if (technician_id !== undefined) {
          const state = useShopStore.getState();
          const workOrder = state.workOrders.find((wo) => wo.id === updated.source_ref_id);
          if (workOrder && (workOrder as any).technician_id !== technician_id && state.updateWorkOrderTechnician) {
            state.updateWorkOrderTechnician(workOrder.id, technician_id);
          }
        }
        if (patch.start_at) {
          const state = useShopStore.getState();
          const workOrder = state.workOrders.find((wo) => wo.id === updated.source_ref_id);
          if (workOrder && workOrder.status !== 'INVOICED' && state.updateWorkOrderPromisedAt) {
            state.updateWorkOrderPromisedAt(workOrder.id, patch.start_at);
          }
        }
      }
      return updated;
    },
    remove(id) {
      return useShopStore.getState().removeScheduleItem(id);
    },
    detectConflicts(item) {
      return useShopStore.getState().detectScheduleConflicts(item);
    },
    ensureScheduleItemForWorkOrder(workOrder) {
      return ensureScheduleItemForWorkOrder(workOrder);
    },
  },
  vendorCostHistory: {
    get vendorCostHistory() {
      return useShopStore.getState().vendorCostHistory;
    },
  },
  salesOrders: {
    get salesOrders() {
      return useShopStore.getState().salesOrders;
    },
    get salesOrderLines() {
      return useShopStore.getState().salesOrderLines;
    },
    get salesOrderChargeLines() {
      return useShopStore.getState().salesOrderChargeLines;
    },
    createSalesOrder(customerId, unitId) {
      return useShopStore.getState().createSalesOrder(customerId, unitId);
    },
    soAddPartLine(orderId, partId, qty) {
      return useShopStore.getState().soAddPartLine(orderId, partId, qty);
    },
    soUpdatePartQty(lineId, newQty) {
      return useShopStore.getState().soUpdatePartQty(lineId, newQty);
    },
    soUpdateLineUnitPrice(lineId, newUnitPrice) {
      return useShopStore.getState().soUpdateLineUnitPrice(lineId, newUnitPrice);
    },
    soRemovePartLine(lineId) {
      return useShopStore.getState().soRemovePartLine(lineId);
    },
    soToggleWarranty(lineId) {
      return useShopStore.getState().soToggleWarranty(lineId);
    },
    soToggleCoreReturned(lineId) {
      return useShopStore.getState().soToggleCoreReturned(lineId);
    },
    soMarkCoreReturned(lineId) {
      return (useShopStore.getState() as any).soMarkCoreReturned?.(lineId) ?? useShopStore.getState().soToggleCoreReturned(lineId);
    },
    soConvertToOpen(orderId) {
      return useShopStore.getState().soConvertToOpen(orderId);
    },
    soInvoice(orderId) {
      return useShopStore.getState().soInvoice(orderId);
    },
    soSetStatus(orderId, status) {
      return useShopStore.getState().soSetStatus(orderId, status);
    },
    updateSalesOrderNotes(orderId, notes) {
      return useShopStore.getState().updateSalesOrderNotes(orderId, notes);
    },
    getSalesOrderLines(orderId) {
      return useShopStore.getState().getSalesOrderLines(orderId);
    },
    getSalesOrderChargeLines(orderId) {
      return useShopStore.getState().getSalesOrderChargeLines(orderId);
    },
    addSalesOrderChargeLine(line) {
      return useShopStore.getState().addSalesOrderChargeLine(line);
    },
    updateSalesOrderChargeLine(id, patch) {
      return useShopStore.getState().updateSalesOrderChargeLine(id, patch);
    },
    removeSalesOrderChargeLine(id) {
      return useShopStore.getState().removeSalesOrderChargeLine(id);
    },
    recalculateSalesOrderTotals(orderId) {
      return useShopStore.getState().recalculateSalesOrderTotals(orderId);
    },
  },
  workOrders: {
    get workOrders() {
      return useShopStore.getState().workOrders;
    },
    get workOrderPartLines() {
      return useShopStore.getState().workOrderPartLines;
    },
    get workOrderLaborLines() {
      return useShopStore.getState().workOrderLaborLines;
    },
    get workOrderChargeLines() {
      return useShopStore.getState().workOrderChargeLines;
    },
    createWorkOrder(customerId, unitId) {
      const wo = useShopStore.getState().createWorkOrder(customerId, unitId);
      ensureScheduleItemForWorkOrder(wo);
      return wo;
    },
    woAddPartLine(orderId, partId, qty, jobLineId) {
      return useShopStore.getState().woAddPartLine(orderId, partId, qty, jobLineId);
    },
    woUpdatePartQty(lineId, newQty) {
      return useShopStore.getState().woUpdatePartQty(lineId, newQty);
    },
    woUpdateLineUnitPrice(lineId, newUnitPrice) {
      return useShopStore.getState().woUpdateLineUnitPrice(lineId, newUnitPrice);
    },
    woRemovePartLine(lineId) {
      return useShopStore.getState().woRemovePartLine(lineId);
    },
    woTogglePartWarranty(lineId) {
      return useShopStore.getState().woTogglePartWarranty(lineId);
    },
    woToggleCoreReturned(lineId) {
      return useShopStore.getState().woToggleCoreReturned(lineId);
    },
    woAddLaborLine(orderId, description, hours, technicianId, jobLineId) {
      return useShopStore.getState().woAddLaborLine(orderId, description, hours, technicianId, jobLineId);
    },
    woUpdateLaborLine(lineId, description, hours) {
      return useShopStore.getState().woUpdateLaborLine(lineId, description, hours);
    },
    woRemoveLaborLine(lineId) {
      return useShopStore.getState().woRemoveLaborLine(lineId);
    },
    woToggleLaborWarranty(lineId) {
      return useShopStore.getState().woToggleLaborWarranty(lineId);
    },
    woUpdateStatus(orderId, status) {
      const result = useShopStore.getState().woUpdateStatus(orderId, status);
      if (result.success) {
        const updated = useShopStore.getState().workOrders.find((o) => o.id === orderId);
        if (updated) ensureScheduleItemForWorkOrder(updated);
      }
      return result;
    },
    woConvertToOpen(orderId) {
      const result = (useShopStore.getState() as any).woConvertToOpen?.(orderId) ?? { success: false, error: 'Not implemented' };
      if (result.success) {
        const updated = useShopStore.getState().workOrders.find((o) => o.id === orderId);
        if (updated) ensureScheduleItemForWorkOrder(updated);
      }
      return result;
    },
    woInvoice(orderId) {
      return useShopStore.getState().woInvoice(orderId);
    },
    getWorkOrderPartLines(orderId) {
      return useShopStore.getState().getWorkOrderPartLines(orderId);
    },
    getWorkOrderLaborLines(orderId) {
      return useShopStore.getState().getWorkOrderLaborLines(orderId);
    },
    getWorkOrderChargeLines(orderId) {
      return useShopStore.getState().getWorkOrderChargeLines(orderId);
    },
    updateWorkOrderNotes(orderId, notes) {
      return useShopStore.getState().updateWorkOrderNotes(orderId, notes);
    },
    addWorkOrderChargeLine(line) {
      return useShopStore.getState().addWorkOrderChargeLine(line);
    },
    updateWorkOrderChargeLine(id, patch) {
      return useShopStore.getState().updateWorkOrderChargeLine(id, patch);
    },
    removeWorkOrderChargeLine(id) {
      return useShopStore.getState().removeWorkOrderChargeLine(id);
    },
    recalculateWorkOrderTotals(orderId) {
      return useShopStore.getState().recalculateWorkOrderTotals(orderId);
    },
  },
  purchaseOrders: {
    get purchaseOrders() {
      return useShopStore.getState().purchaseOrders;
    },
    get purchaseOrderLines() {
      return useShopStore.getState().purchaseOrderLines;
    },
    get receivingRecords() {
      return useShopStore.getState().receivingRecords;
    },
    createPurchaseOrder(vendorId) {
      return useShopStore.getState().createPurchaseOrder(vendorId);
    },
    poAddLine(orderId, partId, quantity) {
      return useShopStore.getState().poAddLine(orderId, partId, quantity);
    },
    poUpdateLineQty(lineId, newQty) {
      return useShopStore.getState().poUpdateLineQty(lineId, newQty);
    },
    poRemoveLine(lineId) {
      return useShopStore.getState().poRemoveLine(lineId);
    },
    poReceive(lineId, quantity) {
      return useShopStore.getState().poReceive(lineId, quantity);
    },
    poClose(orderId) {
      return useShopStore.getState().poClose(orderId);
    },
    updatePurchaseOrderNotes(orderId, notes) {
      return useShopStore.getState().updatePurchaseOrderNotes(orderId, notes);
    },
    updatePurchaseOrderLinks(orderId, links) {
      return useShopStore.getState().updatePurchaseOrderLinks(orderId, links);
    },
    getPurchaseOrderLines(orderId) {
      return useShopStore.getState().getPurchaseOrderLines(orderId);
    },
    getReceivingRecords(lineId) {
      return useShopStore.getState().getReceivingRecords(lineId);
    },
  },
  returns: {
    get returns() {
      return useShopStore.getState().returns;
    },
    get returnLines() {
      return useShopStore.getState().returnLines;
    },
    createReturn(payload) {
      return useShopStore.getState().createReturn(payload);
    },
    updateReturn(id, patch) {
      return useShopStore.getState().updateReturn(id, patch);
    },
    setReturnStatus(id, status) {
      return useShopStore.getState().setReturnStatus(id, status);
    },
    addReturnLine(returnId, payload) {
      return useShopStore.getState().addReturnLine(returnId, payload);
    },
    updateReturnLine(lineId, patch) {
      return useShopStore.getState().updateReturnLine(lineId, patch);
    },
    removeReturnLine(lineId) {
      return useShopStore.getState().removeReturnLine(lineId);
    },
    getReturnLines(returnId) {
      return useShopStore.getState().getReturnLines(returnId);
    },
    getReturnsByPurchaseOrder(poId) {
      return useShopStore.getState().getReturnsByPurchaseOrder(poId);
    },
  },
  warranty: {
    get warrantyPolicies() {
      return useShopStore.getState().warrantyPolicies;
    },
    get warrantyClaims() {
      return useShopStore.getState().warrantyClaims;
    },
    get warrantyClaimLines() {
      return useShopStore.getState().warrantyClaimLines;
    },
    upsertWarrantyPolicy(vendorId, patch) {
      return useShopStore.getState().upsertWarrantyPolicy(vendorId, patch);
    },
    createWarrantyClaim(payload) {
      return useShopStore.getState().createWarrantyClaim(payload);
    },
    updateWarrantyClaim(id, patch) {
      return useShopStore.getState().updateWarrantyClaim(id, patch);
    },
    setWarrantyClaimStatus(id, status) {
      return useShopStore.getState().setWarrantyClaimStatus(id, status);
    },
    addWarrantyClaimLine(claimId, payload) {
      return useShopStore.getState().addWarrantyClaimLine(claimId, payload);
    },
    updateWarrantyClaimLine(lineId, patch) {
      return useShopStore.getState().updateWarrantyClaimLine(lineId, patch);
    },
    removeWarrantyClaimLine(lineId) {
      return useShopStore.getState().removeWarrantyClaimLine(lineId);
    },
    getWarrantyPolicyByVendor(vendorId) {
      return useShopStore.getState().getWarrantyPolicyByVendor(vendorId);
    },
    getClaimsByVendor(vendorId) {
      return useShopStore.getState().getClaimsByVendor(vendorId);
    },
    getClaimsByWorkOrder(workOrderId) {
      return useShopStore.getState().getClaimsByWorkOrder(workOrderId);
    },
    getWarrantyClaimLines(claimId) {
      return useShopStore.getState().getWarrantyClaimLines(claimId);
    },
  },
  cycleCounts: {
    get cycleCountSessions() {
      return useShopStore.getState().cycleCountSessions;
    },
    get cycleCountLines() {
      return useShopStore.getState().cycleCountLines;
    },
    createCycleCountSession(session) {
      return useShopStore.getState().createCycleCountSession(session);
    },
    updateCycleCountSession(id, session) {
      return useShopStore.getState().updateCycleCountSession(id, session);
    },
    cancelCycleCountSession(id) {
      return useShopStore.getState().cancelCycleCountSession(id);
    },
    addCycleCountLine(sessionId, partId) {
      return useShopStore.getState().addCycleCountLine(sessionId, partId);
    },
    updateCycleCountLine(id, updates) {
      return useShopStore.getState().updateCycleCountLine(id, updates);
    },
    postCycleCountSession(id, posted_by) {
      return useShopStore.getState().postCycleCountSession(id, posted_by);
    },
    getCycleCountLines(sessionId) {
      return useShopStore.getState().getCycleCountLines(sessionId);
    },
  },
  fabrication: {
    get fabJobs() {
      return useShopStore.getState().fabJobs;
    },
    get fabJobLines() {
      return useShopStore.getState().fabJobLines;
    },
    createForWorkOrder(workOrderId) {
      return useShopStore.getState().createFabJobForWorkOrder(workOrderId);
    },
    getByWorkOrder(workOrderId) {
      return useShopStore.getState().getFabJobByWorkOrder(workOrderId);
    },
    updateJob(id, patch) {
      return useShopStore.getState().updateFabJob(id, patch);
    },
    upsertLine(jobId, line) {
      return useShopStore.getState().upsertFabJobLine(jobId, line);
    },
    deleteLine(lineId) {
      return useShopStore.getState().deleteFabJobLine(lineId);
    },
    recalculate(fabJobId, settingsOverride) {
      return useShopStore.getState().recalculateFabJob(fabJobId, settingsOverride);
    },
    postToWorkOrder(fabJobId) {
      return useShopStore.getState().postFabJobToWorkOrder(fabJobId);
    },
  },
  plasma: {
    get plasmaJobs() {
      return useShopStore.getState().plasmaJobs;
    },
    get plasmaJobLines() {
      return useShopStore.getState().plasmaJobLines;
    },
    get plasmaAttachments() {
      return useShopStore.getState().plasmaAttachments;
    },
    get plasmaTemplates() {
      return useShopStore.getState().plasmaTemplates;
    },
    get plasmaTemplateLines() {
      return useShopStore.getState().plasmaTemplateLines;
    },
    createForWorkOrder(workOrderId) {
      return useShopStore.getState().createPlasmaJobForWorkOrder(workOrderId);
    },
    getByWorkOrder(workOrderId) {
      return useShopStore.getState().getPlasmaJobByWorkOrder(workOrderId);
    },
    createStandalone(payload) {
      return useShopStore.getState().createStandalonePlasmaJob(payload);
    },
    get(plasmaJobId) {
      return useShopStore.getState().getPlasmaJob(plasmaJobId);
    },
    getPrintView(plasmaJobId) {
      return useShopStore.getState().getPlasmaPrintView(plasmaJobId);
    },
    listStandalone() {
      return useShopStore.getState().listStandalonePlasmaJobs();
    },
    linkToSalesOrder(plasmaJobId, salesOrderId) {
      return useShopStore.getState().linkPlasmaJobToSalesOrder(plasmaJobId, salesOrderId);
    },
    updateJob(id, patch) {
      return useShopStore.getState().updatePlasmaJob(id, patch);
    },
    upsertLine(jobId, line) {
      return useShopStore.getState().upsertPlasmaJobLine(jobId, line);
    },
    deleteLine(lineId) {
      return useShopStore.getState().deletePlasmaJobLine(lineId);
    },
    recalc(jobId, settingsOverride) {
      return useShopStore.getState().recalculatePlasmaJob(jobId, settingsOverride);
    },
    postToWorkOrder(plasmaJobId) {
      return useShopStore.getState().postPlasmaJobToWorkOrder(plasmaJobId);
    },
    postToSalesOrder(plasmaJobId) {
      return useShopStore.getState().postPlasmaJobToSalesOrder(plasmaJobId);
    },
    attachments: {
      list(plasmaJobId) {
        return useShopStore.getState().listPlasmaAttachments(plasmaJobId);
      },
      add(plasmaJobId, file, options) {
        return useShopStore.getState().addPlasmaAttachment(plasmaJobId, file, options);
      },
      remove(attachmentId) {
        return useShopStore.getState().removePlasmaAttachment(attachmentId);
      },
      update(attachmentId, patch) {
        return useShopStore.getState().updatePlasmaAttachment(attachmentId, patch);
      },
    },
    remnants: {
      list() {
        return useShopStore.getState().listRemnants();
      },
      create(remnant) {
        return useShopStore.getState().createRemnant(remnant);
      },
      update(id, patch) {
        return useShopStore.getState().updateRemnant(id, patch);
      },
      remove(id) {
        return useShopStore.getState().removeRemnant(id);
      },
      consume(id) {
        return useShopStore.getState().consumeRemnant(id);
      },
    },
    templates: {
      list() {
        return useShopStore.getState().listPlasmaTemplates();
      },
      get(templateId) {
        return useShopStore.getState().getPlasmaTemplate(templateId);
      },
      create(payload) {
        return useShopStore.getState().createPlasmaTemplate(payload);
      },
      update(templateId, patch) {
        return useShopStore.getState().updatePlasmaTemplate(templateId, patch);
      },
      remove(templateId) {
        return useShopStore.getState().removePlasmaTemplate(templateId);
      },
      addLine(templateId, line) {
        return useShopStore.getState().addPlasmaTemplateLine(templateId, line);
      },
      updateLine(lineId, patch) {
        return useShopStore.getState().updatePlasmaTemplateLine(lineId, patch);
      },
      removeLine(lineId) {
        return useShopStore.getState().removePlasmaTemplateLine(lineId);
      },
      applyToJob(templateId, plasmaJobId) {
        return useShopStore.getState().applyPlasmaTemplateToJob(templateId, plasmaJobId);
      },
    },
  },
};
