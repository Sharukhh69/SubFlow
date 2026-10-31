import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { subscriptionsApi } from '../../api/subscriptions.api';
import { invoicesApi } from '../../api/invoices.api';
import { paymentsApi } from '../../api/payments.api';
import { catalogApi } from '../../api/catalog.api';
import { Subscription, Invoice, InvoiceStatus, PaymentMethod } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Drawer } from '../../components/ui/Drawer';
import { Modal } from '../../components/ui/Modal';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SubscriptionStepper } from '../../components/ui/SubscriptionStepper';
import { DataTable, Column } from '../../components/ui/DataTable';
import { formatDate, formatINR } from '../../utils/formatters';
import {
  CreditCard,
  Printer,
  Repeat,
  Receipt,
  UserCheck,
  Eye,
  ArrowUpRight,
} from 'lucide-react';
import { toast } from 'sonner';

export const CustomerPortalPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'subs' | 'invoices'>('subs');
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isPaymentDrawerOpen, setIsPaymentDrawerOpen] = useState(false);

  // Payment form state
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>(PaymentMethod.UPI);
  const [payRef, setPayRef] = useState<string>('');

  // Fetch current customer profile
  const { data: profile } = useQuery({
    queryKey: ['customers', 'me'],
    queryFn: catalogApi.getMyProfile,
  });

  // Fetch Customer's Subscriptions
  const { data: subsData, isLoading: isSubsLoading } = useQuery({
    queryKey: ['portal', 'subscriptions'],
    queryFn: () => subscriptionsApi.getAll({ limit: 50 }),
  });

  // Fetch Customer's Invoices
  const { data: invoicesData, isLoading: isInvoicesLoading } = useQuery({
    queryKey: ['portal', 'invoices'],
    queryFn: () => invoicesApi.getAll({ limit: 50 }),
  });

  // Pay mutation
  const paymentMutation = useMutation({
    mutationFn: paymentsApi.recordPayment,
    onSuccess: () => {
      toast.success('Payment recorded successfully! Thank you for your payment.');
      queryClient.invalidateQueries({ queryKey: ['portal', 'invoices'] });
      setIsPaymentDrawerOpen(false);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Payment recording failed.';
      toast.error(typeof msg === 'string' ? msg : msg[0]);
    },
  });

  const handleOpenPayment = (inv: Invoice) => {
    setSelectedInvoice(inv);
    const balance = Math.max(0, inv.grandTotal - inv.amountPaid);
    setPayAmount(balance);
    setPayMethod(PaymentMethod.UPI);
    setPayRef(`PORTAL-${Date.now().toString().slice(-6)}`);
    setIsPaymentDrawerOpen(true);
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    if (payAmount <= 0) {
      toast.error('Payment amount must be greater than zero.');
      return;
    }

    paymentMutation.mutate({
      invoiceId: selectedInvoice.id,
      amount: Number(payAmount),
      method: payMethod,
      referenceNumber: payRef || undefined,
      note: 'Self-service customer portal payment',
    });
  };

  const handlePrint = async (id: string) => {
    try {
      const html = await invoicesApi.getPrintHtml(id);
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.write(html);
        printWin.document.close();
        printWin.focus();
        printWin.print();
      }
    } catch {
      toast.error('Could not load invoice printable template.');
    }
  };

  // Sub Columns
  const subColumns: Column<Subscription>[] = [
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
      header: 'Start Date',
      cell: (sub) => formatDate(sub.startDate),
    },
    {
      header: 'Next Billing Date',
      cell: (sub) => (
        <span>{sub.nextBillingDate ? formatDate(sub.nextBillingDate) : '-'}</span>
      ),
    },
    {
      header: 'Action',
      align: 'right',
      cell: (sub) => (
        <button
          className="btn btn-secondary"
          style={{ padding: '4px 8px', fontSize: '0.75rem' }}
          onClick={() => setSelectedSub(sub)}
        >
          <Eye size={14} /> View
        </button>
      ),
    },
  ];

  // Invoice Columns
  const invoiceColumns: Column<Invoice>[] = [
    {
      header: 'Invoice #',
      accessorKey: 'number',
      cell: (inv) => (
        <span style={{ fontWeight: 600, color: 'var(--primary)', fontFamily: 'monospace' }}>
          {inv.number}
        </span>
      ),
    },
    {
      header: 'Billing Period',
      cell: (inv) => (
        <span style={{ fontSize: '0.8125rem' }}>
          {formatDate(inv.billingPeriodStart)} - {formatDate(inv.billingPeriodEnd)}
        </span>
      ),
    },
    {
      header: 'Total Due',
      cell: (inv) => (
        <span style={{ fontWeight: 600 }}>{formatINR(inv.grandTotal)}</span>
      ),
    },
    {
      header: 'Amount Paid',
      cell: (inv) => (
        <span style={{ color: 'var(--success)', fontWeight: 500 }}>
          {formatINR(inv.amountPaid)}
        </span>
      ),
    },
    {
      header: 'Status',
      cell: (inv) => <StatusBadge status={inv.status} type="invoice" />,
    },
    {
      header: 'Actions',
      align: 'right',
      cell: (inv) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          {inv.status === InvoiceStatus.CONFIRMED && inv.amountPaid < inv.grandTotal && (
            <button
              className="btn btn-primary"
              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              onClick={() => handleOpenPayment(inv)}
            >
              <CreditCard size={14} /> Pay
            </button>
          )}

          <button
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            title="Print Receipt"
            onClick={() => handlePrint(inv.id)}
          >
            <Printer size={14} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Customer Header Banner */}
      <Card style={{ marginBottom: 28, background: 'var(--bg-surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '1.25rem',
                fontWeight: 700,
              }}
            >
              <UserCheck size={24} />
            </div>
            <div>
              <h2 className="h2">{profile?.company || user?.name}</h2>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                {user?.email} {profile?.phone ? `• ${profile.phone}` : ''}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            {profile?.gstin && (
              <div style={{ textAlign: 'right' }}>
                <span className="label">GSTIN</span>
                <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{profile.gstin}</div>
              </div>
            )}
            <div style={{ textAlign: 'right' }}>
              <span className="label">Active Subscriptions</span>
              <div style={{ fontWeight: 700, color: '#34d399', fontSize: '1.15rem' }}>
                {subsData?.data?.filter((s) => s.status === 'ACTIVE').length || 0}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
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
            borderBottom: activeTab === 'subs' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'subs' ? '#fff' : 'var(--text-secondary)',
          }}
          onClick={() => setActiveTab('subs')}
        >
          <Repeat size={16} />
          My Subscriptions ({subsData?.data?.length || 0})
        </button>

        <button
          className="btn btn-ghost"
          style={{
            borderRadius: 0,
            borderBottom: activeTab === 'invoices' ? '2px solid var(--primary)' : '2px solid transparent',
            color: activeTab === 'invoices' ? '#fff' : 'var(--text-secondary)',
          }}
          onClick={() => setActiveTab('invoices')}
        >
          <Receipt size={16} />
          My Invoices & Payments ({invoicesData?.data?.length || 0})
        </button>
      </div>

      {/* Content */}
      {activeTab === 'subs' && (
        <DataTable
          columns={subColumns}
          data={subsData?.data || []}
          isLoading={isSubsLoading}
          emptyMessage="You have no active or pending subscriptions."
        />
      )}

      {activeTab === 'invoices' && (
        <DataTable
          columns={invoiceColumns}
          data={invoicesData?.data || []}
          isLoading={isInvoicesLoading}
          emptyMessage="No invoices generated for your account yet."
        />
      )}

      {/* Subscription Detail Modal */}
      <Modal
        isOpen={!!selectedSub}
        onClose={() => setSelectedSub(null)}
        title={`Subscription: ${selectedSub?.number}`}
      >
        {selectedSub && (
          <div>
            <SubscriptionStepper currentStatus={selectedSub.status} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, margin: '20px 0' }}>
              <div>
                <span className="label">Plan Name</span>
                <div style={{ fontWeight: 600 }}>{selectedSub.plan?.name}</div>
              </div>
              <div>
                <span className="label">Billing Interval</span>
                <div style={{ fontWeight: 600 }}>{selectedSub.plan?.billingPeriod}</div>
              </div>
              <div>
                <span className="label">Start Date</span>
                <div>{formatDate(selectedSub.startDate)}</div>
              </div>
              <div>
                <span className="label">Next Billing Date</span>
                <div>
                  {selectedSub.nextBillingDate ? formatDate(selectedSub.nextBillingDate) : 'Not scheduled'}
                </div>
              </div>
            </div>

            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 8 }}>Included Services</h4>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSub.lines?.map((line) => (
                    <tr key={line.id}>
                      <td>{line.product?.name || 'Service line'}</td>
                      <td>{line.quantity}</td>
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

      {/* Customer Payment Drawer */}
      <Drawer
        isOpen={isPaymentDrawerOpen}
        onClose={() => setIsPaymentDrawerOpen(false)}
        title={`Pay Invoice ${selectedInvoice?.number}`}
      >
        {selectedInvoice && (
          <form onSubmit={handlePaymentSubmit}>
            <div
              style={{
                background: 'var(--bg-elevated)',
                padding: 16,
                borderRadius: 'var(--radius-sm)',
                marginBottom: 20,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Total Invoice Amount
                </span>
                <span style={{ fontWeight: 600 }}>{formatINR(selectedInvoice.grandTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Remaining Due
                </span>
                <span style={{ fontWeight: 700, color: '#f87171' }}>
                  {formatINR(Math.max(0, selectedInvoice.grandTotal - selectedInvoice.amountPaid))}
                </span>
              </div>
            </div>

            <Input
              label="Amount to Pay (₹) *"
              type="number"
              step="0.01"
              value={payAmount}
              onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
              required
            />

            <div className="input-group">
              <label className="label">Payment Method *</label>
              <select
                className="select"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
              >
                <option value={PaymentMethod.UPI}>UPI (GPay / PhonePe / Paytm)</option>
                <option value={PaymentMethod.CARD}>Credit / Debit Card</option>
                <option value={PaymentMethod.BANK_TRANSFER}>Net Banking / IMPS</option>
              </select>
            </div>

            <Input
              label="Transaction UTR / Reference"
              placeholder="e.g. UPI-12345678"
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsPaymentDrawerOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={paymentMutation.isPending}
                icon={<ArrowUpRight size={16} />}
              >
                Confirm & Pay
              </Button>
            </div>
          </form>
        )}
      </Drawer>
    </div>
  );
};
