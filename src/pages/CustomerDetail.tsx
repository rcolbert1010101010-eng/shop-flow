import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DataTable, Column } from '@/components/ui/data-table';
import { Separator } from '@/components/ui/separator';
import { useRepos } from '@/repos';
import { useToast } from '@/hooks/use-toast';
import { Edit, Save, X, Trash2, Wrench, ShoppingCart, Clock3, Plus } from 'lucide-react';
import type { PaymentTerms, PreferredContactMethod, Unit } from '@/types';
import { AddUnitDialog } from '@/components/units/AddUnitDialog';
import { useIsMobile } from '@/hooks/useIsMobile';
import { MobileActionBar, MobileActionBarSpacer } from '@/components/common/MobileActionBar';
import { ModuleHelpButton } from '@/components/help/ModuleHelpButton';
import { TooltipProvider } from '@/components/ui/tooltip';

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const repos = useRepos();
  const { customers, updateCustomer, deactivateCustomer } = repos.customers;
  const { units } = repos.units;
  const { getCustomerContacts, createCustomerContact, setPrimaryCustomerContact } = repos.customerContacts;
  const { workOrders } = repos.workOrders;
  const { salesOrders } = repos.salesOrders;
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [editing, setEditing] = useState(false);
  const [workOrderDialogOpen, setWorkOrderDialogOpen] = useState(false);
  const [salesOrderDialogOpen, setSalesOrderDialogOpen] = useState(false);
  const [viewWorkOrdersOpen, setViewWorkOrdersOpen] = useState(false);
  const [viewSalesOrdersOpen, setViewSalesOrdersOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [contactsDialogOpen, setContactsDialogOpen] = useState(false);
  const [unitsDialogOpen, setUnitsDialogOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [selectedWorkUnit, setSelectedWorkUnit] = useState<string>('');
  const [selectedSalesUnit, setSelectedSalesUnit] = useState<string>('');
  const SCHEDULE_NONE = '__NONE__';
  const [selectedScheduleWo, setSelectedScheduleWo] = useState<string>(SCHEDULE_NONE);
  const [scheduleWorkOrderId, setScheduleWorkOrderId] = useState<string>('');
  const [scheduleStart, setScheduleStart] = useState<Date | null>(null);
  const [scheduleDuration, setScheduleDuration] = useState<number>(60);
  const [viewWoSearch, setViewWoSearch] = useState('');
  const [viewSoSearch, setViewSoSearch] = useState('');
  const [workUnitTouched, setWorkUnitTouched] = useState(false);
  const [isCreatingWorkOrder, setIsCreatingWorkOrder] = useState(false);
  const [isCreatingSalesOrder, setIsCreatingSalesOrder] = useState(false);
  const [reopenWorkOrderAfterUnitCreate, setReopenWorkOrderAfterUnitCreate] = useState(false);
  const NONE_WORK_UNIT = '__NONE__';
  const [contactForm, setContactForm] = useState({
    name: '',
    role: '',
    phone: '',
    email: '',
    preferred_method: '' as PreferredContactMethod | '',
    is_primary: false,
  });

  const customer = customers.find((c) => c.id === id);
  const customerUnits = units.filter((u) => u.customer_id === id);
  const contacts = getCustomerContacts(id!);
  const primaryContact = contacts.find((c) => c.is_primary);

  const [formData, setFormData] = useState({
    company_name: customer?.company_name || '',
    contact_name: customer?.contact_name || '',
    phone: customer?.phone || '',
    email: customer?.email || '',
    address: customer?.address || '',
    notes: customer?.notes || '',
    price_level: customer?.price_level || 'RETAIL',
    is_tax_exempt: customer?.is_tax_exempt ?? false,
    tax_rate_override: customer?.tax_rate_override?.toString() || '',
    payment_terms: (customer?.payment_terms as PaymentTerms) || 'COD',
    credit_limit: customer?.credit_limit?.toString() || '',
    credit_hold: customer?.credit_hold ?? false,
    credit_hold_reason: customer?.credit_hold_reason || '',
  });

  if (!customer) {
    return (
      <div className="page-container">
        <PageHeader title="Customer Not Found" backTo="/customers" />
        <p className="text-muted-foreground">This customer does not exist.</p>
      </div>
    );
  }

  const handleSave = () => {
    if (!formData.company_name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Company name is required',
        variant: 'destructive',
      });
      return;
    }

    // Check for duplicate company name (excluding self)
    const exists = customers.some(
      (c) => c.id !== id && c.company_name.toLowerCase() === formData.company_name.toLowerCase()
    );
    if (exists) {
      toast({
        title: 'Validation Error',
        description: 'A customer with this company name already exists',
        variant: 'destructive',
      });
      return;
    }

    if (formData.credit_hold && !formData.credit_hold_reason.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Credit hold reason is required',
        variant: 'destructive',
      });
      return;
    }

    const creditLimitValue =
      formData.credit_limit.trim() === ''
        ? null
        : Number.isFinite(parseFloat(formData.credit_limit))
        ? parseFloat(formData.credit_limit)
        : null;

    updateCustomer(id!, {
      company_name: formData.company_name.trim(),
      contact_name: formData.contact_name.trim() || null,
      phone: formData.phone.trim() || null,
      email: formData.email.trim() || null,
      address: formData.address.trim() || null,
      notes: formData.notes.trim() || null,
      price_level: formData.price_level,
      is_tax_exempt: formData.is_tax_exempt,
      tax_rate_override:
        formData.tax_rate_override.trim() === ''
          ? null
          : Number.isFinite(parseFloat(formData.tax_rate_override))
          ? parseFloat(formData.tax_rate_override)
          : null,
      payment_terms: formData.payment_terms as PaymentTerms,
      credit_limit: creditLimitValue,
      credit_hold: formData.credit_hold,
      credit_hold_reason: formData.credit_hold ? formData.credit_hold_reason.trim() || null : null,
    });

    toast({
      title: 'Customer Updated',
      description: 'Changes have been saved',
    });
    setEditing(false);
  };

  const handleDeactivate = () => {
    const success = deactivateCustomer(id!);
    if (success) {
      toast({
        title: 'Customer Deactivated',
        description: 'Customer has been deactivated',
      });
      navigate('/customers');
    } else {
      toast({
        title: 'Cannot Deactivate',
        description: 'Customer has active orders and cannot be deactivated',
        variant: 'destructive',
      });
    }
  };

  const resetContactForm = () =>
    setContactForm({
      name: '',
      role: '',
      phone: '',
      email: '',
      preferred_method: '' as PreferredContactMethod | '',
      is_primary: false,
    });

  const handleSaveContact = () => {
    if (!contactForm.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Contact name is required',
        variant: 'destructive',
      });
      return;
    }

    const result = createCustomerContact(id!, {
      name: contactForm.name.trim(),
      role: contactForm.role.trim() || null,
      phone: contactForm.phone.trim() || null,
      email: contactForm.email.trim() || null,
      preferred_method: (contactForm.preferred_method as PreferredContactMethod) || null,
      is_primary: contactForm.is_primary,
    });

    if (!result.success) {
      toast({
        title: 'Could not add contact',
        description: result.error || 'Unknown error',
        variant: 'destructive',
      });
      return;
    }

    if (contactForm.is_primary && result.contact?.id) {
      setPrimaryCustomerContact(id!, result.contact.id);
    }

    toast({
      title: 'Contact Added',
      description: 'New contact has been saved',
    });
    resetContactForm();
    setContactDialogOpen(false);
  };

  const handleMakePrimary = (contactId: string) => {
    setPrimaryCustomerContact(id!, contactId);
    toast({
      title: 'Primary Contact Set',
      description: 'Primary contact updated',
    });
  };

  const customerWorkOrders = (workOrders || []).filter((wo) => wo.customer_id === id);
  const customerSalesOrders = (salesOrders || []).filter((so) => so.customer_id === id);

  const openWoStatuses = new Set(['OPEN', 'IN_PROGRESS', 'SCHEDULED', 'ESTIMATE', 'HOLD']);
  const openSoStatuses = new Set(['OPEN', 'APPROVED', 'ESTIMATE', 'QUOTE', 'PARTIAL']);

  const openWorkOrders = customerWorkOrders.filter((wo) => openWoStatuses.has(wo.status));
  const openSalesOrders = customerSalesOrders.filter((so) => openSoStatuses.has(so.status));

  const recentWorkOrders = [...customerWorkOrders]
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime())
    .slice(0, 5);

  const recentSalesOrders = [...customerSalesOrders]
    .sort((a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime())
    .slice(0, 5);

  const filterWorkOrders = (list: typeof customerWorkOrders, term: string) => {
    const search = term.toLowerCase().trim();
    if (!search) return list;
    return list.filter((wo) => {
      const values = [
        wo.id,
        wo.status,
        wo.total?.toString(),
        wo.updated_at,
        wo.created_at,
        (wo as any).unit_id,
        (wo as any).unit_name,
        (wo as any).unit?.unit_name,
      ];
      return values.some((val) => val && val.toString().toLowerCase().includes(search));
    });
  };

  const filterSalesOrders = (list: typeof customerSalesOrders, term: string) => {
    const search = term.toLowerCase().trim();
    if (!search) return list;
    return list.filter((so) => {
      const values = [
        so.id,
        so.status,
        so.total?.toString(),
        so.updated_at,
        so.created_at,
        (so as any).unit_id,
        (so as any).unit_name,
        (so as any).unit?.unit_name,
      ];
      return values.some((val) => val && val.toString().toLowerCase().includes(search));
    });
  };

  const sortedCustomerWorkOrders = [...customerWorkOrders].sort(
    (a, b) =>
      new Date(b.updated_at || b.created_at || 0).getTime() -
      new Date(a.updated_at || a.created_at || 0).getTime()
  );

  const sortedCustomerSalesOrders = [...customerSalesOrders].sort(
    (a, b) =>
      new Date(b.updated_at || b.created_at || 0).getTime() -
      new Date(a.updated_at || a.created_at || 0).getTime()
  );

  const filteredOpenWorkOrders = filterWorkOrders(openWorkOrders, viewWoSearch);
  const filteredAllWorkOrders = filterWorkOrders(sortedCustomerWorkOrders, viewWoSearch);
  const filteredOpenSalesOrders = filterSalesOrders(openSalesOrders, viewSoSearch);
  const filteredAllSalesOrders = filterSalesOrders(sortedCustomerSalesOrders, viewSoSearch);

  const getDefaultWorkOrderUnitId = () => {
    const withUnit = [...customerWorkOrders]
      .filter((wo) => wo.unit_id)
      .sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at || 0).getTime() -
          new Date(a.updated_at || a.created_at || 0).getTime()
      );
    if (withUnit.length) return withUnit[0].unit_id as string;
    if (customerUnits.length) return customerUnits[0].id;
    return '';
  };

  const getNextBusinessDayAt = (hour = 8, minute = 0) => {
    const now = new Date();
    const day = now.getDay();
    let offset = 1;
    if (day === 6) {
      offset = 2;
    } else if (day === 0) {
      offset = 1;
    }
    const target = new Date(now);
    target.setDate(now.getDate() + offset);
    target.setHours(hour, minute, 0, 0);
    return target;
  };

  const lastActivityDate = (() => {
    const dates: Date[] = [];
    customerWorkOrders.forEach((wo) => {
      if (wo.updated_at) dates.push(new Date(wo.updated_at));
      else if (wo.created_at) dates.push(new Date(wo.created_at));
    });
    customerSalesOrders.forEach((so) => {
      if (so.updated_at) dates.push(new Date(so.updated_at));
      else if (so.created_at) dates.push(new Date(so.created_at));
    });
    if (dates.length === 0) return null;
    return new Date(Math.max(...dates.map((d) => d.getTime())));
  })();

  const unitColumns: Column<Unit>[] = [
    { key: 'unit_name', header: 'Unit Name', sortable: true },
    { key: 'vin', header: 'VIN', sortable: true, className: 'font-mono' },
    { key: 'year', header: 'Year', sortable: true },
    { key: 'make', header: 'Make', sortable: true },
    { key: 'model', header: 'Model', sortable: true },
  ];

  return (
    <TooltipProvider>
      <div className="page-container">
        <PageHeader
          title={
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold">{customer.company_name}</span>
              {customer.credit_hold && <Badge variant="destructive">Credit Hold</Badge>}
              {(customer.is_tax_exempt || formData.is_tax_exempt) && (
                <Badge variant="secondary">Tax Exempt</Badge>
              )}
              {!customer.is_active && <Badge variant="outline">Inactive</Badge>}
            </div>
          }
          subtitle={
            <span className="flex items-center gap-1">
              {customer.is_active ? 'Active Customer' : 'Inactive Customer'}</span>
          }
          backTo="/customers"
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <ModuleHelpButton moduleKey="customers" />
            {editing ? (
              <>
                <Button variant="outline" onClick={() => setEditing(false)}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button onClick={handleSave}>
                  <Save className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                {customer.is_active && (
                  <Button variant="destructive" onClick={handleDeactivate}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Deactivate
                  </Button>
                )}
              </>
            )}
          </div>
        }
      />

      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b mb-4">
        <div className="flex flex-wrap items-center gap-2 py-2">
          <Button onClick={() => setWorkOrderDialogOpen(true)}>
            New Work Order
          </Button>
          <Button variant="outline" onClick={() => setSalesOrderDialogOpen(true)}>
            New Sales Order
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setScheduleWorkOrderId('');
              setSelectedScheduleWo('');
              setScheduleDialogOpen(true);
            }}
          >
            Schedule Work Order
          </Button>
          <Button
            variant="outline"
            onClick={() => setViewWorkOrdersOpen(true)}
            title="Repair history and current jobs."
          >
            View Work Orders
          </Button>
          <Button
            variant="outline"
            onClick={() => setViewSalesOrdersOpen(true)}
            title="Quotes and parts/material sales history."
          >
            View Sales Orders
          </Button>
          <Button
            variant="outline"
            onClick={() => setContactsDialogOpen(true)}
            title="Main person to call for approvals and updates."
          >
            Contacts
          </Button>
          <Button
            variant="outline"
            onClick={() => setUnitsDialogOpen(true)}
            title="Assets tied to this customer for service history."
          >
            Units
          </Button>
          <Button
            variant="outline"
            onClick={() => setAccountDialogOpen(true)}
            title="Billing history and balances."
          >
            Account
          </Button>
        </div>
      </div>

      {!editing && customer.credit_hold && (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Customer is on Credit Hold</AlertTitle>
          <AlertDescription>
            {customer.credit_hold_reason || 'No reason provided.'}
          </AlertDescription>
        </Alert>
      )}

      <div className="form-section mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-1">
          Customer Information</h2>
        <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
          <span>
            {primaryContact?.name || formData.contact_name || 'No primary contact'}
          </span>
          <span>•</span>
          <span>{primaryContact?.phone || formData.phone || 'No phone'}</span>
          <span>•</span>
          <span>{primaryContact?.email || formData.email || 'No email'}</span>
          <span>•</span>
          <span>{customerUnits.length} units</span>
          {customer.credit_hold && (
            <Badge variant="destructive">Credit Hold</Badge>
          )}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="space-y-3">
            <div>
              <Label htmlFor="company_name" className="flex items-center gap-1">
                Company Name *</Label>
              {editing ? (
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                />
              ) : (
                <div className="text-sm text-foreground">{formData.company_name || '—'}</div>
              )}
            </div>
            <div>
              <Label className="flex items-center gap-1">
                Price Level</Label>
              {editing ? (
                <Select
                  value={formData.price_level}
                  onValueChange={(value) => setFormData({ ...formData, price_level: value as 'RETAIL' | 'FLEET' | 'WHOLESALE' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select price level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RETAIL">Retail</SelectItem>
                    <SelectItem value="FLEET">Fleet</SelectItem>
                    <SelectItem value="WHOLESALE">Wholesale</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm text-foreground">
                  {formData.price_level === 'FLEET'
                    ? 'Fleet'
                    : formData.price_level === 'WHOLESALE'
                    ? 'Wholesale'
                    : 'Retail'}
                </div>
              )}
            </div>
            {editing ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is_tax_exempt"
                  checked={formData.is_tax_exempt}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_tax_exempt: Boolean(checked) })
                  }
                />
                <Label htmlFor="is_tax_exempt" className="font-medium flex items-center gap-1">
                  Tax Exempt</Label>
              </div>
            ) : (
              <div className="text-sm text-foreground">
                Tax Exempt: {formData.is_tax_exempt ? 'Yes' : 'No'}
              </div>
            )}
            <div>
              <Label htmlFor="tax_rate_override" className="flex items-center gap-1">
                Tax Rate Override (%)</Label>
              {editing ? (
                <Input
                  id="tax_rate_override"
                  type="number"
                  step="0.01"
                  value={formData.tax_rate_override}
                  onChange={(e) => setFormData({ ...formData, tax_rate_override: e.target.value })}
                  disabled={formData.is_tax_exempt}
                  placeholder="e.g., 8.25"
                />
              ) : (
                <div className="text-sm text-foreground">
                  {formData.tax_rate_override || '—'}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <Label htmlFor="contact_name" className="flex items-center gap-1">
                Contact Name</Label>
              {editing ? (
                <Input
                  id="contact_name"
                  value={formData.contact_name}
                  onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                />
              ) : (
                <div className="text-sm text-foreground">
                  {formData.contact_name || '—'}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="phone" className="flex items-center gap-1">
                  Phone</Label>
                {editing ? (
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                ) : (
                  <div className="text-sm text-foreground">
                    {formData.phone || '—'}
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="email" className="flex items-center gap-1">
                  Email</Label>
                {editing ? (
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                ) : (
                  <div className="text-sm text-foreground">
                    {formData.email || '—'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
          <div>
            <Label htmlFor="address" className="flex items-center gap-1">
              Address</Label>
            {editing ? (
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
              />
            ) : (
              <div className="text-sm text-foreground">
                {formData.address || '—'}
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="notes" className="flex items-center gap-1">
              Notes</Label>
            {editing ? (
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            ) : (
              <div className="text-sm text-foreground">
                {formData.notes || '—'}
              </div>
            )}
          </div>
        </div>
      </div>

      <Separator className="my-6" />

      <div className="form-section space-y-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 min-w-0">
          <StatCard
            title="Open Work Orders"
            value={openWorkOrders.length}
            icon={Wrench}
            variant="accent"
          />
          <StatCard
            title="Open Sales Orders"
            value={openSalesOrders.length}
            icon={ShoppingCart}
            variant="default"
          />
          <StatCard
            title="Last Activity"
            value={lastActivityDate ? lastActivityDate.toLocaleDateString() : '—'}
            icon={Clock3}
            variant="success"
            valueClassName="text-base sm:text-lg font-semibold leading-tight truncate"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Recent Work Orders</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentWorkOrders.length === 0 ? (
                  <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2 py-4">
                          <span>No work orders yet</span>
                          <Button size="sm" onClick={() => setWorkOrderDialogOpen(true)}>
                            Create Work Order
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentWorkOrders.map((wo) => (
                    <TableRow
                        key={wo.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/work-orders/${wo.id}`)}
                      >
                        <TableCell>{wo.status}</TableCell>
                        <TableCell>
                          {wo.updated_at
                            ? new Date(wo.updated_at).toLocaleDateString()
                            : wo.created_at
                            ? new Date(wo.created_at).toLocaleDateString()
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {typeof wo.total === 'number' ? `$${wo.total.toFixed(2)}` : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/work-orders/${wo.id}`);
                              }}
                            >
                              Open
                            </Button>
                            {openWoStatuses.has(wo.status) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setScheduleWorkOrderId(wo.id);
                                  setSelectedScheduleWo(wo.id);
                                  setScheduleDialogOpen(true);
                                }}
                              >
                                Schedule
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Recent Sales Orders</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSalesOrders.length === 0 ? (
                  <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2 py-4">
                          <span>No sales orders yet</span>
                          <Button size="sm" onClick={() => setSalesOrderDialogOpen(true)}>
                            Create Sales Order
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentSalesOrders.map((so) => (
                    <TableRow
                        key={so.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/sales-orders/${so.id}`)}
                      >
                        <TableCell>{so.status}</TableCell>
                        <TableCell>
                          {so.updated_at
                            ? new Date(so.updated_at).toLocaleDateString()
                            : so.created_at
                            ? new Date(so.created_at).toLocaleDateString()
                            : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          {typeof so.total === 'number' ? `$${so.total.toFixed(2)}` : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/sales-orders/${so.id}`);
                              }}
                            >
                              Open
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      {editing && isMobile && (
        <div className="no-print">
          <MobileActionBar
            primary={
              <Button onClick={handleSave} className="flex-1">
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            }
            secondary={
              <Button variant="outline" onClick={() => setEditing(false)} className="flex-1">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            }
          />
          <MobileActionBarSpacer />
        </div>
      )}

      <Dialog
        open={workOrderDialogOpen}
        onOpenChange={(open) => {
          setWorkOrderDialogOpen(open);
          if (open) {
            setWorkUnitTouched(false);
            if (!reopenWorkOrderAfterUnitCreate) {
              setSelectedWorkUnit('');
            }
            setReopenWorkOrderAfterUnitCreate(false);
          } else {
            setSelectedWorkUnit('');
            setWorkUnitTouched(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Work Order</DialogTitle>
            <DialogDescription>
              Create a work order for this customer and unit.
            </DialogDescription>
          </DialogHeader>
          {customerUnits.length > 0 ? (
            <div className="space-y-2">
              <Label>Select Unit *</Label>
              <div className="flex gap-2">
                <Select
                  value={selectedWorkUnit || NONE_WORK_UNIT}
                  onValueChange={(value) => {
                    setWorkUnitTouched(true);
                    setSelectedWorkUnit(value === NONE_WORK_UNIT ? '' : value);
                  }}
                  disabled={isCreatingWorkOrder}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE_WORK_UNIT} disabled>
                      Select a unit…
                    </SelectItem>
                    {customerUnits.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.unit_name || unit.vin || unit.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setUnitDialogOpen(true)}
                  disabled={isCreatingWorkOrder}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">No units yet.</p>
              <Button
                variant="outline"
                onClick={() => {
                  setWorkOrderDialogOpen(false);
                  setUnitDialogOpen(true);
                  setReopenWorkOrderAfterUnitCreate(true);
                }}
              >
                Add Unit
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkOrderDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!selectedWorkUnit || isCreatingWorkOrder}
              onClick={async () => {
                if (!selectedWorkUnit) return;
                try {
                  setIsCreatingWorkOrder(true);
                  const created = await Promise.resolve(
                    repos.workOrders.createWorkOrder(id!, selectedWorkUnit)
                  );
                  navigate(`/work-orders/${created.id}`);
                  setWorkOrderDialogOpen(false);
                  setSelectedWorkUnit('');
                } catch (error) {
                  toast({
                    title: 'Could not create work order',
                    description: error instanceof Error ? error.message : 'Unknown error',
                    variant: 'destructive',
                  });
                } finally {
                  setIsCreatingWorkOrder(false);
                }
              }}
            >
              {isCreatingWorkOrder ? 'Creating…' : 'Create Work Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={salesOrderDialogOpen}
        onOpenChange={(open) => {
          setSalesOrderDialogOpen(open);
          if (!open) setSelectedSalesUnit('');
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Sales Order</DialogTitle>
            <DialogDescription>
              Create a sales order for this customer and optional unit.
            </DialogDescription>
          </DialogHeader>
          {customerUnits.length > 0 && (
            <div className="space-y-2">
              <Label>Select Unit (optional)</Label>
              <Select
                value={selectedSalesUnit || '__NONE__'}
                onValueChange={(value) => setSelectedSalesUnit(value === '__NONE__' ? '' : value)}
                disabled={isCreatingSalesOrder}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select unit (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NONE__">No unit</SelectItem>
                  {customerUnits.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.unit_name || unit.vin || unit.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSalesOrderDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={isCreatingSalesOrder}
              onClick={async () => {
                try {
                  setIsCreatingSalesOrder(true);
                  const created = await Promise.resolve(
                    repos.salesOrders.createSalesOrder(id!, selectedSalesUnit || null)
                  );
                  navigate(`/sales-orders/${created.id}`);
                  setSalesOrderDialogOpen(false);
                  setSelectedSalesUnit('');
                } catch (error) {
                  toast({
                    title: 'Could not create sales order',
                    description: error instanceof Error ? error.message : 'Unknown error',
                    variant: 'destructive',
                  });
                } finally {
                  setIsCreatingSalesOrder(false);
                }
              }}
            >
              {isCreatingSalesOrder ? 'Creating…' : 'Create Sales Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={viewWorkOrdersOpen}
        onOpenChange={(open) => setViewWorkOrdersOpen(open)}
      >
        <DialogContent className="w-full sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1">
              Work Orders</DialogTitle>
            <DialogDescription>Work orders for this customer.</DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <Input
              placeholder="Search work orders"
              value={viewWoSearch}
              onChange={(e) => setViewWoSearch(e.target.value)}
            />
            <Tabs defaultValue="open" className="space-y-3">
              <div className="overflow-x-auto">
                <TabsList className="inline-flex min-w-max">
                  <TabsTrigger value="open">Open</TabsTrigger>
                  <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="open">
                <div className="rounded-md border overflow-auto max-h-[60vh]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOpenWorkOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            No work orders found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredOpenWorkOrders.map((wo) => (
                          <TableRow
                            key={wo.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => {
                              navigate(`/work-orders/${wo.id}`);
                              setViewWorkOrdersOpen(false);
                            }}
                          >
                            <TableCell>{wo.status}</TableCell>
                            <TableCell>
                              {wo.updated_at
                                ? new Date(wo.updated_at).toLocaleDateString()
                                : wo.created_at
                                ? new Date(wo.created_at).toLocaleDateString()
                                : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              {typeof wo.total === 'number' ? `$${wo.total.toFixed(2)}` : '—'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
              <TabsContent value="all">
                <div className="rounded-md border overflow-auto max-h-[60vh]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAllWorkOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            No work orders found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAllWorkOrders.map((wo) => (
                          <TableRow
                            key={wo.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => {
                              navigate(`/work-orders/${wo.id}`);
                              setViewWorkOrdersOpen(false);
                            }}
                          >
                            <TableCell>{wo.status}</TableCell>
                            <TableCell>
                              {wo.updated_at
                                ? new Date(wo.updated_at).toLocaleDateString()
                                : wo.created_at
                                ? new Date(wo.created_at).toLocaleDateString()
                                : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              {typeof wo.total === 'number' ? `$${wo.total.toFixed(2)}` : '—'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={viewSalesOrdersOpen}
        onOpenChange={(open) => setViewSalesOrdersOpen(open)}
      >
        <DialogContent className="w-full sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1">
              Sales Orders</DialogTitle>
            <DialogDescription>Sales orders for this customer.</DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <Input
              placeholder="Search sales orders"
              value={viewSoSearch}
              onChange={(e) => setViewSoSearch(e.target.value)}
            />
            <Tabs defaultValue="open" className="space-y-3">
              <div className="overflow-x-auto">
                <TabsList className="inline-flex min-w-max">
                  <TabsTrigger value="open">Open</TabsTrigger>
                  <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="open">
                <div className="rounded-md border overflow-auto max-h-[60vh]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOpenSalesOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            No sales orders found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredOpenSalesOrders.map((so) => (
                          <TableRow
                            key={so.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => {
                              navigate(`/sales-orders/${so.id}`);
                              setViewSalesOrdersOpen(false);
                            }}
                          >
                            <TableCell>{so.status}</TableCell>
                            <TableCell>
                              {so.updated_at
                                ? new Date(so.updated_at).toLocaleDateString()
                                : so.created_at
                                ? new Date(so.created_at).toLocaleDateString()
                                : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              {typeof so.total === 'number' ? `$${so.total.toFixed(2)}` : '—'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
              <TabsContent value="all">
                <div className="rounded-md border overflow-auto max-h-[60vh]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAllSalesOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            No sales orders found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAllSalesOrders.map((so) => (
                          <TableRow
                            key={so.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => {
                              navigate(`/sales-orders/${so.id}`);
                              setViewSalesOrdersOpen(false);
                            }}
                          >
                            <TableCell>{so.status}</TableCell>
                            <TableCell>
                              {so.updated_at
                                ? new Date(so.updated_at).toLocaleDateString()
                                : so.created_at
                                ? new Date(so.created_at).toLocaleDateString()
                                : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              {typeof so.total === 'number' ? `$${so.total.toFixed(2)}` : '—'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={scheduleDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedScheduleWo(SCHEDULE_NONE);
            setScheduleWorkOrderId('');
          }
          setScheduleDialogOpen(open);
          if (!open) {
            setScheduleStart(null);
            setScheduleDuration(60);
          }
          if (open) {
            const nextStart = getNextBusinessDayAt();
            setScheduleStart(nextStart);
            setScheduleDuration((prev) => prev || 60);
            if (scheduleWorkOrderId) {
              setSelectedScheduleWo(scheduleWorkOrderId);
            } else {
              setSelectedScheduleWo(SCHEDULE_NONE);
            }
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Work Order</DialogTitle>
            <DialogDescription>
              Choose a work order to open in scheduling.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Select Work Order</Label>
            <Select
              value={selectedScheduleWo}
              onValueChange={(value) => setSelectedScheduleWo(value === SCHEDULE_NONE ? SCHEDULE_NONE : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select work order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SCHEDULE_NONE} disabled>
                  Select a work order…
                </SelectItem>
                {openWorkOrders.map((wo) => (
                  <SelectItem key={wo.id} value={wo.id}>
                    {wo.id} — {wo.status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setScheduleDialogOpen(false);
                  setSelectedScheduleWo(SCHEDULE_NONE);
                }}
              >
                Cancel
              </Button>
            <Button
              disabled={!selectedScheduleWo || selectedScheduleWo === SCHEDULE_NONE}
              onClick={() => {
                if (!selectedScheduleWo || selectedScheduleWo === SCHEDULE_NONE) return;
                const startParam = scheduleStart ? `&start=${encodeURIComponent(scheduleStart.toISOString())}` : '';
                const durationParam = scheduleDuration ? `&duration=${scheduleDuration}` : '';
                navigate(`/scheduling?work_order_id=${selectedScheduleWo}${startParam}${durationParam}`);
                setScheduleDialogOpen(false);
                setSelectedScheduleWo(SCHEDULE_NONE);
                setScheduleWorkOrderId('');
              }}
            >
              Open Scheduling
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={contactsDialogOpen} onOpenChange={setContactsDialogOpen}>
        <SheetContent side="right" className="w-full sm:max-w-4xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-1">
              Contacts</SheetTitle>
            <SheetDescription>Manage contacts for this customer.</SheetDescription>
          </SheetHeader>
          <div className="flex items-center justify-between mb-3">
            <Button
              size="sm"
              onClick={() => {
                resetContactForm();
                setContactDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Contact
            </Button>
          </div>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Preferred</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No contacts yet
                    </TableCell>
                  </TableRow>
                ) : (
                  contacts.map((contact) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium flex items-center gap-2">
                        {contact.name}
                        {contact.is_primary && <Badge variant="secondary">Primary</Badge>}
                      </TableCell>
                      <TableCell>{contact.role || '—'}</TableCell>
                      <TableCell>{contact.phone || '—'}</TableCell>
                      <TableCell>{contact.email || '—'}</TableCell>
                      <TableCell>{contact.preferred_method || '—'}</TableCell>
                      <TableCell className="text-right">
                        {!contact.is_primary && (
                          <Button size="sm" variant="outline" onClick={() => handleMakePrimary(contact.id)}>
                            Make Primary
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={unitsDialogOpen} onOpenChange={setUnitsDialogOpen}>
        <SheetContent side="right" className="w-full sm:max-w-4xl">
          <SheetHeader>
            <SheetTitle>Units / Equipment</SheetTitle>
            <SheetDescription>Units tied to this customer.</SheetDescription>
          </SheetHeader>
          <div className="flex items-center justify-between mb-3">
            <Button size="sm" onClick={() => setUnitDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Unit
            </Button>
          </div>
          <DataTable
            data={customerUnits}
            columns={unitColumns}
            searchable={false}
            onRowClick={(unit) => navigate(`/units/${unit.id}`)}
            emptyMessage="No units found for this customer"
          />
        </SheetContent>
      </Sheet>

      <Sheet open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-1">
              Account</SheetTitle>
            <SheetDescription>Account details for this customer.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label className="flex items-center gap-1">
                Payment Terms</Label>
              {editing ? (
                <Select
                  value={formData.payment_terms}
                  onValueChange={(value) => setFormData({ ...formData, payment_terms: value as PaymentTerms })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment terms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COD">COD</SelectItem>
                    <SelectItem value="NET_15">Net 15</SelectItem>
                    <SelectItem value="NET_30">Net 30</SelectItem>
                    <SelectItem value="NET_45">Net 45</SelectItem>
                    <SelectItem value="NET_60">Net 60</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-sm text-foreground mt-1">
                  {formData.payment_terms}
                </div>
              )}
            </div>
            <div>
              <Label className="flex items-center gap-1">
                Credit Limit</Label>
              {editing ? (
                <Input
                  type="number"
                  value={formData.credit_limit}
                  onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                  placeholder="e.g., 5000"
                />
              ) : (
                <div className="text-sm text-foreground mt-1">
                  {formData.credit_limit || '—'}
                </div>
              )}
            </div>
            {editing ? (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="credit_hold"
                  checked={formData.credit_hold}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      credit_hold: Boolean(checked),
                      credit_hold_reason: checked ? prev.credit_hold_reason : '',
                    }))
                  }
                />
                <Label htmlFor="credit_hold" className="font-medium flex items-center gap-1">
                  Credit Hold</Label>
              </div>
            ) : (
              <div className="text-sm text-foreground">
                Credit Hold: {formData.credit_hold ? 'Yes' : 'No'}
              </div>
            )}
            {formData.credit_hold && (
              <div>
                <Label htmlFor="credit_hold_reason" className="flex items-center gap-1">
                  Credit Hold Reason *</Label>
                {editing ? (
                  <Textarea
                    id="credit_hold_reason"
                    value={formData.credit_hold_reason}
                    onChange={(e) => setFormData({ ...formData, credit_hold_reason: e.target.value })}
                    rows={2}
                    placeholder="Enter reason for hold"
                  />
                ) : (
                  <div className="text-sm text-foreground mt-1">
                    {formData.credit_hold_reason || '—'}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAccountDialogOpen(false)}>
              Close
            </Button>
            {!editing && (
              <Button onClick={() => setEditing(true)}>
                Edit Account
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AddUnitDialog
        open={unitDialogOpen}
        onOpenChange={setUnitDialogOpen}
        customerId={id!}
        customerName={customer.company_name}
        onUnitCreated={(unit) => {
          setSelectedWorkUnit(unit.id);
          setUnitDialogOpen(false);
          if (reopenWorkOrderAfterUnitCreate) {
            setWorkOrderDialogOpen(true);
          }
        }}
      />

      <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Contact</DialogTitle>
            <DialogDescription>Contact information for this customer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Name *</Label>
                <Input
                  value={contactForm.name}
                  onChange={(e) => setContactForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Role</Label>
                <Input
                  value={contactForm.role}
                  onChange={(e) => setContactForm((prev) => ({ ...prev, role: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Phone</Label>
                <Input
                  value={contactForm.phone}
                  onChange={(e) => setContactForm((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={contactForm.email}
                  onChange={(e) => setContactForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Preferred Method</Label>
                <Select
                  value={contactForm.preferred_method || undefined}
                  onValueChange={(value: PreferredContactMethod) =>
                    setContactForm((prev) => ({ ...prev, preferred_method: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PHONE">Phone</SelectItem>
                    <SelectItem value="EMAIL">Email</SelectItem>
                    <SelectItem value="TEXT">Text</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2 pt-6">
                <Checkbox
                  id="is_primary_contact"
                  checked={contactForm.is_primary}
                  onCheckedChange={(checked) =>
                    setContactForm((prev) => ({ ...prev, is_primary: Boolean(checked) }))
                  }
                />
                <Label htmlFor="is_primary_contact" className="flex items-center gap-1">
                  Primary Contact</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetContactForm();
                setContactDialogOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveContact}>Save Contact</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
