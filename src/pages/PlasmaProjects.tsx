import { useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { HelpTooltip } from '@/components/help/HelpTooltip';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useRepos } from '@/repos';
import { ModuleHelpButton } from '@/components/help/ModuleHelpButton';

export default function PlasmaProjects() {
  const repos = useRepos();
  const plasmaRepo = repos.plasma;
  const { salesOrders } = repos.salesOrders;
  const navigate = useNavigate();

  const projects = useMemo(
    () =>
      plasmaRepo
        .listStandalone()
        .slice()
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [plasmaRepo]
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

  return (
    <TooltipProvider>
      <div className="page-container">
        <PageHeader title="Plasma Projects" actions={<ModuleHelpButton moduleKey="plasma_projects" />} />
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            Manage standalone plasma projects and link them to Sales Orders for quoting and invoicing.
            <HelpTooltip content="Track plasma-cut jobs with machine time, cut length, pierces, and pricing totals." />
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
                return (
                  <TableRow key={job.id}>
                    <TableCell>
                      <Link to={`/plasma/${job.id}`} className="font-mono text-primary hover:underline">
                        {job.id}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{job.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {so ? (
                        <Link to={`/sales-orders/${so.id}`} className="text-primary hover:underline">
                          {so.order_number || so.id}
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
