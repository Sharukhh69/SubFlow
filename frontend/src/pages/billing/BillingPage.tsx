import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { billingApi, BillingRunResult } from '../../api/billing.api';
import { BillingRun } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { DataTable, Column } from '../../components/ui/DataTable';
import { formatDateTime } from '../../utils/formatters';
import { Zap, Play, CheckCircle2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export const BillingPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [isDryRun, setIsDryRun] = useState(true);
  const [targetDate, setTargetDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [lastResult, setLastResult] = useState<BillingRunResult | null>(null);

  // Fetch past billing runs
  const { data: runs, isLoading } = useQuery({
    queryKey: ['billing', 'runs'],
    queryFn: () => billingApi.getRuns(20),
  });

  // Execute billing mutation
  const runMutation = useMutation({
    mutationFn: () => billingApi.runBilling({ isDryRun, targetDate }),
    onSuccess: (data) => {
      setLastResult(data);
      if (data.isDryRun) {
        toast.info(`Dry Run Completed: ${data.invoicesGenerated} invoices simulated`);
      } else {
        toast.success(`Production Billing Run Completed: ${data.invoicesGenerated} invoices generated!`);
      }
      queryClient.invalidateQueries({ queryKey: ['billing', 'runs'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Billing run failed to execute.';
      toast.error(typeof msg === 'string' ? msg : msg[0]);
    },
  });

  const columns: Column<BillingRun>[] = [
    {
      header: 'Run ID',
      accessorKey: 'id',
      cell: (run) => (
        <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
          {run.id.slice(0, 8)}...
        </span>
      ),
    },
    {
      header: 'Mode',
      cell: (run) => (
        <Badge variant={run.isDryRun ? 'warning' : 'success'}>
          {run.isDryRun ? 'Dry Run' : 'Production'}
        </Badge>
      ),
    },
    {
      header: 'Started At',
      cell: (run) => (
        <span style={{ fontSize: '0.8125rem' }}>{formatDateTime(run.startedAt)}</span>
      ),
    },
    {
      header: 'Processed',
      accessorKey: 'processed',
    },
    {
      header: 'Created',
      cell: (run) => (
        <span style={{ fontWeight: 600, color: 'var(--success)' }}>
          {run.created}
        </span>
      ),
    },
    {
      header: 'Skipped / Failed',
      cell: (run) => (
        <span style={{ color: run.failed > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
          {run.skipped} / {run.failed}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 className="h1">Recurring Billing Engine</h1>
        <p style={{ marginTop: 4 }}>
          Automated batch invoice generation, tax computation, and billing date progression
        </p>
      </div>

      {/* Control Console */}
      <Card style={{ marginBottom: 28, border: '1px solid var(--border-default)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
            }}
          >
            <Zap size={18} />
          </div>
          <div>
            <h3 className="h3">Trigger Billing Run</h3>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Idempotent processing using FOR UPDATE SKIP LOCKED
            </span>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr auto',
            gap: 16,
            alignItems: 'flex-end',
          }}
        >
          <Input
            label="Target Billing Date"
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            helperText="Invoices subscriptions due on or before this date"
          />

          <div className="input-group">
            <label className="label">Execution Mode</label>
            <div style={{ display: 'flex', gap: 10, height: 42, alignItems: 'center' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                <input
                  type="radio"
                  name="runMode"
                  checked={isDryRun}
                  onChange={() => setIsDryRun(true)}
                />
                Dry Run (Simulation)
              </label>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  color: !isDryRun ? '#f87171' : undefined,
                  fontWeight: !isDryRun ? 600 : 400,
                }}
              >
                <input
                  type="radio"
                  name="runMode"
                  checked={!isDryRun}
                  onChange={() => setIsDryRun(false)}
                />
                Production (Commit to DB)
              </label>
            </div>
          </div>

          <Button
            variant={isDryRun ? 'primary' : 'danger'}
            style={{ height: 42 }}
            isLoading={runMutation.isPending}
            onClick={() => runMutation.mutate()}
            icon={<Play size={16} />}
          >
            {isDryRun ? 'Simulate Billing' : 'Run Live Billing'}
          </Button>
        </div>
      </Card>

      {/* Last Result Banner */}
      {lastResult && (
        <Card
          style={{
            marginBottom: 28,
            background: lastResult.isDryRun ? 'var(--bg-elevated)' : 'rgba(16, 185, 129, 0.05)',
            border: `1px solid ${lastResult.isDryRun ? 'var(--warning)' : 'var(--success)'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {lastResult.isDryRun ? (
                <ShieldCheck size={20} color="var(--warning)" />
              ) : (
                <CheckCircle2 size={20} color="var(--success)" />
              )}
              <h3 className="h3">
                {lastResult.isDryRun ? 'Dry Run Output' : 'Live Execution Completed'}
              </h3>
            </div>
            <Badge variant={lastResult.isDryRun ? 'warning' : 'success'}>
              {lastResult.executionDurationMs} ms
            </Badge>
          </div>

          <div className="grid-cols-4">
            <div>
              <span className="label">Total Eligible Subscriptions</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {lastResult.totalEligible}
              </div>
            </div>
            <div>
              <span className="label">Invoices Generated</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)' }}>
                {lastResult.invoicesGenerated}
              </div>
            </div>
            <div>
              <span className="label">Invoices Failed</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: lastResult.invoicesFailed > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                {lastResult.invoicesFailed}
              </div>
            </div>
            <div>
              <span className="label">Execution Latency</span>
              <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                {lastResult.executionDurationMs} ms
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Historical Runs Table */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 className="h3">Execution Audit Log</h3>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Latest 20 batch runs recorded
          </span>
        </div>

        <DataTable
          columns={columns}
          data={runs || []}
          isLoading={isLoading}
          emptyMessage="No billing runs recorded yet."
        />
      </Card>
    </div>
  );
};
