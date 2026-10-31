import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { catalogApi } from '../../api/catalog.api';
import { Product, Plan, Tax, Discount, BillingPeriod } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import { formatINR } from '../../utils/formatters';
import {
  Package,
  Layers,
  Percent,
  Tag,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

export const CatalogPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'products' | 'plans' | 'taxes' | 'discounts'>('products');

  // Product modal state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [prodName, setProdName] = useState('');
  const [prodSalesPrice, setProdSalesPrice] = useState(0);
  const [prodCostPrice, setProdCostPrice] = useState(0);
  const [prodType, setProdType] = useState('SERVICE');

  // Plan modal state
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState(0);
  const [planPeriod, setPlanPeriod] = useState<BillingPeriod>(BillingPeriod.MONTHLY);
  const [planPausable, setPlanPausable] = useState(true);
  const [planClosable, setPlanClosable] = useState(true);

  // Queries
  const { data: productsData, isLoading: isProductsLoading } = useQuery({
    queryKey: ['catalog', 'products'],
    queryFn: () => catalogApi.getProducts({ limit: 50 }),
  });

  const { data: plansData, isLoading: isPlansLoading } = useQuery({
    queryKey: ['catalog', 'plans'],
    queryFn: () => catalogApi.getPlans(),
  });

  const { data: taxesData, isLoading: isTaxesLoading } = useQuery({
    queryKey: ['catalog', 'taxes'],
    queryFn: () => catalogApi.getTaxes(false),
  });

  const { data: discountsData, isLoading: isDiscountsLoading } = useQuery({
    queryKey: ['catalog', 'discounts'],
    queryFn: () => catalogApi.getDiscounts({ limit: 50 }),
  });

  // Create Product Mutation
  const createProductMutation = useMutation({
    mutationFn: catalogApi.createProduct,
    onSuccess: () => {
      toast.success('Product created successfully!');
      queryClient.invalidateQueries({ queryKey: ['catalog', 'products'] });
      setIsProductModalOpen(false);
      setProdName('');
      setProdSalesPrice(0);
      setProdCostPrice(0);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Failed to create product.';
      toast.error(typeof msg === 'string' ? msg : msg[0]);
    },
  });

  // Create Plan Mutation
  const createPlanMutation = useMutation({
    mutationFn: catalogApi.createPlan,
    onSuccess: () => {
      toast.success('Subscription plan created successfully!');
      queryClient.invalidateQueries({ queryKey: ['catalog', 'plans'] });
      setIsPlanModalOpen(false);
      setPlanName('');
      setPlanPrice(0);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Failed to create plan.';
      toast.error(typeof msg === 'string' ? msg : msg[0]);
    },
  });

  // Product Columns
  const productColumns: Column<Product>[] = [
    {
      header: 'Product Name',
      accessorKey: 'name',
      cell: (p) => <span style={{ fontWeight: 600 }}>{p.name}</span>,
    },
    {
      header: 'Type',
      cell: (p) => <Badge variant="default">{p.type}</Badge>,
    },
    {
      header: 'Sales Price',
      cell: (p) => formatINR(p.salesPrice),
    },
    {
      header: 'Variants',
      cell: (p) => (
        <div>
          {p.variants && p.variants.length > 0 ? (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {p.variants.map((v) => (
                <span
                  key={v.id}
                  style={{
                    fontSize: '0.75rem',
                    background: 'var(--bg-elevated)',
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  {v.attributeValue} (+{formatINR(v.extraPrice)})
                </span>
              ))}
            </div>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No variants</span>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (p) => (
        <Badge variant={p.isActive ? 'success' : 'danger'}>
          {p.isActive ? 'Active' : 'Archived'}
        </Badge>
      ),
    },
  ];

  // Plan Columns
  const planColumns: Column<Plan>[] = [
    {
      header: 'Plan Name',
      accessorKey: 'name',
      cell: (p) => <span style={{ fontWeight: 600 }}>{p.name}</span>,
    },
    {
      header: 'Billing Period',
      cell: (p) => <Badge variant="primary">{p.billingPeriod}</Badge>,
    },
    {
      header: 'Price',
      cell: (p) => (
        <span style={{ fontWeight: 600, color: '#34d399' }}>{formatINR(p.price)}</span>
      ),
    },
    {
      header: 'Controls',
      cell: (p) => (
        <div style={{ display: 'flex', gap: 6, fontSize: '0.75rem' }}>
          {p.pausable && <Badge variant="default">Pausable</Badge>}
          {p.closable && <Badge variant="default">Closable</Badge>}
          {p.renewable && <Badge variant="success">Renewable</Badge>}
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (p) => (
        <Badge variant={p.isActive ? 'success' : 'danger'}>
          {p.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  // Tax Columns
  const taxColumns: Column<Tax>[] = [
    {
      header: 'Tax Rule Name',
      accessorKey: 'name',
      cell: (t) => <span style={{ fontWeight: 600 }}>{t.name}</span>,
    },
    {
      header: 'Rate (%)',
      cell: (t) => (
        <Badge variant="info">
          {Number(t.rate)}%
        </Badge>
      ),
    },
    {
      header: 'Status',
      cell: (t) => (
        <Badge variant={t.isActive ? 'success' : 'danger'}>
          {t.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  // Discount Columns
  const discountColumns: Column<Discount>[] = [
    {
      header: 'Discount Code / Rule',
      accessorKey: 'name',
      cell: (d) => <span style={{ fontWeight: 600 }}>{d.name}</span>,
    },
    {
      header: 'Value',
      cell: (d) => (
        <span style={{ fontWeight: 600, color: 'var(--warning)' }}>
          {d.type === 'PERCENTAGE' ? `${d.value}% OFF` : `₹${d.value} OFF`}
        </span>
      ),
    },
    {
      header: 'Scope',
      cell: (d) => <Badge variant="default">{d.scope}</Badge>,
    },
    {
      header: 'Usage Count',
      cell: (d) => (
        <span>
          {d.usedCount} {d.usageLimit ? `/ ${d.usageLimit}` : 'times'}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h1 className="h1">Catalog & Pricing Architecture</h1>
          <p style={{ marginTop: 4 }}>
            Configure recurring plans, product variant matrices, tax rules, and promotional discounts
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {activeTab === 'products' && (
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => setIsProductModalOpen(true)}
            >
              Add Product
            </Button>
          )}
          {activeTab === 'plans' && (
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => setIsPlanModalOpen(true)}
            >
              Add Plan
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Bar */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: 20,
        }}
      >
        <button
          className="btn btn-ghost"
          style={{
            borderRadius: 0,
            borderBottom: activeTab === 'products' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'products' ? '#fff' : 'var(--text-secondary)',
          }}
          onClick={() => setActiveTab('products')}
        >
          <Package size={16} />
          Products & Variants ({productsData?.meta?.total || productsData?.data?.length || 0})
        </button>

        <button
          className="btn btn-ghost"
          style={{
            borderRadius: 0,
            borderBottom: activeTab === 'plans' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'plans' ? '#fff' : 'var(--text-secondary)',
          }}
          onClick={() => setActiveTab('plans')}
        >
          <Layers size={16} />
          Subscription Plans ({plansData?.length || 0})
        </button>

        <button
          className="btn btn-ghost"
          style={{
            borderRadius: 0,
            borderBottom: activeTab === 'taxes' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'taxes' ? '#fff' : 'var(--text-secondary)',
          }}
          onClick={() => setActiveTab('taxes')}
        >
          <Percent size={16} />
          Tax Rules ({taxesData?.length || 0})
        </button>

        <button
          className="btn btn-ghost"
          style={{
            borderRadius: 0,
            borderBottom: activeTab === 'discounts' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'discounts' ? '#fff' : 'var(--text-secondary)',
          }}
          onClick={() => setActiveTab('discounts')}
        >
          <Tag size={16} />
          Discounts ({discountsData?.data?.length || 0})
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'products' && (
        <DataTable
          columns={productColumns}
          data={productsData?.data || []}
          isLoading={isProductsLoading}
          emptyMessage="No products configured yet."
        />
      )}

      {activeTab === 'plans' && (
        <DataTable
          columns={planColumns}
          data={plansData || []}
          isLoading={isPlansLoading}
          emptyMessage="No subscription plans configured yet."
        />
      )}

      {activeTab === 'taxes' && (
        <DataTable
          columns={taxColumns}
          data={taxesData || []}
          isLoading={isTaxesLoading}
          emptyMessage="No tax rates configured."
        />
      )}

      {activeTab === 'discounts' && (
        <DataTable
          columns={discountColumns}
          data={discountsData?.data || []}
          isLoading={isDiscountsLoading}
          emptyMessage="No discount rules active."
        />
      )}

      {/* Create Product Modal */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title="Add Catalog Product"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createProductMutation.mutate({
              name: prodName,
              salesPrice: Number(prodSalesPrice),
              costPrice: Number(prodCostPrice),
              type: prodType,
              isActive: true,
            });
          }}
        >
          <Input
            label="Product Name *"
            placeholder="e.g. Enterprise Cloud Database"
            value={prodName}
            onChange={(e) => setProdName(e.target.value)}
            required
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input
              label="Sales Price (₹) *"
              type="number"
              value={prodSalesPrice}
              onChange={(e) => setProdSalesPrice(parseFloat(e.target.value) || 0)}
              required
            />
            <Input
              label="Cost Price (₹)"
              type="number"
              value={prodCostPrice}
              onChange={(e) => setProdCostPrice(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="input-group">
            <label className="label">Product Classification</label>
            <select
              className="select"
              value={prodType}
              onChange={(e) => setProdType(e.target.value)}
            >
              <option value="SERVICE">Service</option>
              <option value="CONSUMABLE">Consumable</option>
              <option value="STORABLE">Storable Product</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsProductModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={createProductMutation.isPending}
            >
              Create Product
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Plan Modal */}
      <Modal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        title="Create Subscription Billing Plan"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createPlanMutation.mutate({
              name: planName,
              price: Number(planPrice),
              billingPeriod: planPeriod,
              pausable: planPausable,
              closable: planClosable,
              renewable: true,
              autoClose: false,
              minQuantity: 1,
              isActive: true,
            });
          }}
        >
          <Input
            label="Plan Name *"
            placeholder="e.g. Pro Monthly Plan"
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            required
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input
              label="Base Recurring Price (₹) *"
              type="number"
              value={planPrice}
              onChange={(e) => setPlanPrice(parseFloat(e.target.value) || 0)}
              required
            />
            <div className="input-group">
              <label className="label">Billing Interval *</label>
              <select
                className="select"
                value={planPeriod}
                onChange={(e) => setPlanPeriod(e.target.value as BillingPeriod)}
              >
                {Object.values(BillingPeriod).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 20, margin: '14px 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                checked={planPausable}
                onChange={(e) => setPlanPausable(e.target.checked)}
              />
              Allow Pause
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem' }}>
              <input
                type="checkbox"
                checked={planClosable}
                onChange={(e) => setPlanClosable(e.target.checked)}
              />
              Allow Cancellation
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsPlanModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={createPlanMutation.isPending}
            >
              Create Plan
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
