import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../api/reports.api';
import { DashboardSummaryDto, MrrReportDto, AgingReportDto, RevenueTrendDto } from '../../types';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { Badge } from '../../components/ui/Badge';
import { formatINR, formatDateTime } from '../../utils/formatters';
import {
  TrendingUp,
  DollarSign,
  Repeat,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';

export const DashboardPage: React.FC = () => {
  const {
    data: summary,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
    isFetching: isSummaryFetching,
  } = useQuery<DashboardSummaryDto>({
    queryKey: ['reports', 'summary'],
    queryFn: () => reportsApi.getSummary(),
    staleTime: 60 * 1000,
  });

  const {
    data: mrrData,
    isLoading: isMrrLoading,
  } = useQuery<MrrReportDto>({
    queryKey: ['reports', 'mrr'],
    queryFn: () => reportsApi.getMrr(),
    staleTime: 60 * 1000,
  });

  const {
    data: agingData,
    isLoading: isAgingLoading,
  } = useQuery<AgingReportDto>({
    queryKey: ['reports', 'aging'],
    queryFn: () => reportsApi.getAging(),
    staleTime: 60 * 1000,
  });

  const {
    data: trendData,
    isLoading: isTrendLoading,
  } = useQuery<RevenueTrendDto>({
    queryKey: ['reports', 'revenue-trend'],
    queryFn: () => reportsApi.getRevenueTrend(6),
    staleTime: 60 * 1000,
  });

  return (
    <div>
      {/* Top Header & Actions */}
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
          <h1 className="h1">Executive Financial Dashboard</h1>
          <p style={{ marginTop: 4 }}>
            Real-time normalized revenue, collection metrics, and accounts receivable
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {summary && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Badge variant={summary.isCached ? 'info' : 'success'}>
                {summary.isCached ? '60s Cache Active' : 'Fresh Compute'}
              </Badge>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Updated {formatDateTime(summary.generatedAt)}
              </span>
            </div>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => refetchSummary()}
            disabled={isSummaryFetching}
          >
            <RefreshCw size={14} className={isSummaryFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid-cols-4" style={{ marginBottom: 28 }}>
        {/* KPI 1: Active Subscriptions */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              ACTIVE SUBSCRIPTIONS
            </span>
            <Repeat size={18} color="var(--primary)" />
          </div>
          <div style={{ marginTop: 12 }}>
            {isSummaryLoading ? (
              <Skeleton height={36} width={80} />
            ) : (
              <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>
                {summary?.activeSubscriptions ?? 0}
              </div>
            )}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Total active recurring accounts
            </span>
          </div>
        </Card>

        {/* KPI 2: MRR */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              NORMALIZED MRR
            </span>
            <DollarSign size={18} color="#10b981" />
          </div>
          <div style={{ marginTop: 12 }}>
            {isSummaryLoading ? (
              <Skeleton height={36} width={120} />
            ) : (
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#34d399' }}>
                {formatINR(summary?.mrr ?? 0)}
              </div>
            )}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Monthly recurring run-rate
            </span>
          </div>
        </Card>

        {/* KPI 3: ARR */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              ANNUAL RUN-RATE (ARR)
            </span>
            <TrendingUp size={18} color="#6366f1" />
          </div>
          <div style={{ marginTop: 12 }}>
            {isSummaryLoading ? (
              <Skeleton height={36} width={130} />
            ) : (
              <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>
                {formatINR(summary?.arr ?? 0)}
              </div>
            )}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Projected 12-month revenue
            </span>
          </div>
        </Card>

        {/* KPI 4: Overdue & Outstanding */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              ACCOUNTS RECEIVABLE
            </span>
            <AlertTriangle size={18} color="#ef4444" />
          </div>
          <div style={{ marginTop: 12 }}>
            {isSummaryLoading ? (
              <Skeleton height={36} width={120} />
            ) : (
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f87171' }}>
                {formatINR(summary?.totalOutstanding ?? 0)}
              </div>
            )}
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {summary?.overdueInvoicesCount ?? 0} overdue invoices pending
            </span>
          </div>
        </Card>
      </div>

      {/* Main Charts Grid */}
      <div className="grid-cols-2" style={{ marginBottom: 28 }}>
        {/* Chart 1: 6-Month Revenue Trend */}
        <Card>
          <h3 className="h3" style={{ marginBottom: 4 }}>
            Revenue Trend (Last 6 Months)
          </h3>
          <p style={{ fontSize: '0.8125rem', marginBottom: 20 }}>
            Invoiced billing commitments vs. actual collected payments
          </p>

          <div style={{ height: 300, width: '100%' }}>
            {isTrendLoading ? (
              <Skeleton height={280} />
            ) : trendData?.months && trendData.months.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData.months}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f293d" />
                  <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                  <YAxis
                    stroke="#6b7280"
                    fontSize={12}
                    tickFormatter={(val) => `₹${val / 1000}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 8,
                    }}
                    formatter={(value: any) => [formatINR(Number(value)), '']}
                  />
                  <Legend />
                  <Bar dataKey="invoicedRevenue" name="Invoiced" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="collectedRevenue" name="Collected" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                No revenue trend data recorded yet.
              </div>
            )}
          </div>
        </Card>

        {/* Chart 2: Aging Breakdown Buckets */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <h3 className="h3">A/R Aging Analysis</h3>
            <Badge variant="warning">
              Total Overdue: {formatINR(agingData?.totalOverdueAmount ?? 0)}
            </Badge>
          </div>
          <p style={{ fontSize: '0.8125rem', marginBottom: 20 }}>
            Categorized risk exposure by days past payment due date
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {isAgingLoading ? (
              <>
                <Skeleton height={42} />
                <Skeleton height={42} />
                <Skeleton height={42} />
                <Skeleton height={42} />
              </>
            ) : agingData?.buckets ? (
              agingData.buckets.map((b) => {
                const total = agingData.totalOverdueAmount || 1;
                const percentage = Math.round((b.totalAmount / total) * 100);

                let color = '#34d399';
                if (b.bucket === '31-60') color = '#fbbf24';
                if (b.bucket === '61-90') color = '#f97316';
                if (b.bucket === '90+') color = '#ef4444';

                return (
                  <div
                    key={b.bucket}
                    style={{
                      background: 'var(--bg-elevated)',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-sm)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{b.label}</span>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                          {b.invoiceCount} invoices
                        </span>
                        <span style={{ fontWeight: 700, fontSize: '0.875rem', color }}>
                          {formatINR(b.totalAmount)}
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: 6,
                        background: 'rgba(255,255,255,0.06)',
                        borderRadius: 3,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${percentage}%`,
                          height: '100%',
                          background: color,
                          borderRadius: 3,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            ) : null}
          </div>
        </Card>
      </div>

      {/* Plan MRR Breakdown Table */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 className="h3">Plan Distribution & Contribution</h3>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Total MRR: <strong style={{ color: '#34d399' }}>{formatINR(mrrData?.totalMrr ?? 0)}</strong>
          </span>
        </div>

        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Plan Name</th>
                <th>Billing Period</th>
                <th>Active Subscriptions</th>
                <th>Monthly Contribution (MRR)</th>
                <th>Annual Run-Rate (ARR)</th>
              </tr>
            </thead>
            <tbody>
              {isMrrLoading ? (
                <tr>
                  <td colSpan={5}>
                    <Skeleton height={24} />
                  </td>
                </tr>
              ) : mrrData?.byPlan && mrrData.byPlan.length > 0 ? (
                mrrData.byPlan.map((p) => (
                  <tr key={p.planId}>
                    <td style={{ fontWeight: 600 }}>{p.planName}</td>
                    <td>
                      <Badge variant="primary">{p.billingPeriod}</Badge>
                    </td>
                    <td>{p.activeSubscriptionsCount}</td>
                    <td style={{ fontWeight: 600, color: '#34d399' }}>
                      {formatINR(p.totalMrr)}
                    </td>
                    <td style={{ fontWeight: 600 }}>{formatINR(p.totalArr)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    No subscription plans active yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
