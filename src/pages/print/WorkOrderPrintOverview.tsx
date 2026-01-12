import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useRepos } from '@/repos';
import type { WorkOrder, WorkOrderPartLine, WorkOrderLaborLine, WorkOrderChargeLine, Customer, Unit } from '@/types';

const formatMoney = (value: number | string | null | undefined) => {
  const numeric = typeof value === 'number' ? value : value != null ? Number(value) : 0;
  return `$${numeric.toFixed(2)}`;
};

const buildUnitLabel = (unit?: Unit | null) => {
  if (!unit) return '-';
  const parts = [unit.year, unit.make, unit.model].filter(Boolean).join(' ');
  return unit.unit_name || parts || unit.vin || '-';
};

const sumParts = (lines: WorkOrderPartLine[]) =>
  lines.reduce((sum, line) => sum + (line.is_warranty ? 0 : line.line_total), 0);
const sumLabor = (lines: WorkOrderLaborLine[]) =>
  lines.reduce((sum, line) => sum + (line.is_warranty ? 0 : line.line_total), 0);
const sumCharges = (lines: WorkOrderChargeLine[]) => lines.reduce((sum, line) => sum + line.total_price, 0);

export default function WorkOrderPrintOverview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const repos = useRepos();

  const workOrderRepo = repos.workOrders;
  const workOrder = useMemo(
    () => workOrderRepo.workOrders.find((wo) => wo.id === id),
    [id, workOrderRepo.workOrders]
  );

  const customer: Customer | undefined = useMemo(
    () => repos.customers.customers.find((c) => c.id === workOrder?.customer_id),
    [repos.customers.customers, workOrder?.customer_id]
  );
  const unit: Unit | undefined = useMemo(
    () => repos.units.units.find((u) => u.id === workOrder?.unit_id),
    [repos.units.units, workOrder?.unit_id]
  );

  const partLines = useMemo(
    () => (workOrder && workOrderRepo.getWorkOrderPartLines ? workOrderRepo.getWorkOrderPartLines(workOrder.id) : []),
    [workOrder, workOrderRepo]
  );
  const laborLines = useMemo(
    () => (workOrder && workOrderRepo.getWorkOrderLaborLines ? workOrderRepo.getWorkOrderLaborLines(workOrder.id) : []),
    [workOrder, workOrderRepo]
  );
  const chargeLines = useMemo(
    () =>
      workOrder && workOrderRepo.getWorkOrderChargeLines ? workOrderRepo.getWorkOrderChargeLines(workOrder.id) : [],
    [workOrder, workOrderRepo]
  );

  const partsTotal = useMemo(() => sumParts(partLines), [partLines]);
  const laborTotal = useMemo(() => sumLabor(laborLines), [laborLines]);
  const chargeTotal = useMemo(() => sumCharges(chargeLines), [chargeLines]);
  const coreCharges = Number((workOrder as any)?.core_charges_total ?? 0);
  const subtotal = partsTotal + laborTotal + chargeTotal + coreCharges;
  const taxRate = Number(workOrder?.tax_rate ?? 0);
  const taxAmount = Number(workOrder?.tax_amount ?? subtotal * (taxRate / 100));
  const total = Number(workOrder?.total ?? subtotal + taxAmount);

  useEffect(() => {
    if (!workOrder) return;
    const handleAfterPrint = () => {
      if (window.history.length > 1) {
        navigate(-1);
      } else if (id) {
        navigate(`/work-orders/${id}`);
      }
    };

    window.addEventListener('afterprint', handleAfterPrint);
    const timer = setTimeout(() => window.print(), 120);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [id, navigate, workOrder]);

  const handleClose = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    if (id) {
      navigate(`/work-orders/${id}`);
      return;
    }
    window.close();
  };

  const shopName = repos.settings?.settings?.shop_name || 'ShopFlow';
  const createdDate = workOrder ? new Date(workOrder.created_at).toLocaleDateString() : '';

  if (!workOrder) {
    return (
      <div className="print-document bg-white text-black min-h-screen p-8 space-y-4">
        <div className="text-xl font-semibold">Work order not found</div>
        <div className="no-print">
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="print-document bg-white text-black min-h-screen p-8 space-y-6">
      <div className="flex justify-between items-start border-b border-gray-300 pb-4">
        <div>
          <h1 className="text-2xl font-bold">{shopName}</h1>
          <p className="text-sm text-gray-700">Work Order Overview</p>
        </div>
        <div className="text-right text-sm text-gray-700">
          <div className="text-lg font-semibold">WO {workOrder?.order_number || id}</div>
          <div>{createdDate}</div>
        </div>
      </div>

      <div className="flex justify-between items-start gap-8">
        <div className="space-y-1 text-sm">
          <div className="font-semibold text-gray-800">Customer</div>
          <div>{customer?.company_name || '-'}</div>
          {customer?.contact_name && <div className="text-gray-700">{customer.contact_name}</div>}
          {customer?.phone && <div className="text-gray-700">{customer.phone}</div>}
        </div>
        <div className="space-y-1 text-sm text-right">
          <div className="font-semibold text-gray-800">Unit</div>
          <div>{buildUnitLabel(unit)}</div>
          {unit?.vin && <div className="font-mono text-gray-700">VIN: {unit.vin}</div>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-gray-600">Status</div>
          <div className="font-semibold text-gray-900">{workOrder?.status || '-'}</div>
        </div>
        <div>
          <div className="text-gray-600">Parts</div>
          <div className="font-semibold text-gray-900">{formatMoney(partsTotal)}</div>
        </div>
        <div>
          <div className="text-gray-600">Labor</div>
          <div className="font-semibold text-gray-900">{formatMoney(laborTotal)}</div>
        </div>
        <div>
          <div className="text-gray-600">Other</div>
          <div className="font-semibold text-gray-900">{formatMoney(chargeTotal + coreCharges)}</div>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-800 mb-2">Parts</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-1">Part</th>
                <th className="text-left py-1">Description</th>
                <th className="text-right py-1">Qty</th>
                <th className="text-right py-1">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {partLines.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-gray-500 py-2 text-center">
                    No parts
                  </td>
                </tr>
              ) : (
                partLines.map((line) => (
                  <tr key={line.id} className="border-b border-gray-200">
                    <td className="py-1 font-mono text-xs">{line.part_id}</td>
                    <td className="py-1">{line.description || 'Part'}</td>
                    <td className="py-1 text-right">{line.quantity}</td>
                    <td className="py-1 text-right">{formatMoney(line.line_total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-gray-800 mb-2">Labor / Time</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-1">Description</th>
                <th className="text-right py-1">Hours</th>
                <th className="text-right py-1">Rate</th>
                <th className="text-right py-1">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {laborLines.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-gray-500 py-2 text-center">
                    No labor
                  </td>
                </tr>
              ) : (
                laborLines.map((line) => (
                  <tr key={line.id} className="border-b border-gray-200">
                    <td className="py-1">{line.description}</td>
                    <td className="py-1 text-right">{line.hours}</td>
                    <td className="py-1 text-right">{formatMoney(line.rate)}</td>
                    <td className="py-1 text-right">{formatMoney(line.line_total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {chargeLines.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-800 mb-2">Charges</h2>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="text-left py-1">Description</th>
                  <th className="text-right py-1">Qty</th>
                  <th className="text-right py-1">Unit Price</th>
                  <th className="text-right py-1">Total</th>
                </tr>
              </thead>
              <tbody>
                {chargeLines.map((line) => (
                  <tr key={line.id} className="border-b border-gray-200">
                    <td className="py-1">{line.description}</td>
                    <td className="py-1 text-right">{line.qty}</td>
                    <td className="py-1 text-right">{formatMoney(line.unit_price)}</td>
                    <td className="py-1 text-right">{formatMoney(line.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <div className="w-64 text-sm space-y-1">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-semibold">{formatMoney(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Tax ({taxRate}%)</span>
            <span className="font-semibold">{formatMoney(taxAmount)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-400 pt-2 text-base font-bold">
            <span>Total</span>
            <span>{formatMoney(total)}</span>
          </div>
        </div>
      </div>

      {workOrder?.notes && (
        <div className="text-sm text-gray-900">
          <h3 className="font-semibold text-gray-800 mb-1">Notes</h3>
          <p className="whitespace-pre-wrap">{workOrder.notes}</p>
        </div>
      )}

      <div className="no-print">
        <Button variant="outline" onClick={handleClose}>
          Back to Work Order
        </Button>
      </div>
    </div>
  );
}
