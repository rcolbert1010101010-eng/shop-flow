import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useRepos } from '@/repos';
import type { Vendor } from '@/types';
import { QuickAddDialog } from '@/components/ui/quick-add-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ModuleHelpButton } from '@/components/help/ModuleHelpButton';

export default function Vendors() {
  const navigate = useNavigate();
  const { vendors, addVendor } = useRepos().vendors;
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    vendor_name: '',
    phone: '',
    email: '',
    notes: '',
  });
  const hasAnyVendors = vendors.length > 0;

  const columns: Column<Vendor>[] = [
    { key: 'vendor_name', header: 'Vendor Name', sortable: true },
    { key: 'phone', header: 'Phone', sortable: true },
    { key: 'email', header: 'Email', sortable: true },
  ];

  const handleSave = () => {
    if (!formData.vendor_name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Vendor name is required',
        variant: 'destructive',
      });
      return;
    }

    addVendor({
      vendor_name: formData.vendor_name.trim(),
      phone: formData.phone.trim() || null,
      email: formData.email.trim() || null,
      notes: formData.notes.trim() || null,
    });

    toast({
      title: 'Vendor Created',
      description: `${formData.vendor_name} has been added`,
    });

    setDialogOpen(false);
    setFormData({ vendor_name: '', phone: '', email: '', notes: '' });
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Vendors"
        subtitle="Manage your parts vendors"
        actions={
          <div className="flex items-center gap-2">
            <ModuleHelpButton moduleKey="vendors" context={{ isEmpty: !hasAnyVendors }} />
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Vendor
            </Button>
          </div>
        }
      />

      <DataTable
        data={vendors}
        columns={columns}
        searchKeys={['vendor_name', 'phone', 'email']}
        searchPlaceholder="Search vendors..."
        onRowClick={(vendor) => navigate(`/vendors/${vendor.id}`)}
        emptyMessage="No vendors found. Add your first vendor to get started."
      />

      <QuickAddDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Add New Vendor"
        onSave={handleSave}
        onCancel={() => setDialogOpen(false)}
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="vendor_name">Vendor Name *</Label>
            <Input
              id="vendor_name"
              value={formData.vendor_name}
              onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
              placeholder="Enter vendor name"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Enter phone"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
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
            <Label htmlFor="notes">Notes</Label>
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
  );
}
