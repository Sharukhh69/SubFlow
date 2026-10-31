import { Injectable } from '@nestjs/common';
import { BillingPeriod } from '@prisma/client';

@Injectable()
export class RevenueCalculationService {
  /**
   * Normalizes a recurring amount from any billing period to standard Monthly Recurring Revenue (MRR).
   */
  normalizeToMonthly(amount: number, period: BillingPeriod): number {
    if (amount <= 0 || isNaN(amount)) {
      return 0;
    }

    let normalized: number;
    switch (period) {
      case BillingPeriod.DAILY:
        // 30 days per month
        normalized = amount * 30;
        break;
      case BillingPeriod.WEEKLY:
        // 52 weeks / 12 months = 4.3333333333...
        normalized = amount * (52 / 12);
        break;
      case BillingPeriod.MONTHLY:
        normalized = amount;
        break;
      case BillingPeriod.YEARLY:
        normalized = amount / 12;
        break;
      default:
        normalized = amount;
    }

    return Math.round(normalized * 100) / 100;
  }

  /**
   * Computes Annual Recurring Revenue (ARR) from normalized MRR.
   */
  calculateArr(mrr: number): number {
    return Math.round(mrr * 12 * 100) / 100;
  }

  /**
   * Calculates days past due relative to an as-of date (ignoring time components).
   */
  calculateDaysPastDue(dueDate: Date | string, asOfDate: Date = new Date()): number {
    const due = new Date(dueDate);
    const asOf = new Date(asOfDate);

    // Normalize to UTC calendar date
    const dueUtc = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
    const asOfUtc = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());

    const diffDays = Math.floor((asOfUtc - dueUtc) / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  /**
   * Categorizes days past due into standard accounting aging buckets.
   */
  classifyAgingBucket(daysPastDue: number): { bucket: string; label: string } {
    if (daysPastDue <= 30) {
      return { bucket: '0-30', label: '0 to 30 Days' };
    }
    if (daysPastDue <= 60) {
      return { bucket: '31-60', label: '31 to 60 Days' };
    }
    if (daysPastDue <= 90) {
      return { bucket: '61-90', label: '61 to 90 Days' };
    }
    return { bucket: '90+', label: '90+ Days' };
  }
}
