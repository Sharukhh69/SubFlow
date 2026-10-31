import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionsApi } from '../../api/subscriptions.api';
import { catalogApi } from '../../api/catalog.api';
import { Subscription, SubscriptionStatus, PaymentTerms } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SubscriptionStepper } from '../../components/ui/SubscriptionStepper';
import { DataTable, Column } from '../../components/ui/DataTable';
import { formatDate, formatINR } from '../../utils/formatters';
import {
  Plus,
  ArrowRight,
  Eye,
  Play,
  Pause,
  XCircle,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';

export const SubscriptionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form state for creating from template
  const [templateId, setTemplateId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>(PaymentTerms.NET_30);

  // Fetch Subscriptions
  const { data: subsData, isLoading } = useQuery({
    queryKey: ['subscriptions', page, statusFilter, search],
    queryFn: () =>
      subscriptionsApi.getAll({
        page,
        limit: 10,
        status: statusFilter ? (statusFilter as SubscriptionStatus) : undefined,
        search: search || undefined,
      }),
  });

  // Fetch Templates and Customers for creation modal
  const { data: templates } = useQuery({
    queryKey: ['quotation-templates'],
    queryFn: () => catalogApi.getQuotationTemplates({ limit: 100 }),
    enabled: isCreateModalOpen,
  });

  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => catalogApi.getCustomers({ limit: 100 }),
    enabled: isCreateModalOpen,
  });

  // Transition Mutation
  const transitionMutation = useMutation({
    mutationFn: ({ id, targetStatus, reason }: { id: string; targetStatus: SubscriptionStatus; reason?: string }) =>
      subscriptionsApi.transition(id, targetStatus, reason),
    onSuccess: (updatedSub) => {
      toast.success(`Subscription moved to ${updatedSub.status}`);
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      setSelectedSub(updatedSub);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Transition failed.';
      toast.error(typeof msg === 'string' ? msg : msg[0]);
    },
  });

  // Create from Template Mutation
  const createMutation = useMutation({
    mutationFn: subscriptionsApi.createFromTemplate,
    onSuccess: () => {
      toast.success('Subscription quotation created successfully!');
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      setIsCreateModalOpen(false);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Failed to create subscription.';
      toast.error(typeof msg === 'string' ? msg : msg[0]);
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateId || !customerId) {
      toast.error('Please select both a quotation template and a customer.');
      return;
    }
    createMutation.mutate({
      templateId,
      customerId,
      startDate,
      paymentTerms,
    });
  };

  const handleOpenDetail = (sub: Subscription) => {
    setSelectedSub(sub);
    setIsDetailModalOpen(true);
  };

  const columns: Column<Subscription>[] = [
    {
      header: 'Sub Number',
      accessorKey: 'number',
      cell: (sub) => (
        <span style={{ fontWeight: 600, color: 'var(--primary)', fontFamily: 'monospace' }}>
          {sub.number}
        </span>
      ),
    },
    {
      header: 'Customer',
      cell: (sub) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            {sub.customer?.user?.name || sub.customer?.company || 'Direct Account'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {sub.customer?.user?.email}
          </div>
        </div>
      ),
    },
    {
      header: 'Plan',
      cell: (sub) => (
        <div>
          <div style={{ fontWeight: 500 }}>{sub.plan?.name}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {sub.plan?.billingPeriod} • {formatINR(sub.plan?.price || 0)}
          </div>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (sub) => <StatusBadge status={sub.status} type="subscription" />,
    },
    {
      header: 'Next Billing',
      cell: (sub) => (
        <span style={{ fontSize: '0.8125rem' }}>
          {sub.nextBillingDate ? formatDate(sub.nextBillingDate) : '-'}
        </span>
      ),
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (sub) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <button
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenDetail(sub);
            }}
          >
            <Eye size={14} />
            View
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Page Title & New Sub Button */}
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
          <h1 className="h1">Subscriptions & Quotations</h1>
          <p style={{ marginTop: 4 }}>
            Manage recurring contracts, transition lifecycle states, and issue quotations
          </p>
        </div>

        <Button
          variant="primary"
          icon={<Plus size={16} />}
          onClick={() => setIsCreateModalOpen(true)}
        >
          New from Template
        </Button>
      </div>

      {/* Filters Toolbar */}
      <Card style={{ marginBottom: 20, padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <Input
              placeholder="Search by subscription number or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ marginBottom: 0 }}
            />
          </div>

          <div style={{ width: 180 }}>
            <select
              className="select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              {Object.values(SubscriptionStatus).map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={subsData?.data || []}
        isLoading={isLoading}
        onRowClick={handleOpenDetail}
        page={page}
        totalPages={subsData?.meta?.totalPages}
        onPageChange={setPage}
        emptyMessage="No subscriptions match your query."
      />

      {/* Create from Template Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Subscription from Template"
      >
        <form onSubmit={handleCreateSubmit}>
          <div className="input-group">
            <label className="label">Quotation Template *</label>
            <select
              className="select"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              required
            >
              <option value="">Select a pre-configured template...</option>
              {templates?.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.plan?.name} - {t.plan?.billingPeriod})
                </option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label className="label">Customer Profile *</label>
            <select
              className="select"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
            >
              <option value="">Select customer account...</option>
              {customers?.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.user?.name || c.company} ({c.user?.email})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input
              label="Start Date *"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <div className="input-group">
              <label className="label">Payment Terms</label>
              <select
                className="select"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value as PaymentTerms)}
              >
                {Object.values(PaymentTerms).map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={createMutation.isPending}
            >
              Create Quotation
            </Button>
          </div>
        </form>
      </Modal>

      {/* Subscription Detail & Lifecycle Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={`Subscription Details: ${selectedSub?.number}`}
        maxWidth={720}
      >
        {selectedSub && (
          <div>
            {/* 5-Step Stepper */}
            <SubscriptionStepper currentStatus={selectedSub.status} />

            {/* Quick Transition Action Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-sm)',
                margin: '16px 0',
              }}
            >
              <div>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Current Status:{' '}
                </span>
                <StatusBadge status={selectedSub.status} type="subscription" />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                {selectedSub.status === SubscriptionStatus.DRAFT && (
                  <Button
                    variant="primary"
                    style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                    icon={<Send size={14} />}
                    isLoading={transitionMutation.isPending}
                    onClick={() =>
                      transitionMutation.mutate({
                        id: selectedSub.id,
                        targetStatus: SubscriptionStatus.QUOTATION,
                      })
                    }
                  >
                    Send Quotation
                  </Button>
                )}

                {selectedSub.status === SubscriptionStatus.QUOTATION && (
                  <Button
                    variant="primary"
                    style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                    icon={<ArrowRight size={14} />}
                    isLoading={transitionMutation.isPending}
                    onClick={() =>
                      transitionMutation.mutate({
                        id: selectedSub.id,
                        targetStatus: SubscriptionStatus.CONFIRMED,
                      })
                    }
                  >
                    Confirm Order
                  </Button>
                )}

                {selectedSub.status === SubscriptionStatus.CONFIRMED && (
                  <Button
                    variant="primary"
                    style={{ padding: '6px 12px', fontSize: '0.75rem', background: 'var(--success)' }}
                    icon={<Play size={14} />}
                    isLoading={transitionMutation.isPending}
                    onClick={() =>
                      transitionMutation.mutate({
                        id: selectedSub.id,
                        targetStatus: SubscriptionStatus.ACTIVE,
                      })
                    }
                  >
                    Activate Subscription
                  </Button>
                )}

                {selectedSub.status === SubscriptionStatus.ACTIVE && (
                  <>
                    <Button
                      variant="secondary"
                      style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                      icon={<Pause size={14} />}
                      isLoading={transitionMutation.isPending}
                      onClick={() =>
                        transitionMutation.mutate({
                          id: selectedSub.id,
                          targetStatus: SubscriptionStatus.PAUSED,
                        })
                      }
                    >
                      Pause
                    </Button>
                    <Button
                      variant="danger"
                      style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                      icon={<XCircle size={14} />}
                      isLoading={transitionMutation.isPending}
                      onClick={() =>
                        transitionMutation.mutate({
                          id: selectedSub.id,
                          targetStatus: SubscriptionStatus.CLOSED,
                          reason: 'Closed by user request',
                        })
                      }
                    >
                      Close
                    </Button>
                  </>
                )}

                {selectedSub.status === SubscriptionStatus.PAUSED && (
                  <Button
                    variant="primary"
                    style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                    icon={<Play size={14} />}
                    isLoading={transitionMutation.isPending}
                    onClick={() =>
                      transitionMutation.mutate({
                        id: selectedSub.id,
                        targetStatus: SubscriptionStatus.ACTIVE,
                      })
                    }
                  >
                    Resume
                  </Button>
                )}
              </div>
            </div>

            {/* Sub Meta Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              <div>
                <span className="label">Customer</span>
                <div style={{ fontWeight: 600 }}>
                  {selectedSub.customer?.user?.name || selectedSub.customer?.company || '-'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {selectedSub.customer?.user?.email}
                </div>
              </div>
              <div>
                <span className="label">Plan & Interval</span>
                <div style={{ fontWeight: 600 }}>{selectedSub.plan?.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {selectedSub.plan?.billingPeriod} • Terms: {selectedSub.paymentTerms}
                </div>
              </div>
              <div>
                <span className="label">Start Date</span>
                <div style={{ fontWeight: 500 }}>{formatDate(selectedSub.startDate)}</div>
              </div>
              <div>
                <span className="label">Next Billing Date</span>
                <div style={{ fontWeight: 500 }}>
                  {selectedSub.nextBillingDate ? formatDate(selectedSub.nextBillingDate) : 'Not scheduled'}
                </div>
              </div>
            </div>

            {/* Line Items */}
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 8 }}>
              Subscription Products & Lines
            </h4>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Variant</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSub.lines?.map((line) => (
                    <tr key={line.id}>
                      <td style={{ fontWeight: 500 }}>{line.product?.name || 'Line Item'}</td>
                      <td>
                        {line.variant ? (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {line.variant.attributeName}: {line.variant.attributeValue}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>{line.quantity}</td>
                      <td>{formatINR(line.unitPrice)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {formatINR(line.lineAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
