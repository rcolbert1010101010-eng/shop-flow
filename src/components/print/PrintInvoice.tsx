import { InvoicePrintLayout } from '@/pages/print/components/InvoicePrintLayout';
import type {
  SalesOrder,
  WorkOrder,
  SalesOrderLine,
  WorkOrderPartLine,
  WorkOrderLaborLine,
  Customer,
  Unit,
  Part,
} from '@/types';

interface PrintSalesOrderProps {
  order: SalesOrder;
  lines: SalesOrderLine[];
  customer: Customer | undefined;
  unit: Unit | undefined;
  parts: Part[];
  shopName: string;
}

export function PrintSalesOrder({ order, lines, customer, unit, parts, shopName }: PrintSalesOrderProps) {
  const lineItems = lines.map((line) => {
    const part = parts.find((p) => p.id === line.part_id);
    return {
      description: part?.description || 'Item',
      quantity: line.quantity,
      uom: part?.uom ?? null,
      rate: line.unit_price,
      amount: line.line_total,
    };
  });

  return (
    <InvoicePrintLayout
      title="INVOICE"
      shopName={shopName}
      meta={{
        invoiceNumber: order.order_number,
        issueDate: order.created_at,
        dueDate: order.invoiced_at,
      }}
      billTo={{
        name: customer?.company_name ?? null,
        contact: customer?.contact_name ?? null,
        address: customer?.address ?? null,
        phone: customer?.phone ?? null,
      }}
      reference={{
        sourceType: 'Sales Order',
        sourceNumber: order.order_number,
        unitLabel: unit?.unit_name ?? null,
        vin: unit?.vin ?? null,
      }}
      lineItems={lineItems}
      totals={{
        subtotal: order.subtotal,
        taxLabel: `Tax (${order.tax_rate}%)`,
        tax: order.tax_amount,
        total: order.total,
        paid: 0,
        balanceDue: order.total,
      }}
      notes={order.notes}
      footer="Thank you for your business!"
    />
  );
}

interface PrintWorkOrderProps {
  order: WorkOrder;
  partLines: WorkOrderPartLine[];
  laborLines: WorkOrderLaborLine[];
  customer: Customer | undefined;
  unit: Unit | undefined;
  parts: Part[];
  shopName: string;
}

export function PrintWorkOrder({ order, partLines, laborLines, customer, unit, parts, shopName }: PrintWorkOrderProps) {
  const partItems = partLines.map((line) => {
    const part = parts.find((p) => p.id === line.part_id);
    return {
      description: line.description || part?.description || 'Part',
      quantity: line.quantity,
      uom: part?.uom ?? null,
      rate: line.unit_price,
      amount: line.line_total,
    };
  });

  const laborItems = laborLines.map((line) => ({
    description: line.description || 'Item',
    quantity: line.hours,
    uom: 'HRS',
    rate: line.rate,
    amount: line.line_total,
  }));

  const lineItems = [...partItems, ...laborItems];

  return (
    <InvoicePrintLayout
      title="INVOICE"
      shopName={shopName}
      meta={{
        invoiceNumber: order.order_number,
        issueDate: order.created_at,
        dueDate: order.invoiced_at,
      }}
      billTo={{
        name: customer?.company_name ?? null,
        contact: customer?.contact_name ?? null,
        address: customer?.address ?? null,
        phone: customer?.phone ?? null,
      }}
      reference={{
        sourceType: 'Work Order',
        sourceNumber: order.order_number,
        unitLabel: unit?.unit_name ?? null,
        vin: unit?.vin ?? null,
      }}
      lineItems={lineItems}
      totals={{
        subtotal: order.subtotal,
        taxLabel: `Tax (${order.tax_rate}%)`,
        tax: order.tax_amount,
        total: order.total,
        paid: 0,
        balanceDue: order.total,
      }}
      notes={order.notes}
      footer="Thank you for your business!"
    />
  );
}

// Pick list outputs retained for existing usage
interface PickListProps {
  order: WorkOrder;
  partLines: WorkOrderPartLine[];
  laborLines: WorkOrderLaborLine[];
  customer: Customer | undefined;
  unit: Unit | undefined;
  parts: Part[];
  shopName: string;
}

