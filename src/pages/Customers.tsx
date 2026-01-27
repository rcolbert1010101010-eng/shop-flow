import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Plus, Upload } from 'lucide-react';
import { useRepos } from '@/repos';
import type { Customer } from '@/types';
import { QuickAddDialog } from '@/components/ui/quick-add-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ModuleHelpButton } from '@/components/help/ModuleHelpButton';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { ImportCustomersDialog } from '@/components/customers/ImportCustomersDialog';

export default function Customers() {
  const navigate = useNavigate();
  const repos = useRepos();
  const { customers, addCustomer } = repos.customers;
  const { customerContacts } = repos.customerContacts;
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    company_name: '',
    contact_name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });
  const hasAnyCustomers = customers.length > 0;

  const columns: Column<Customer>[] = [
    { key: 'company_name', header: 'Company Name', sortable: true },
    { key: 'contact_name', header: 'Contact', sortable: true },
    { key: 'phone', header: 'Phone', sortable: true },
    { key: 'email', header: 'Email', sortable: true },
  ];

  const tableData = useMemo(() => {
    return customers
      .filter((c) => c.id !== 'walkin')
      .map((c) => {
        const primaryContact =
          customerContacts.find((cc) => cc.customer_id === c.id && cc.is_primary) ||
          customerContacts.find((cc) => cc.customer_id === c.id);
        return {
          ...c,
          contact_name: primaryContact?.name || c.contact_name,
          phone: primaryContact?.phone || c.phone,
          email: primaryContact?.email || c.email,
        };
      });
  }, [customers, customerContacts]);

  const handleSave = () => {
    if (!formData.company_name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Company name is required',
        variant: 'destructive',
      });
      return;
    }

    // Check for duplicate company name
    const exists = customers.some(
      (c) => c.company_name.toLowerCase() === formData.company_name.toLowerCase()
    );
    if (exists) {
      toast({
        title: 'Validation Error',
        description: 'A customer with this company name already exists',
        variant: 'destructive',
      });
      return;
    }

    const result = addCustomer({
      company_name: formData.company_name.trim(),
      contact_name: formData.contact_name.trim() || null,
      phone: formData.phone.trim() || null,
      email: formData.email.trim() || null,
      address: formData.address.trim() || null,
      notes: formData.notes.trim() || null,
      price_level: 'RETAIL',
      is_tax_exempt: false,
      tax_rate_override: null,
    });
    if (!result.success) {
      toast({
        title: 'Validation Error',
        description: result.error || 'Unable to add customer',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Customer Created',
      description: `${formData.company_name} has been added`,
    });

    setDialogOpen(false);
    setFormData({
      company_name: '',
      contact_name: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
    });
  };

  return (
    <TooltipProvider>
      <div className="page-container">
        <PageHeader
          title="Customers"
          subtitle={
            <span className="flex items-center gap-1">
              Manage your customer database</span>
          }
          actions={
            <>
              <ModuleHelpButton moduleKey="customers" context={{ isEmpty: !hasAnyCustomers }} />
              <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Import
              </Button>
              <Button
                onClick={() => setDialogOpen(true)}
                title="Create a new customer record for estimates, orders, and work orders."
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Customer
              </Button>
            </>
          }
        />

      <DataTable
        data={tableData}
        columns={columns}
        searchKeys={['company_name', 'contact_name', 'phone', 'email']}
        searchPlaceholder="Search customers..."
        onRowClick={(customer) => navigate(`/customers/${customer.id}`)}
        emptyMessage="No customers found. Add your first customer to get started."
      />

      <ImportCustomersDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        customers={customers}
      />

      <QuickAddDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Add New Customer"
        onSave={handleSave}
        onCancel={() => setDialogOpen(false)}
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="company_name" className="flex items-center gap-1">
              Company Name *</Label>
            <Input
              id="company_name"
              value={formData.company_name}
              onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
              placeholder="Enter company name"
            />
          </div>
          <div>
            <Label htmlFor="contact_name" className="flex items-center gap-1">
              Contact Name</Label>
            <Input
              id="contact_name"
              value={formData.contact_name}
              onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
              placeholder="Enter contact name"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone" className="flex items-center gap-1">
                Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Enter phone"
              />
            </div>
            <div>
              <Label htmlFor="email" className="flex items-center gap-1">
                Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter email"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="address" className="flex items-center gap-1">
              Address</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Enter address"
              rows={2}
            />
          </div>
          <div>
            <Label htmlFor="notes" className="flex items-center gap-1">
              Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Enter notes"
              rows={2}
            />
          </div>
        </div>
      </QuickAddDialog>
    </div>
    </TooltipProvider>
  );
}
