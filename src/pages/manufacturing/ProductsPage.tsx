import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import type { ManufacturedProduct } from '@/types';
import { useManufacturedProducts } from '@/hooks/useManufacturing';
import { ModuleHelpButton } from '@/components/help/ModuleHelpButton';

const toNumber = (value: number | string | null | undefined) => {
  const numeric = typeof value === 'number' ? value : value != null ? Number(value) : NaN;
  return Number.isFinite(numeric) ? numeric : 0;
};

export default function ManufacturingProductsPage() {
  const navigate = useNavigate();
  const { data: products, isLoading } = useManufacturedProducts();

  const columns: Column<ManufacturedProduct>[] = useMemo(
    () => [
      { key: 'sku', header: 'SKU', sortable: true },
      { key: 'name', header: 'Name', sortable: true },
      {
        key: 'product_type',
        header: 'Type',
        sortable: true,
        render: (product) => product.product_type.replace('_', ' '),
      },
      {
        key: 'base_price',
        header: 'Base Price',
        sortable: true,
        render: (product) => `$${toNumber(product.base_price).toFixed(2)}`,
      },
      {
        key: 'is_active',
        header: 'Active',
        render: (product) => (product.is_active ? 'Yes' : 'No'),
      },
    ],
    []
  );

  return (
    <div className="page-container">
      <PageHeader
        title="Manufactured Products"
        subtitle="Manage dump bodies, trailers, and custom equipment"
        actions={
          <>
            <ModuleHelpButton moduleKey="manufacturing" />
            <Button onClick={() => navigate('/manufacturing/products/new')}>
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </>
        }
      />

      <DataTable
        data={products ?? []}
        columns={columns}
        searchKeys={['sku', 'name']}
        searchPlaceholder="Search products..."
        onRowClick={(product) => navigate(`/manufacturing/products/${product.id}`)}
        emptyMessage={isLoading ? 'Loading products...' : 'No products yet'}
      />
    </div>
  );
}