export function PrintWorkOrderPickList({ order, partLines, customer, unit, parts, shopName }: PickListProps) {
  const toNumber = (value: number | string | null | undefined) => {
    const numeric = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const pickListItems = partLines
    .map((line) => {
      const part = parts.find((p) => p.id === line.part_id);
      return {
        id: line.id,
        quantity: line.quantity,
        partNumber: part?.part_number || '-',
        description: part?.description || '-',
        bin: part?.bin_location || '—',
      };
    })
    .sort((a, b) => {
      const binA = a.bin === '—' ? 'ZZZ' : a.bin;
      const binB = b.bin === '—' ? 'ZZZ' : b.bin;
      if (binA.localeCompare(binB) !== 0) return binA.localeCompare(binB);
      if (a.partNumber.localeCompare(b.partNumber) !== 0) return a.partNumber.localeCompare(b.partNumber);
      return a.description.localeCompare(b.description);
    });

  return (
    <div className="print-invoice hidden print:block bg-white text-black p-8 min-h-screen">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{shopName}</h1>
          <p className="text-gray-600 mt-1">Pick List</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-mono font-bold">{order.order_number}</p>
          <p className="text-gray-600">{new Date(order.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-6 text-sm">
        <div>
          <div className="text-xs font-semibold uppercase text-gray-600">Customer</div>
          <div className="font-medium text-gray-900">{customer?.company_name || '-'}</div>
          {customer?.contact_name && <div className="text-gray-700">{customer.contact_name}</div>}
          {customer?.phone && <div className="text-gray-700">{customer.phone}</div>}
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-gray-600">Unit</div>
          <div className="font-medium text-gray-900">{unit?.unit_name || '—'}</div>
          {unit?.vin && <div className="text-xs text-gray-700 font-mono">VIN: {unit.vin}</div>}
        </div>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-300">
            <th className="text-right py-2 px-2 w-16">Qty</th>
            <th className="text-left py-2 px-2">Part #</th>
            <th className="text-left py-2 px-2">Description</th>
            <th className="text-left py-2 px-2">Bin</th>
          </tr>
        </thead>
        <tbody>
          {pickListItems.map((item, idx) => (
            <tr key={item.id} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
              <td className="py-2 px-2 text-right font-medium">{toNumber(item.quantity)}</td>
              <td className="py-2 px-2 font-mono">{item.partNumber}</td>
              <td className="py-2 px-2">{item.description}</td>
              <td className="py-2 px-2">{item.bin}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PrintSalesOrderPickList({ order, lines, customer, unit, parts, shopName }: PrintSalesOrderProps) {
  const toNumber = (value: number | string | null | undefined) => {
    const numeric = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
    return Number.isFinite(numeric) ? numeric : 0;
  };

  const pickListItems = lines
    .map((line) => {
      const part = parts.find((p) => p.id === line.part_id);
      return {
        id: line.id,
        quantity: line.quantity,
        partNumber: part?.part_number || '-',
        description: part?.description || '-',
        bin: part?.bin_location || '—',
      };
    })
    .sort((a, b) => {
      const binA = a.bin === '—' ? 'ZZZ' : a.bin;
      const binB = b.bin === '—' ? 'ZZZ' : b.bin;
      if (binA.localeCompare(binB) !== 0) return binA.localeCompare(binB);
      if (a.partNumber.localeCompare(b.partNumber) !== 0) return a.partNumber.localeCompare(b.partNumber);
      return a.description.localeCompare(b.description);
    });

  return (
    <div className="print-invoice hidden print:block bg-white text-black p-8 min-h-screen">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{shopName}</h1>
          <p className="text-gray-600 mt-1">Pick List</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-mono font-bold">{order.order_number}</p>
          <p className="text-gray-600">{new Date(order.created_at).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-6 text-sm">
        <div>
          <div className="text-xs font-semibold uppercase text-gray-600">Customer</div>
          <div className="font-medium text-gray-900">{customer?.company_name || '-'}</div>
          {customer?.contact_name && <div className="text-gray-700">{customer.contact_name}</div>}
          {customer?.phone && <div className="text-gray-700">{customer.phone}</div>}
        </div>
        <div>
          <div className="text-xs font-semibold uppercase text-gray-600">Unit</div>
          <div className="font-medium text-gray-900">{unit?.unit_name || '—'}</div>
          {unit?.vin && <div className="text-xs text-gray-700 font-mono">VIN: {unit.vin}</div>}
        </div>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-300">
            <th className="text-right py-2 px-2 w-16">Qty</th>
            <th className="text-left py-2 px-2">Part #</th>
            <th className="text-left py-2 px-2">Description</th>
            <th className="text-left py-2 px-2">Bin</th>
          </tr>
        </thead>
        <tbody>
          {pickListItems.map((item, idx) => (
            <tr key={item.id} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
              <td className="py-2 px-2 text-right font-medium">{toNumber(item.quantity)}</td>
              <td className="py-2 px-2 font-mono">{item.partNumber}</td>
              <td className="py-2 px-2">{item.description}</td>
              <td className="py-2 px-2">{item.bin}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
