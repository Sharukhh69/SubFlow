import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReportsService } from './reports.service';
import { RevenueCalculationService } from './revenue-calculation.service';
import { BillingPeriod, InvoiceStatus, SubscriptionStatus, Prisma } from '@prisma/client';

describe('ReportsModule', () => {
  let reportsService: ReportsService;
  let calculationService: RevenueCalculationService;
  let mockPrisma: any;

  beforeEach(() => {
    calculationService = new RevenueCalculationService();

    mockPrisma = {
      subscription: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      payment: {
        aggregate: vi.fn(),
      },
      invoice: {
        findMany: vi.fn(),
        aggregate: vi.fn(),
      },
    };

    reportsService = new ReportsService(mockPrisma, calculationService);
  });

  describe('RevenueCalculationService', () => {
    it('should normalize daily subscription to monthly MRR (x30)', () => {
      const result = calculationService.normalizeToMonthly(100, BillingPeriod.DAILY);
      expect(result).toBe(3000);
    });

    it('should normalize weekly subscription to monthly MRR (x52/12)', () => {
      const result = calculationService.normalizeToMonthly(120, BillingPeriod.WEEKLY);
      // 120 * (52 / 12) = 520
      expect(result).toBe(520);
    });

    it('should normalize monthly subscription to monthly MRR (1:1)', () => {
      const result = calculationService.normalizeToMonthly(1500, BillingPeriod.MONTHLY);
      expect(result).toBe(1500);
    });

    it('should normalize yearly subscription to monthly MRR (/12)', () => {
      const result = calculationService.normalizeToMonthly(12000, BillingPeriod.YEARLY);
      expect(result).toBe(1000);
    });

    it('should handle zero or negative amounts gracefully', () => {
      expect(calculationService.normalizeToMonthly(0, BillingPeriod.MONTHLY)).toBe(0);
      expect(calculationService.normalizeToMonthly(-50, BillingPeriod.MONTHLY)).toBe(0);
    });

    it('should accurately calculate ARR as 12x MRR', () => {
      const arr = calculationService.calculateArr(2500.5);
      expect(arr).toBe(30006);
    });

    it('should correctly classify aging buckets', () => {
      expect(calculationService.classifyAgingBucket(15)).toEqual({
        bucket: '0-30',
        label: '0 to 30 Days',
      });
      expect(calculationService.classifyAgingBucket(30)).toEqual({
        bucket: '0-30',
        label: '0 to 30 Days',
      });
      expect(calculationService.classifyAgingBucket(45)).toEqual({
        bucket: '31-60',
        label: '31 to 60 Days',
      });
      expect(calculationService.classifyAgingBucket(60)).toEqual({
        bucket: '31-60',
        label: '31 to 60 Days',
      });
      expect(calculationService.classifyAgingBucket(75)).toEqual({
        bucket: '61-90',
        label: '61 to 90 Days',
      });
      expect(calculationService.classifyAgingBucket(90)).toEqual({
        bucket: '61-90',
        label: '61 to 90 Days',
      });
      expect(calculationService.classifyAgingBucket(120)).toEqual({
        bucket: '90+',
        label: '90+ Days',
      });
    });

    it('should compute days past due ignoring timestamp components', () => {
      const asOf = new Date('2026-10-31T15:00:00Z');
      const due1 = new Date('2026-10-21T08:00:00Z');
      expect(calculationService.calculateDaysPastDue(due1, asOf)).toBe(10);

      // Future due date returns 0
      const futureDue = new Date('2026-11-15T00:00:00Z');
      expect(calculationService.calculateDaysPastDue(futureDue, asOf)).toBe(0);
    });
  });

  describe('ReportsService - getExecutiveSummary', () => {
    it('should compute dashboard summary correctly and populate in-memory cache', async () => {
      mockPrisma.subscription.count.mockResolvedValue(2);
      mockPrisma.subscription.findMany.mockResolvedValue([
        {
          plan: { billingPeriod: BillingPeriod.MONTHLY },
          lines: [{ lineAmount: new Prisma.Decimal(1000) }],
        },
        {
          plan: { billingPeriod: BillingPeriod.YEARLY },
          lines: [{ lineAmount: new Prisma.Decimal(24000) }],
        },
      ]);
      mockPrisma.payment.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal(50000) },
      });
      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          grandTotal: new Prisma.Decimal(1000),
          amountPaid: new Prisma.Decimal(400),
          dueDate: new Date('2026-09-01'), // overdue
        },
        {
          grandTotal: new Prisma.Decimal(2000),
          amountPaid: new Prisma.Decimal(2000), // fully paid
          dueDate: new Date('2026-09-01'),
        },
        {
          grandTotal: new Prisma.Decimal(3000),
          amountPaid: new Prisma.Decimal(0),
          dueDate: new Date('2026-12-31'), // not overdue yet
        },
      ]);

      const result = await reportsService.getExecutiveSummary();

      expect(result.activeSubscriptions).toBe(2);
      // Monthly 1000 + Yearly 24000/12 (2000) = 3000 MRR
      expect(result.mrr).toBe(3000);
      expect(result.arr).toBe(36000);
      expect(result.totalRevenueCollected).toBe(50000);
      // Outstanding: (1000 - 400) + (3000 - 0) = 3600
      expect(result.totalOutstanding).toBe(3600);
      // Overdue invoices: only 1 overdue confirmed with remaining balance
      expect(result.overdueInvoicesCount).toBe(1);
      expect(result.isCached).toBe(false);

      // Verify Cache Hit on subsequent call
      const cachedResult = await reportsService.getExecutiveSummary();
      expect(cachedResult.isCached).toBe(true);
      expect(cachedResult.mrr).toBe(3000);
      // Prisma shouldn't be called again
      expect(mockPrisma.subscription.count).toHaveBeenCalledTimes(1);
    });
  });

  describe('ReportsService - getMrrBreakdown', () => {
    it('should break down MRR by plan and billing period', async () => {
      mockPrisma.subscription.findMany.mockResolvedValue([
        {
          id: 'sub_1',
          planId: 'plan_monthly',
          plan: {
            id: 'plan_monthly',
            name: 'Basic Monthly',
            billingPeriod: BillingPeriod.MONTHLY,
          },
          lines: [{ lineAmount: new Prisma.Decimal(500) }],
        },
        {
          id: 'sub_2',
          planId: 'plan_yearly',
          plan: {
            id: 'plan_yearly',
            name: 'Enterprise Yearly',
            billingPeriod: BillingPeriod.YEARLY,
          },
          lines: [{ lineAmount: new Prisma.Decimal(12000) }],
        },
      ]);

      const report = await reportsService.getMrrBreakdown();

      // MRR: 500 + 1000 = 1500; ARR: 18000
      expect(report.totalMrr).toBe(1500);
      expect(report.totalArr).toBe(18000);
      expect(report.activeSubscriptionsCount).toBe(2);
      expect(report.byPlan).toHaveLength(2);
      expect(report.byPeriod.length).toBeGreaterThanOrEqual(2);

      const monthlyPlan = report.byPlan.find((p) => p.planId === 'plan_monthly');
      expect(monthlyPlan?.totalMrr).toBe(500);
      expect(monthlyPlan?.totalArr).toBe(6000);

      const yearlyPlan = report.byPlan.find((p) => p.planId === 'plan_yearly');
      expect(yearlyPlan?.totalMrr).toBe(1000);
      expect(yearlyPlan?.totalArr).toBe(12000);
    });
  });

  describe('ReportsService - getAgingReport', () => {
    it('should aggregate overdue invoices into 0-30, 31-60, 61-90, 90+ buckets', async () => {
      const now = new Date();
      const createPastDate = (daysAgo: number) => {
        const d = new Date(now);
        d.setDate(d.getDate() - daysAgo);
        return d;
      };

      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv_10d',
          number: 'INV-1',
          snapshotCustomerName: 'Alpha Corp',
          dueDate: createPastDate(10),
          grandTotal: new Prisma.Decimal(1000),
          amountPaid: new Prisma.Decimal(0),
        },
        {
          id: 'inv_45d',
          number: 'INV-2',
          snapshotCustomerName: 'Beta LLC',
          dueDate: createPastDate(45),
          grandTotal: new Prisma.Decimal(2500),
          amountPaid: new Prisma.Decimal(500), // balance 2000
        },
        {
          id: 'inv_75d',
          number: 'INV-3',
          snapshotCustomerName: 'Gamma Inc',
          dueDate: createPastDate(75),
          grandTotal: new Prisma.Decimal(3000),
          amountPaid: new Prisma.Decimal(0),
        },
        {
          id: 'inv_120d',
          number: 'INV-4',
          snapshotCustomerName: 'Delta Ltd',
          dueDate: createPastDate(120),
          grandTotal: new Prisma.Decimal(5000),
          amountPaid: new Prisma.Decimal(1000), // balance 4000
        },
        {
          id: 'inv_future',
          number: 'INV-5',
          snapshotCustomerName: 'Future Co',
          dueDate: new Date(now.getTime() + 5 * 24 * 3600 * 1000), // future
          grandTotal: new Prisma.Decimal(9999),
          amountPaid: new Prisma.Decimal(0),
        },
      ]);

      const aging = await reportsService.getAgingReport();

      // Overdue balances: 1000 (0-30) + 2000 (31-60) + 3000 (61-90) + 4000 (90+) = 10000
      expect(aging.totalOverdueAmount).toBe(10000);
      expect(aging.totalOverdueCount).toBe(4);

      const b0_30 = aging.buckets.find((b) => b.bucket === '0-30');
      expect(b0_30?.invoiceCount).toBe(1);
      expect(b0_30?.totalAmount).toBe(1000);

      const b31_60 = aging.buckets.find((b) => b.bucket === '31-60');
      expect(b31_60?.invoiceCount).toBe(1);
      expect(b31_60?.totalAmount).toBe(2000);

      const b61_90 = aging.buckets.find((b) => b.bucket === '61-90');
      expect(b61_90?.invoiceCount).toBe(1);
      expect(b61_90?.totalAmount).toBe(3000);

      const b90_plus = aging.buckets.find((b) => b.bucket === '90+');
      expect(b90_plus?.invoiceCount).toBe(1);
      expect(b90_plus?.totalAmount).toBe(4000);
    });
  });

  describe('ReportsService - getRevenueTrend', () => {
    it('should return historical trends for the specified number of months', async () => {
      mockPrisma.payment.aggregate.mockResolvedValue({
        _sum: { amount: new Prisma.Decimal(15000) },
        _count: { id: 3 },
      });
      mockPrisma.invoice.aggregate.mockResolvedValue({
        _sum: { grandTotal: new Prisma.Decimal(20000) },
        _count: { id: 4 },
      });

      const trend = await reportsService.getRevenueTrend(3);

      expect(trend.months).toHaveLength(3);
      expect(trend.totalCollected).toBe(45000); // 15000 * 3
      expect(trend.totalInvoiced).toBe(60000); // 20000 * 3
    });
  });
});
