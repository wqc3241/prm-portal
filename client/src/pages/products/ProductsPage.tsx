import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productsApi } from '../../api/products';
import {
  PageHeader,
  SearchBar,
  StatusBadge,
  CardSkeleton,
} from '../../components/shared';
import { EmptyState } from '../../components/shared/EmptyState';
import { formatCurrency, humanize } from '../../utils/formatters';
import { cn } from '../../utils/cn';
import {
  Squares2X2Icon,
  ListBulletIcon,
  FunnelIcon,
  CubeIcon,
} from '@heroicons/react/24/outline';
import type { Product, ProductCategory, ProductQueryParams } from '../../types';

type ViewMode = 'grid' | 'list';

export function ProductsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(true);

  const params: ProductQueryParams = {
    page,
    per_page: 20,
    search: search || undefined,
    category_id: selectedCategory,
  };

  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['products', params],
    queryFn: async () => {
      const { data } = await productsApi.list(params);
      return data;
    },
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const { data } = await productsApi.getCategories();
      return data;
    },
  });

  const handleSearch = useCallback((query: string) => {
    setSearch(query);
    setPage(1);
  }, []);

  const products = productsData?.data ?? [];
  const categories = categoriesData?.data ?? [];
  const meta = productsData?.meta;

  return (
    <div>
      <PageHeader
        title="Product Catalog"
        subtitle="Browse available products and solutions"
        breadcrumbs={[{ label: 'Products' }]}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters((prev) => !prev)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium ring-1 ring-inset ring-gray-300 transition-colors',
                showFilters
                  ? 'bg-navy-50 text-panw-navy ring-navy-300'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              <FunnelIcon className="h-4 w-4" />
              Filters
            </button>
            <div className="flex rounded-md shadow-sm">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'inline-flex items-center rounded-l-md px-2.5 py-2 text-sm ring-1 ring-inset ring-gray-300',
                  viewMode === 'grid'
                    ? 'bg-panw-blue text-white ring-navy-900'
                    : 'bg-white text-gray-500 hover:bg-gray-50'
                )}
                aria-label="Grid view"
              >
                <Squares2X2Icon className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'inline-flex items-center rounded-r-md px-2.5 py-2 text-sm ring-1 ring-inset ring-gray-300',
                  viewMode === 'list'
                    ? 'bg-panw-blue text-white ring-navy-900'
                    : 'bg-white text-gray-500 hover:bg-gray-50'
                )}
                aria-label="List view"
              >
                <ListBulletIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        }
      />

      <div className="flex gap-6">
        {/* Category Sidebar */}
        {showFilters && (
          <aside className="w-56 flex-shrink-0 hidden md:block">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Categories
              </h3>
              <ul className="space-y-1">
                <li>
                  <button
                    onClick={() => {
                      setSelectedCategory(undefined);
                      setPage(1);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm rounded-md transition-colors',
                      !selectedCategory
                        ? 'bg-navy-50 text-panw-navy font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    )}
                  >
                    All Categories
                  </button>
                </li>
                {categories.map((cat: ProductCategory) => (
                  <li key={cat.id}>
                    <button
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setPage(1);
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 text-sm rounded-md transition-colors',
                        selectedCategory === cat.id
                          ? 'bg-navy-50 text-panw-navy font-medium'
                          : 'text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      {cat.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        )}

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Search */}
          <div className="mb-4">
            <SearchBar
              placeholder="Search products by name or SKU..."
              onSearch={handleSearch}
              className="max-w-md"
            />
          </div>

          {/* Loading */}
          {productsLoading && (
            <div
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
                  : 'space-y-3'
              }
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Empty */}
          {!productsLoading && products.length === 0 && (
            <EmptyState
              icon={CubeIcon}
              title="No products found"
              description={
                search
                  ? `No products match "${search}". Try a different search term.`
                  : 'No products are available in this category.'
              }
            />
          )}

          {/* Grid view */}
          {!productsLoading && products.length > 0 && viewMode === 'grid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product: Product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          {/* List view */}
          {!productsLoading && products.length > 0 && viewMode === 'list' && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
              {products.map((product: Product) => (
                <ProductRow key={product.id} product={product} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {meta && meta.total_pages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                Showing {(meta.page - 1) * meta.per_page + 1} to{' '}
                {Math.min(meta.page * meta.per_page, meta.total)} of{' '}
                {meta.total} products
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= meta.total_pages}
                  className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-50">
          <CubeIcon className="h-5 w-5 text-navy-600" />
        </div>
        <StatusBadge
          status={product.is_active ? 'active' : 'inactive'}
          variant={product.is_active ? 'success' : 'neutral'}
        />
      </div>

      <h3 className="text-sm font-semibold text-gray-900 mb-1 line-clamp-1">
        {product.name}
      </h3>
      <p className="text-xs text-gray-500 mb-2 font-mono">{product.sku}</p>

      {product.description && (
        <p className="text-xs text-gray-500 mb-3 line-clamp-2">
          {product.description}
        </p>
      )}

      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <span className="text-lg font-bold text-gray-900">
          {formatCurrency(product.list_price)}
        </span>
        <div className="flex gap-1.5">
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
            {humanize(product.product_type)}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
            {humanize(product.billing_cycle)}
          </span>
        </div>
      </div>
    </div>
  );
}

function ProductRow({ product }: { product: Product }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-50 flex-shrink-0">
        <CubeIcon className="h-5 w-5 text-navy-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {product.name}
        </p>
        <p className="text-xs text-gray-500 font-mono">{product.sku}</p>
      </div>
      <div className="hidden sm:flex gap-1.5">
        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
          {humanize(product.product_type)}
        </span>
        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
          {humanize(product.billing_cycle)}
        </span>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-gray-900">
          {formatCurrency(product.list_price)}
        </p>
      </div>
      <StatusBadge
        status={product.is_active ? 'active' : 'inactive'}
        variant={product.is_active ? 'success' : 'neutral'}
      />
    </div>
  );
}
