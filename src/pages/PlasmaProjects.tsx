import { useMemo, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useRepos } from '@/repos';
import { ModuleHelpButton } from '@/components/help/ModuleHelpButton';
import { useShopStore } from '@/stores/shopStore';

export default function PlasmaProjects() {
  const repos = useRepos();
  const plasmaRepo = repos.plasma;
  const { salesOrders } = repos.salesOrders;
  const navigate = useNavigate();
  const plasmaJobs = useShopStore((state) => state.plasmaJobs);

  useEffect(() => {
    plasmaRepo.listStandalone();
  }, [plasmaRepo]);

  const projects = useMemo(
    () =>
      plasmaJobs
        .filter((job) => job.source_type === 'STANDALONE')
        .slice()
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [plasmaJobs]
  );

  const salesOrderById = useMemo(() => {
    return salesOrders.reduce<Record<string, typeof salesOrders[number]>>((acc, so) => {
      acc[so.id] = so;
      return acc;
    }, {});
  }, [salesOrders]);

  const handleCreate = () => {
    const job = plasmaRepo.createStandalone();
    navigate(`/plasma/${job.id}`);
  };

  const shortId = (id: string) => `${id.slice(0, 8)}\u2026${id.slice(-6)}`;

  const formatSalesOrderLabel = (so: (typeof salesOrders)[number]) =>
    so.order_number || shortId(so.id);

  return (
    <TooltipProvider>
      <div className="page-container">
        <PageHeader title="Plasma Projects" actions={<ModuleHelpButton moduleKey="plasma_projects" />} />
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            Manage standalone plasma projects and link them to Sales Orders for quoting and invoicing.
          </p>
          <Button onClick={handleCreate} title="Creates a new plasma job so you can add cut lines and generate a cut sheet.">
            New Plasma Project
          </Button>
        </div>
      <div className="table-container">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Sales Order</TableHead>
              <TableHead className="text-right">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                  No plasma projects yet.
                </TableCell>
              </TableRow>
            ) : (
              projects.map((job) => {
                const so = job.sales_order_id ? salesOrderById[job.sales_order_id] : null;
                const jobTitle = job.title ?? 'Plasma Project';
                return (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Link
                        to={`/plasma/${job.id}`}
                        className="font-mono text-primary hover:underline"
                        title={job.id}
                      >
                        {jobTitle}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{job.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {so ? (
                        <Link
                          to={`/sales-orders/${so.id}`}
                          className="text-primary hover:underline"
                          title={so.id}
                        >
                          {formatSalesOrderLabel(so)}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Not linked</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {new Date(job.updated_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
    </TooltipProvider>
  );
}
