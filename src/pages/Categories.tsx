import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useRepos } from '@/repos';
import type { PartCategory } from '@/types';
import { QuickAddDialog } from '@/components/ui/quick-add-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ModuleHelpButton } from '@/components/help/ModuleHelpButton';

export default function Categories() {
  const navigate = useNavigate();
  const { categories, addCategory, updateCategory, deactivateCategory } = useRepos().categories;
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    category_name: '',
    description: '',
  });
  const hasAnyCategories = categories.length > 0;

  const columns: Column<PartCategory>[] = [
    { key: 'category_name', header: 'Category Name', sortable: true },
    { key: 'description', header: 'Description', sortable: true },
  ];

  const handleSave = () => {
    if (!formData.category_name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Category name is required',
        variant: 'destructive',
      });
      return;
    }

    addCategory({
      category_name: formData.category_name.trim(),
      description: formData.description.trim() || null,
    });

    toast({
      title: 'Category Created',
      description: `${formData.category_name} has been added`,
    });

    setDialogOpen(false);
    setFormData({ category_name: '', description: '' });
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Part Categories"
        subtitle="Organize your inventory by category"
        actions={
          <div className="flex items-center gap-2">
            <ModuleHelpButton moduleKey="part_categories" context={{ isEmpty: !hasAnyCategories }} />
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Category
            </Button>
          </div>
        }
      />

      <DataTable
        data={categories}
        columns={columns}
        searchKeys={['category_name', 'description']}
        searchPlaceholder="Search categories..."
        onRowClick={(category) => navigate(`/categories/${category.id}`)}
        emptyMessage="No categories found. Add your first category to get started."
      />

      <QuickAddDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Add New Category"
        onSave={handleSave}
        onCancel={() => setDialogOpen(false)}
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="category_name">Category Name *</Label>
            <Input
              id="category_name"
              value={formData.category_name}
              onChange={(e) => setFormData({ ...formData, category_name: e.target.value })}
              placeholder="Enter category name"
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Enter description"
              rows={2}
            />
          </div>
        </div>
      </QuickAddDialog>
    </div>
  );
}
