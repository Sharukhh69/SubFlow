import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi } from '../../api/invoices.api';
import { paymentsApi } from '../../api/payments.api';
import { Invoice, InvoiceStatus, PaymentMethod } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Drawer } from '../../components/ui/Drawer';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { DataTable, Column } from '../../components/ui/DataTable';
import { formatDate, formatINR } from '../../utils/formatters';
import {
  CreditCard,
  Printer,
  CheckCircle,
  XCircle,
  ArrowUpRight,
} from 'lucide-react';
import { toast } from 'sonner';

export const InvoicesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isPaymentDrawerOpen, setIsPaymentDrawerOpen] = useState(false);

  // Payment form state
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<PaymentMethod>(PaymentMethod.UPI);
  const [payRef, setPayRef] = useState<string>('');
  const [payNote, setPayNote] = useState<string>('');

  // Fetch Invoices
  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['invoices', page, statusFilter, search],
    queryFn: () =>
      invoicesApi.getAll({
        page,
        limit: 10,
        status: statusFilter ? (statusFilter as InvoiceStatus) : undefined,
        search: search || undefined,
      }),
  });

  // Confirm Invoice Mutation
  const confirmMutation = useMutation({
    mutationFn: invoicesApi.confirm,
    onSuccess: (updated) => {
      toast.success(`Invoice ${updated.number} confirmed!`);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Failed to confirm invoice.';
      toast.error(typeof msg === 'string' ? msg : msg[0]);
    },
  });

  // Cancel Invoice Mutation
  const cancelMutation = useMutation({
    mutationFn: invoicesApi.cancel,
    onSuccess: (updated) => {
      toast.success(`Invoice ${updated.number} cancelled.`);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Failed to cancel invoice.';
      toast.error(typeof msg === 'string' ? msg : msg[0]);
    },
  });

  // Record Payment Mutation
  const paymentMutation = useMutation({
    mutationFn: paymentsApi.recordPayment,
    onSuccess: () => {
      toast.success('Payment recorded and ledger updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
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
    setPayRef(`TXN-${Date.now().toString().slice(-6)}`);
    setPayNote('');
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
      note: payNote || undefined,
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

  const columns: Column<Invoice>[] = [
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
      header: 'Customer',
      cell: (inv) => (
        <div>
          <div style={{ fontWeight: 500 }}>{inv.snapshotCustomerName}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {inv.snapshotCustomerEmail}
          </div>
        </div>
      ),
    },
    {
      header: 'Due Date',
      cell: (inv) => (
        <span style={{ fontSize: '0.8125rem' }}>{formatDate(inv.dueDate)}</span>
      ),
    },
    {
      header: 'Grand Total',
      cell: (inv) => (
        <span style={{ fontWeight: 600 }}>{formatINR(inv.grandTotal)}</span>
      ),
    },
    {
      header: 'Payment Status',
      cell: (inv) => {
        const percentage = Math.min(100, Math.round((inv.amountPaid / (inv.grandTotal || 1)) * 100));
        return (
          <div style={{ minWidth: 120 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 4 }}>
              <span>{formatINR(inv.amountPaid)}</span>
              <span style={{ color: 'var(--text-muted)' }}>{percentage}%</span>
            </div>
            <div
              style={{
                width: '100%',
                height: 4,
                background: 'var(--bg-elevated)',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${percentage}%`,
                  height: '100%',
                  background: inv.status === InvoiceStatus.PAID ? 'var(--success)' : 'var(--primary)',
                }}
              />
            </div>
          </div>
        );
      },
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
          {inv.status === InvoiceStatus.DRAFT && (
            <button
              className="btn btn-secondary"
              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              title="Confirm Invoice"
              onClick={() => confirmMutation.mutate(inv.id)}
            >
              <CheckCircle size={14} color="#34d399" />
              Confirm
            </button>
          )}

          {inv.status === InvoiceStatus.CONFIRMED && (
            <button
              className="btn btn-primary"
              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              title="Record Payment"
              onClick={() => handleOpenPayment(inv)}
            >
              <CreditCard size={14} />
              Pay
            </button>
          )}

          <button
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            title="Print Template"
            onClick={() => handlePrint(inv.id)}
          >
            <Printer size={14} />
          </button>

          {inv.status === InvoiceStatus.CONFIRMED && (
            <button
              className="btn btn-ghost"
              style={{ padding: '4px 8px', fontSize: '0.75rem', color: 'var(--danger)' }}
              title="Cancel Invoice"
              onClick={() => cancelMutation.mutate(inv.id)}
            >
              <XCircle size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 className="h1">Invoice Ledger & Payments</h1>
        <p style={{ marginTop: 4 }}>
          Audit generated billing invoices, record partial or full settlements, and export receipts
        </p>
      </div>

      {/* Filters Toolbar */}
      <Card style={{ marginBottom: 20, padding: '14px 18px' }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <Input
              placeholder="Search by invoice number or customer name..."
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
              <option value="">All Invoice Statuses</option>
              {Object.values(InvoiceStatus).map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Invoices Table */}
      <DataTable
        columns={columns}
        data={invoicesData?.data || []}
        isLoading={isLoading}
        page={page}
        totalPages={invoicesData?.meta?.totalPages}
        onPageChange={setPage}
        emptyMessage="No invoices found."
      />

      {/* Payment Drawer */}
      <Drawer
        isOpen={isPaymentDrawerOpen}
        onClose={() => setIsPaymentDrawerOpen(false)}
        title={`Record Payment for ${selectedInvoice?.number}`}
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
                  Customer
                </span>
                <span style={{ fontWeight: 600 }}>{selectedInvoice.snapshotCustomerName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Total Invoice Amount
                </span>
                <span style={{ fontWeight: 600 }}>{formatINR(selectedInvoice.grandTotal)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  Already Paid
                </span>
                <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                  {formatINR(selectedInvoice.amountPaid)}
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  paddingTop: 8,
                  borderTop: '1px solid var(--border-default)',
                }}
              >
                <span style={{ fontWeight: 600 }}>Remaining Balance Due</span>
                <span style={{ fontWeight: 700, color: '#f87171' }}>
                  {formatINR(Math.max(0, selectedInvoice.grandTotal - selectedInvoice.amountPaid))}
                </span>
              </div>
            </div>

            <Input
              label="Payment Amount (₹) *"
              type="number"
              step="0.01"
              value={payAmount}
              onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
              required
            />

            <div className="input-group">
              <label className="label">Payment Channel / Method *</label>
              <select
                className="select"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
              >
                {Object.values(PaymentMethod).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Transaction / Reference Number"
              placeholder="e.g. UPI-REF-987654"
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
            />

            <Input
              label="Notes (Optional)"
              placeholder="Cheque clear date or client memo"
              value={payNote}
              onChange={(e) => setPayNote(e.target.value)}
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
                Record Payment
              </Button>
            </div>
          </form>
        )}
      </Drawer>
    </div>
  );
};
