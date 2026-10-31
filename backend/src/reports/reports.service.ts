import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RevenueCalculationService } from './revenue-calculation.service';
import { DashboardSummaryDto } from './dto/dashboard-summary.dto';
import {
  MrrReportDto,
  PlanMrrBreakdownDto,
  PeriodMrrBreakdownDto,
} from './dto/mrr-report.dto';
import {
  AgingReportDto,
  AgingBucketDto,
  AgingInvoiceItemDto,
} from './dto/aging-report.dto';
import { RevenueTrendDto, MonthlyTrendDto } from './dto/revenue-trend.dto';
import { ReportQueryDto } from './dto/report-query.dto';
import { BillingPeriod, InvoiceStatus, SubscriptionStatus } from '@prisma/client';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL_MS = 60 * 1000; // 60 seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly calculationService: RevenueCalculationService,
  ) {}

  /**
   * Helper to retrieve from in-memory cache if entry is valid
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  /**
   * Helper to write to in-memory cache
   */
  private setInCache<T>(key: string, data: T, ttlMs = this.DEFAULT_TTL_MS): void {
    this.cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }

  /**
   * Clears the in-memory cache (useful for testing or cache bust)
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 1. Executive Dashboard Summary
   * High-level KPI cards with 60-second in-memory caching.
   */
  async getExecutiveSummary(query?: ReportQueryDto): Promise<DashboardSummaryDto> {
    const cacheKey = `summary_${query?.startDate || ''}_${query?.endDate || ''}_${query?.planId || ''}`;
    const cached = this.getFromCache<DashboardSummaryDto>(cacheKey);
    if (cached) {
      return {
        ...cached,
        isCached: true,
      };
    }

    // 1. Active Subscriptions count & plan breakdown
    const subWhere: any = { status: SubscriptionStatus.ACTIVE };
    if (query?.planId) {
      subWhere.planId = query.planId;
    }

    const paymentWhere: any = {};
    if (query?.startDate || query?.endDate) {
      paymentWhere.paymentDate = {};
      if (query.startDate) paymentWhere.paymentDate.gte = new Date(query.startDate);
      if (query.endDate) paymentWhere.paymentDate.lte = new Date(query.endDate);
    }

    const [activeSubscriptionsCount, activeSubs, paymentSum, confirmedInvoices] = await Promise.all([
      this.prisma.subscription.count({ where: subWhere }),
      this.prisma.subscription.findMany({
        where: subWhere,
        select: {
          plan: { select: { billingPeriod: true } },
          lines: { select: { lineAmount: true } },
        },
      }),
      this.prisma.payment.aggregate({
        where: paymentWhere,
        _sum: { amount: true },
      }),
      this.prisma.invoice.findMany({
        where: { status: InvoiceStatus.CONFIRMED },
        select: {
          grandTotal: true,
          amountPaid: true,
          dueDate: true,
        },
      }),
    ]);

    // Compute normalized MRR across all active subscription lines
    let totalMrr = 0;
    for (const sub of activeSubs) {
      const subAmount = sub.lines.reduce((sum, line) => sum + Number(line.lineAmount), 0);
      totalMrr += this.calculationService.normalizeToMonthly(subAmount, sub.plan.billingPeriod);
    }
    totalMrr = Math.round(totalMrr * 100) / 100;
    const arr = this.calculationService.calculateArr(totalMrr);

    // Cumulative Collected Revenue from Payments
    const totalRevenueCollected = Math.round(Number(paymentSum._sum.amount || 0) * 100) / 100;

    // Outstanding balance & Overdue counts on CONFIRMED invoices

    let totalOutstanding = 0;
    let overdueInvoicesCount = 0;
    const now = new Date();
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

    for (const inv of confirmedInvoices) {
      const balance = Number(inv.grandTotal) - Number(inv.amountPaid);
      if (balance > 0.001) {
        totalOutstanding += balance;
        const due = new Date(inv.dueDate);
        const dueUtc = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
        if (dueUtc < todayUtc) {
          overdueInvoicesCount++;
        }
      }
    }
    totalOutstanding = Math.round(totalOutstanding * 100) / 100;

    const result: DashboardSummaryDto = {
      activeSubscriptions: activeSubscriptionsCount,
      mrr: totalMrr,
      arr,
      totalRevenueCollected,
      totalOutstanding,
      overdueInvoicesCount,
      generatedAt: new Date().toISOString(),
      isCached: false,
    };

    this.setInCache(cacheKey, result);
    return result;
  }

  /**
   * 2. MRR / ARR Analytics Breakdown
   * Deconstructs MRR across subscription plans and recurrence intervals.
   */
  async getMrrBreakdown(): Promise<MrrReportDto> {
    const cacheKey = 'mrr_breakdown';
    const cached = this.getFromCache<MrrReportDto>(cacheKey);
    if (cached) return cached;

    const activeSubs = await this.prisma.subscription.findMany({
      where: { status: SubscriptionStatus.ACTIVE },
      include: {
        plan: true,
        lines: true,
      },
    });

    const planMap = new Map<
      string,
      {
        planId: string;
        planName: string;
        billingPeriod: BillingPeriod;
        count: number;
        mrr: number;
      }
    >();

    const periodMap = new Map<
      BillingPeriod,
      {
        billingPeriod: BillingPeriod;
        count: number;
        mrr: number;
      }
    >();

    // Initialize period buckets
    for (const period of Object.values(BillingPeriod)) {
      periodMap.set(period, { billingPeriod: period, count: 0, mrr: 0 });
    }

    let overallMrr = 0;

    for (const sub of activeSubs) {
      const subAmount = sub.lines.reduce((sum, line) => sum + Number(line.lineAmount), 0);
      const subMrr = this.calculationService.normalizeToMonthly(subAmount, sub.plan.billingPeriod);
      overallMrr += subMrr;

      // Plan aggregation
      const existingPlan = planMap.get(sub.planId) || {
        planId: sub.plan.id,
        planName: sub.plan.name,
        billingPeriod: sub.plan.billingPeriod,
        count: 0,
        mrr: 0,
      };
      existingPlan.count += 1;
      existingPlan.mrr += subMrr;
      planMap.set(sub.planId, existingPlan);

      // Period aggregation
      const existingPeriod = periodMap.get(sub.plan.billingPeriod)!;
      existingPeriod.count += 1;
      existingPeriod.mrr += subMrr;
    }

    overallMrr = Math.round(overallMrr * 100) / 100;
    const overallArr = this.calculationService.calculateArr(overallMrr);

    const byPlan: PlanMrrBreakdownDto[] = Array.from(planMap.values()).map((p) => {
      const roundedMrr = Math.round(p.mrr * 100) / 100;
      return {
        planId: p.planId,
        planName: p.planName,
        billingPeriod: p.billingPeriod,
        activeSubscriptionsCount: p.count,
        totalMrr: roundedMrr,
        totalArr: this.calculationService.calculateArr(roundedMrr),
      };
    });

    const byPeriod: PeriodMrrBreakdownDto[] = Array.from(periodMap.values())
      .filter((p) => p.count > 0)
      .map((p) => ({
        billingPeriod: p.billingPeriod,
        activeSubscriptionsCount: p.count,
        totalMrr: Math.round(p.mrr * 100) / 100,
      }));

    const report: MrrReportDto = {
      totalMrr: overallMrr,
      totalArr: overallArr,
      activeSubscriptionsCount: activeSubs.length,
      byPlan,
      byPeriod,
      generatedAt: new Date().toISOString(),
    };

    this.setInCache(cacheKey, report);
    return report;
  }

  /**
   * 3. Accounts Receivable Aging Report
   * Groups unpaid overdue CONFIRMED invoices into standard 0-30, 31-60, 61-90, 90+ buckets.
   */
  async getAgingReport(): Promise<AgingReportDto> {
    const cacheKey = 'aging_report';
    const cached = this.getFromCache<AgingReportDto>(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const asOfDateStr = now.toISOString().split('T')[0];
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

    // Fetch all confirmed invoices
    const confirmedInvoices = await this.prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.CONFIRMED,
      },
      orderBy: { dueDate: 'asc' },
    });

    // Buckets setup
    const bucketDefs = [
      { bucket: '0-30', label: '0 to 30 Days' },
      { bucket: '31-60', label: '31 to 60 Days' },
      { bucket: '61-90', label: '61 to 90 Days' },
      { bucket: '90+', label: '90+ Days' },
    ];

    const bucketsMap = new Map<string, AgingBucketDto>();
    for (const b of bucketDefs) {
      bucketsMap.set(b.bucket, {
        bucket: b.bucket,
        label: b.label,
        invoiceCount: 0,
        totalAmount: 0,
        invoices: [],
      });
    }

    let totalOverdueAmount = 0;
    let totalOverdueCount = 0;

    for (const inv of confirmedInvoices) {
      const balance = Number(inv.grandTotal) - Number(inv.amountPaid);
      if (balance <= 0.001) continue;

      const due = new Date(inv.dueDate);
      const dueUtc = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());

      // Only count invoices where dueDate < today
      if (dueUtc < todayUtc) {
        const daysPastDue = this.calculationService.calculateDaysPastDue(inv.dueDate, now);
        const classification = this.calculationService.classifyAgingBucket(daysPastDue);
        const targetBucket = bucketsMap.get(classification.bucket)!;

        const roundedBalance = Math.round(balance * 100) / 100;
        const item: AgingInvoiceItemDto = {
          invoiceId: inv.id,
          invoiceNumber: inv.number,
          customerName: inv.snapshotCustomerName,
          dueDate: due.toISOString().split('T')[0],
          daysPastDue,
          grandTotal: Number(inv.grandTotal),
          amountPaid: Number(inv.amountPaid),
          outstandingAmount: roundedBalance,
        };

        targetBucket.invoiceCount += 1;
        targetBucket.totalAmount = Math.round((targetBucket.totalAmount + roundedBalance) * 100) / 100;
        targetBucket.invoices.push(item);

        totalOverdueAmount += roundedBalance;
        totalOverdueCount += 1;
      }
    }

    totalOverdueAmount = Math.round(totalOverdueAmount * 100) / 100;

    const report: AgingReportDto = {
      totalOverdueAmount,
      totalOverdueCount,
      asOfDate: asOfDateStr,
      buckets: Array.from(bucketsMap.values()),
      generatedAt: new Date().toISOString(),
    };

    this.setInCache(cacheKey, report);
    return report;
  }

  /**
   * 4. Monthly Revenue Trend
   * Tracks monthly cash collections and invoiced revenue over a historical window (default 6 months).
   */
  async getRevenueTrend(monthsCount: number = 6): Promise<RevenueTrendDto> {
    const safeMonths = Math.min(Math.max(monthsCount, 1), 24);
    const cacheKey = `revenue_trend_${safeMonths}`;
    const cached = this.getFromCache<RevenueTrendDto>(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const monthIntervals: { start: Date; end: Date; label: string }[] = [];

    // Generate month ranges backwards from current month
    for (let i = safeMonths - 1; i >= 0; i--) {
      const year = now.getFullYear();
      const month = now.getMonth() - i;
      const startOfMonth = new Date(year, month, 1);
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

      const yyyy = startOfMonth.getFullYear();
      const mm = String(startOfMonth.getMonth() + 1).padStart(2, '0');
      monthIntervals.push({
        start: startOfMonth,
        end: endOfMonth,
        label: `${yyyy}-${mm}`,
      });
    }

    const monthPromises = monthIntervals.map(async (interval) => {
      const [paymentAgg, invoiceAgg] = await Promise.all([
        this.prisma.payment.aggregate({
          where: {
            paymentDate: {
              gte: interval.start,
              lte: interval.end,
            },
          },
          _sum: { amount: true },
          _count: { id: true },
        }),
        this.prisma.invoice.aggregate({
          where: {
            issueDate: {
              gte: interval.start,
              lte: interval.end,
            },
            status: { in: [InvoiceStatus.CONFIRMED, InvoiceStatus.PAID] },
          },
          _sum: { grandTotal: true },
          _count: { id: true },
        }),
      ]);

      const collected = Math.round(Number(paymentAgg._sum.amount || 0) * 100) / 100;
      const invoiced = Math.round(Number(invoiceAgg._sum.grandTotal || 0) * 100) / 100;

      return {
        month: interval.label,
        collectedRevenue: collected,
        invoicedRevenue: invoiced,
        paymentCount: paymentAgg._count.id || 0,
        invoiceCount: invoiceAgg._count.id || 0,
      };
    });

    const monthsData = await Promise.all(monthPromises);

    let totalCollected = 0;
    let totalInvoiced = 0;
    for (const m of monthsData) {
      totalCollected += m.collectedRevenue;
      totalInvoiced += m.invoicedRevenue;
    }

    const report: RevenueTrendDto = {
      months: monthsData,
      totalCollected: Math.round(totalCollected * 100) / 100,
      totalInvoiced: Math.round(totalInvoiced * 100) / 100,
      generatedAt: new Date().toISOString(),
    };

    this.setInCache(cacheKey, report);
    return report;
  }
}
