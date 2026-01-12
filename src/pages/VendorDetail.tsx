import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useRepos } from '@/repos';
import { useToast } from '@/hooks/use-toast';
import { Save, Edit, X, Trash2, Plus } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { useIsMobile } from '@/hooks/useIsMobile';
import { MobileActionBar, MobileActionBarSpacer } from '@/components/common/MobileActionBar';

export default function VendorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const repos = useRepos();
  const { vendors, updateVendor, deactivateVendor } = repos.vendors;
  const { parts } = repos.parts;
  const { warrantyPolicies, getClaimsByVendor, upsertWarrantyPolicy, createWarrantyClaim } = repos.warranty;
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const vendor = vendors.find((v) => v.id === id);
  const vendorParts = parts.filter((p) => p.vendor_id === id);
  const activeParts = vendorParts.filter((p) => p.is_active);
  const vendorPolicy = warrantyPolicies.find((p) => p.vendor_id === id);
  const vendorClaims = vendor ? getClaimsByVendor(vendor.id) : [];

  const [isEditing, setIsEditing] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [formData, setFormData] = useState({
    vendor_name: '',
    phone: '',
    email: '',
    notes: '',
  });
  const [policyForm, setPolicyForm] = useState({
    default_labor_rate: vendorPolicy?.default_labor_rate?.toString() || '',
    labor_coverage_percent: vendorPolicy?.labor_coverage_percent?.toString() || '',
    parts_coverage_percent: vendorPolicy?.parts_coverage_percent?.toString() || '',
    days_covered: vendorPolicy?.days_covered?.toString() || '',
    miles_covered: vendorPolicy?.miles_covered?.toString() || '',
    requires_rma: vendorPolicy?.requires_rma ?? false,
    notes: vendorPolicy?.notes || '',
  });

  useEffect(() => {
    if (vendor) {
      setFormData({
        vendor_name: vendor.vendor_name,
        phone: vendor.phone || '',
        email: vendor.email || '',
        notes: vendor.notes || '',
      });
    }
  }, [vendor]);

  if (!vendor) {
    return (
      <div className="page-container">
        <PageHeader title="Vendor Not Found" backTo="/vendors" />
        <p className="text-muted-foreground">This vendor does not exist.</p>
      </div>
    );
  }

  const handleSave = () => {
    if (!formData.vendor_name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Vendor name is required',
        variant: 'destructive',
      });
      return;
    }

    updateVendor(id!, {
      vendor_name: formData.vendor_name.trim(),
      phone: formData.phone.trim() || null,
      email: formData.email.trim() || null,
      notes: formData.notes.trim() || null,
    });

    toast({
      title: 'Vendor Updated',
      description: `${formData.vendor_name} has been updated`,
    });
    setIsEditing(false);
  };

  const handleDeactivate = () => {
    deactivateVendor(id!);
    toast({
      title: 'Vendor Deactivated',
      description: `${vendor.vendor_name} has been deactivated`,
    });
    navigate('/vendors');
  };

  const handleSavePolicy = () => {
    if (!vendor) return;
    upsertWarrantyPolicy(vendor.id, {
      default_labor_rate: policyForm.default_labor_rate ? Number(policyForm.default_labor_rate) : null,
      labor_coverage_percent: policyForm.labor_coverage_percent ? Number(policyForm.labor_coverage_percent) : null,
      parts_coverage_percent: policyForm.parts_coverage_percent ? Number(policyForm.parts_coverage_percent) : null,
      days_covered: policyForm.days_covered ? Number(policyForm.days_covered) : null,
      miles_covered: policyForm.miles_covered ? Number(policyForm.miles_covered) : null,
      requires_rma: policyForm.requires_rma,
      notes: policyForm.notes || null,
    });
    toast({ title: 'Warranty policy saved' });
  };

  const handleCreateClaim = () => {
    if (!vendor) return;
    const claim = createWarrantyClaim({ vendor_id: vendor.id });
    if (claim) navigate(`/warranty/${claim.id}`);
  };

  const handleCancel = () => {
    setFormData({
      vendor_name: vendor.vendor_name,
      phone: vendor.phone || '',
      email: vendor.email || '',
      notes: vendor.notes || '',
    });
    setIsEditing(false);
  };

  return (
    <div className="page-container">
      <PageHeader
        title={vendor.vendor_name}
        subtitle={vendor.is_active ? 'Active Vendor' : 'Inactive Vendor'}
        backTo="/vendors"
        actions={
          <>
            {isEditing ? (
              <>
                <Button variant="outline" onClick={handleCancel}>
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
                {vendor.is_active && (
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setShowDeactivateDialog(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Deactivate
                  </Button>
                )}
                <Button onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vendor Information */}
        <div className="form-section">
          <h2 className="text-lg font-semibold mb-4">Vendor Information</h2>
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="vendor_name">Vendor Name *</Label>
                <Input
                  id="vendor_name"
                  value={formData.vendor_name}
                  onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground">Phone:</span>
                <p className="font-medium">{vendor.phone || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Email:</span>
                <p className="font-medium">{vendor.email || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Notes:</span>
                <p className="font-medium">{vendor.notes || '-'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Created:</span>
                <p className="font-medium">{new Date(vendor.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          )}
        </div>

        {/* Related Parts */}
        <div className="form-section">
          <h2 className="text-lg font-semibold mb-4">Parts from this Vendor ({activeParts.length})</h2>
          <div className="table-container max-h-96 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part #</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">QOH</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeParts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No parts from this vendor
                    </TableCell>
                  </TableRow>
                ) : (
                  activeParts.map((part) => (
                    <TableRow
                      key={part.id}
                      className="cursor-pointer hover:bg-secondary/50"
                      onClick={() => navigate(`/inventory/${part.id}`)}
                    >
                      <TableCell className="font-mono">{part.part_number}</TableCell>
                      <TableCell>{part.description || '-'}</TableCell>
                      <TableCell className="text-right">{part.quantity_on_hand}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Warranty */}
      <div className="form-section mt-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Warranty Policy</h2>
          <Button size="sm" onClick={handleSavePolicy}>
            Save Policy
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <Label>Days Covered</Label>
            <Input
              value={policyForm.days_covered}
              onChange={(e) => setPolicyForm({ ...policyForm, days_covered: e.target.value })}
              placeholder="e.g., 180"
            />
          </div>
          <div>
            <Label>Miles Covered</Label>
            <Input
              value={policyForm.miles_covered}
              onChange={(e) => setPolicyForm({ ...policyForm, miles_covered: e.target.value })}
              placeholder="e.g., 50000"
            />
          </div>
          <div>
            <Label>Labor Coverage %</Label>
            <Input
              value={policyForm.labor_coverage_percent}
              onChange={(e) => setPolicyForm({ ...policyForm, labor_coverage_percent: e.target.value })}
              placeholder="e.g., 50"
            />
          </div>
          <div>
            <Label>Parts Coverage %</Label>
            <Input
              value={policyForm.parts_coverage_percent}
              onChange={(e) => setPolicyForm({ ...policyForm, parts_coverage_percent: e.target.value })}
              placeholder="e.g., 100"
            />
          </div>
          <div>
            <Label>Default Labor Rate</Label>
            <Input
              value={policyForm.default_labor_rate}
              onChange={(e) => setPolicyForm({ ...policyForm, default_labor_rate: e.target.value })}
              placeholder="e.g., 100"
            />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <Checkbox
              checked={policyForm.requires_rma}
              onCheckedChange={(checked) => setPolicyForm({ ...policyForm, requires_rma: !!checked })}
            />
            <span className="text-sm">Requires RMA</span>
          </div>
          <div className="md:col-span-2">
            <Label>Notes</Label>
            <Textarea
              value={policyForm.notes}
              onChange={(e) => setPolicyForm({ ...policyForm, notes: e.target.value })}
              rows={3}
            />
          </div>
        </div>
      </div>

      <div className="form-section mt-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">Warranty Claims</h2>
          <Button size="sm" onClick={handleCreateClaim}>
            <Plus className="w-4 h-4 mr-2" />
            Create Claim
          </Button>
        </div>
        {vendorClaims.length === 0 ? (
          <p className="text-sm text-muted-foreground">No warranty claims for this vendor.</p>
        ) : (
          <div className="space-y-2">
            {vendorClaims.map((claim) => (
              <div key={claim.id} className="flex items-center justify-between gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-mono">{claim.claim_number || claim.id}</span>
                  <StatusBadge status={claim.status} />
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate(`/warranty/${claim.id}`)}>
                  Open
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {isEditing && isMobile && (
        <div className="no-print">
          <MobileActionBar
            primary={
              <Button onClick={handleSave} className="flex-1">
                <Save className="w-4 h-4 mr-2" />
                Save
              </Button>
            }
            secondary={
              <Button variant="outline" onClick={() => setIsEditing(false)} className="flex-1">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            }
          />
          <MobileActionBarSpacer />
        </div>
      )}

      <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Vendor?</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate "{vendor.vendor_name}". The vendor will no longer be selectable for new parts.
              This action can be undone by reactivating the vendor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
