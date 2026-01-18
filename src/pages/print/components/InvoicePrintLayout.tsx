import type { ReactNode } from 'react';

type InvoiceMeta = {
  invoiceNumber?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  terms?: string | null;
};

type PartyInfo = {
  name?: string | null;
  contact?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
};

type ReferenceInfo = {
  sourceType?: string | null;
  sourceNumber?: string | null;
  unitLabel?: string | null;
  vin?: string | null;
  plate?: string | null;
};

type LineItem = {
  description: string;
  quantity: number | string;
  uom?: string | null;
  rate?: number | string | null;
  amount: number | string | null;
};

type Totals = {
  subtotal: number | string | null;
  taxLabel?: string;
  tax: number | string | null;
  total: number | string | null;
  paid?: number | string | null;
  balanceDue?: number | string | null;
};

type PaymentEntry = {
  date?: string | null;
  method?: string | null;
  amount?: number | string | null;
};

interface InvoicePrintLayoutProps {
  title?: string;
  shopName: string;
  shopAddress?: string | null;
  shopPhone?: string | null;
  meta?: InvoiceMeta;
  billTo?: PartyInfo;
  reference?: ReferenceInfo;
  lineItems: LineItem[];
  totals: Totals;
  notes?: string | null;
  payments?: PaymentEntry[];
  footer?: ReactNode;
}

const formatMoney = (value: number | string | null | undefined) => {
  const numeric = typeof value === 'number' ? value : value != null ? Number(value) : 0;
  return `$${numeric.toFixed(2)}`;
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '';

export function InvoicePrintLayout({
  title = 'INVOICE',
  shopName,
  shopAddress,
  shopPhone,
  meta,
  billTo,
  reference,
  lineItems,
  totals,
  notes,
  payments,
  footer,
}: InvoicePrintLayoutProps) {
  return (
    <div className="print-invoice hidden print:block bg-white text-black p-8 min-h-screen space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start border-b border-gray-300 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{shopName}</h1>
          {shopAddress ? <p className="text-sm text-gray-700">{shopAddress}</p> : null}
          {shopPhone ? <p className="text-sm text-gray-700">{shopPhone}</p> : null}
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold uppercase tracking-wide text-gray-800">{title}</div>
          {meta?.invoiceNumber ? <div className="text-sm text-gray-600">Invoice #: {meta.invoiceNumber}</div> : null}
          {meta?.issueDate ? <div className="text-sm text-gray-600">Issue: {formatDate(meta.issueDate)}</div> : null}
          {meta?.dueDate ? <div className="text-sm text-gray-600">Due: {formatDate(meta.dueDate)}</div> : null}
          {meta?.terms ? <div className="text-sm text-gray-600">Terms: {meta.terms}</div> : null}
        </div>
      </div>

      {/* Parties & Reference */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-2">
          <div className="text-xs font-semibold text-gray-600 uppercase">Bill To</div>
          <div className="text-sm text-gray-900 font-medium">{billTo?.name || '—'}</div>
          {billTo?.contact && <div className="text-sm text-gray-700">{billTo.contact}</div>}
          {billTo?.address && <div className="text-sm text-gray-700 whitespace-pre-wrap">{billTo.address}</div>}
          {billTo?.phone && <div className="text-sm text-gray-700">Phone: {billTo.phone}</div>}
          {billTo?.email && <div className="text-sm text-gray-700">Email: {billTo.email}</div>}
        </div>
        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-semibold text-gray-600 uppercase">Reference</div>
            <div className="text-sm text-gray-900">
              {reference?.sourceType || ''} {reference?.sourceNumber || ''}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-600 uppercase">Unit</div>
            <div className="text-sm text-gray-900">{reference?.unitLabel || '—'}</div>
            {reference?.vin ? <div className="text-xs text-gray-700">VIN: {reference.vin}</div> : null}
            {reference?.plate ? <div className="text-xs text-gray-700">Plate: {reference.plate}</div> : null}
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="text-left py-2 px-2">Description</th>
              <th className="text-right py-2 px-2">Qty</th>
              <th className="text-left py-2 px-2">UOM</th>
              <th className="text-right py-2 px-2">Rate</th>
              <th className="text-right py-2 px-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-3 text-center text-gray-500">
                  No items
                </td>
              </tr>
            ) : (
              lineItems.map((item, idx) => (
                <tr key={`${item.description}-${idx}`} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                  <td className="py-2 px-2 align-top">{item.description}</td>
                  <td className="py-2 px-2 text-right align-top">{item.quantity}</td>
                  <td className="py-2 px-2 align-top">{item.uom || '—'}</td>
                  <td className="py-2 px-2 text-right align-top">{item.rate != null ? formatMoney(item.rate) : '—'}</td>
                  <td className="py-2 px-2 text-right align-top">{formatMoney(item.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-full md:w-80 space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-gray-700">Subtotal</span>
            <span className="font-medium">{formatMoney(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-700">{totals.taxLabel || 'Tax'}</span>
            <span className="font-medium">{formatMoney(totals.tax)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold border-t border-gray-300 pt-2">
            <span>Total</span>
            <span>{formatMoney(totals.total)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-700">Paid</span>
            <span className="font-medium">{formatMoney(totals.paid ?? 0)}</span>
          </div>
          <div className="flex justify-between text-base font-semibold">
            <span>Balance Due</span>
            <span>{formatMoney(totals.balanceDue ?? totals.total)}</span>
          </div>
        </div>
      </div>

      {/* Optional sections */}
      {notes ? (
        <div className="pt-2 border-t border-gray-200">
          <div className="text-sm font-semibold text-gray-700 mb-1">Notes / Terms</div>
          <div className="text-sm text-gray-800 whitespace-pre-wrap">{notes}</div>
        </div>
      ) : null}

      {payments && payments.length > 0 ? (
        <div className="pt-2 border-t border-gray-200">
          <div className="text-sm font-semibold text-gray-700 mb-2">Payments</div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="text-left py-1 px-2">Date</th>
                <th className="text-left py-1 px-2">Method</th>
                <th className="text-right py-1 px-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, idx) => (
                <tr key={`${p.date || idx}-${idx}`} className={idx % 2 === 0 ? 'bg-gray-50' : ''}>
                  <td className="py-1 px-2">{formatDate(p.date)}</td>
                  <td className="py-1 px-2">{p.method || '—'}</td>
                  <td className="py-1 px-2 text-right">{formatMoney(p.amount ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {footer ? <div className="pt-6 text-center text-gray-600 text-sm">{footer}</div> : null}
    </div>
  );
}
