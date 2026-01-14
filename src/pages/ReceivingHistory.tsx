import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { useShopStore } from '@/stores/shopStore';
import { useRepos } from '@/repos';
import { ModuleHelpButton } from '@/components/help/ModuleHelpButton';

export default function ReceivingHistory() {
  const receipts = useShopStore((s) => s.receivingReceipts);
  const parts = useRepos().parts.parts;
  const vendors = useRepos().vendors.vendors;
  const hasAnyReceipts = receipts.length > 0;

  const sorted = useMemo(
    () => [...receipts].sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime()),
    [receipts]
  );

  return (
    <div className="page-container space-y-4">
      <PageHeader
        title="Receiving History"
        subtitle="Audit of received inventory"
        backTo="/inventory"
        actions={<ModuleHelpButton moduleKey="receiving_history" context={{ isEmpty: !hasAnyReceipts }} />}
      />

      <Card className="p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-2">Date/Time</th>
                <th className="py-2">Vendor</th>
                <th className="py-2">Lines</th>
                <th className="py-2">Reference</th>
                <th className="py-2">By</th>
                <th className="py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td className="py-4 text-center text-muted-foreground" colSpan={6}>
                    No receiving history yet.
                  </td>
                </tr>
              ) : (
                sorted.map((receipt) => {
                  const vendor = vendors.find((v) => v.id === receipt.vendor_id);
                  const lineParts = receipt.lines
                    .map((l) => parts.find((p) => p.id === l.part_id)?.part_number || l.part_id)
                    .join(', ');
                  const totalQty = receipt.lines.reduce((sum, l) => sum + (l.quantity ?? 0), 0);
                  return (
                    <tr key={receipt.id} className="border-t border-border/60">
                      <td className="py-2">{new Date(receipt.received_at).toLocaleString()}</td>
                      <td className="py-2">{vendor?.vendor_name || '—'}</td>
                      <td className="py-2">
                        <Link to={`/receiving-history/${receipt.id}`} className="text-primary hover:underline">
                          {receipt.lines.length} line(s)
                        </Link>
                        <div className="text-xs text-muted-foreground break-words">
                          Qty: {totalQty} • {lineParts}
                        </div>
                      </td>
                      <td className="py-2">{receipt.reference || '—'}</td>
                      <td className="py-2">{receipt.received_by || '—'}</td>
                      <td className="py-2">{receipt.source_type === 'PURCHASE_ORDER' ? 'Purchase Order' : 'Manual'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
