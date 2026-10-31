import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { BillingRunDto } from './dto/billing-run.dto';
import { SubscriptionStatus } from '@prisma/client';

export interface BillingRunResult {
  billingRunId: string;
  isDryRun: boolean;
  targetDate: string;
  processed: number;
  created: number;
  skipped: number;
  failed: number;
  errors: any[];
  durationMs: number;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
  ) {}

  /**
   * Automated Daily Recurring Billing Cron (Runs every day at midnight UTC)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyBillingCron() {
    this.logger.log('Executing automated daily recurring billing cron...');
    try {
      const result = await this.runBilling({ isDryRun: false }, 'CRON_SCHEDULER');
      this.logger.log(
        `Automated billing complete. Processed: ${result.processed}, Invoices Created: ${result.created}, Skipped: ${result.skipped}, Failed: ${result.failed}`,
      );
    } catch (err: any) {
      this.logger.error(`Automated billing cron failed: ${err.message}`, err.stack);
    }
  }

  /**
   * Core Batch Billing Runner (Supports Dry-Run mode and Target Date evaluation)
   */
  async runBilling(dto: BillingRunDto, triggeredBy: string = 'ADMIN'): Promise<BillingRunResult> {
    const startTime = Date.now();
    const targetDate = dto.targetDate ? new Date(dto.targetDate) : new Date();
    const isDryRun = dto.isDryRun ?? false;

    // 1. Create BillingRun audit record
    const billingRun = await this.prisma.billingRun.create({
      data: {
        triggeredBy,
        isDryRun,
        startedAt: new Date(),
      },
    });

    let processed = 0;
    let created = 0;
    let skipped = 0;
    let failed = 0;
    const errors: any[] = [];

    // 2. Query all ACTIVE subscriptions due on or before targetDate
    const dueSubscriptions = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        OR: [
          { nextBillingDate: { lte: targetDate } },
          { nextBillingDate: null, startDate: { lte: targetDate } },
        ],
      },
      include: {
        customer: {
          include: { user: true },
        },
        plan: true,
        lines: {
          include: {
            product: true,
            variant: true,
            tax: true,
          },
        },
      },
    });

    // 3. Process each due subscription
    for (const sub of dueSubscriptions) {
      processed++;
      try {
        const billingStart = sub.nextBillingDate
          ? new Date(sub.nextBillingDate)
          : new Date(sub.startDate);

        const billingEnd = this.invoicesService.calculatePeriodEnd(
          billingStart,
          sub.plan.billingPeriod,
        );

        if (isDryRun) {
          // Dry-run simulation: Check if invoice already exists
          const existing = await this.prisma.invoice.findUnique({
            where: {
              subscriptionId_billingPeriodStart: {
                subscriptionId: sub.id,
                billingPeriodStart: billingStart,
              },
            },
          });

          if (existing) {
            skipped++;
          } else {
            created++;
          }
        } else {
          // Live execution
          const result = await this.invoicesService.createFromSubscription(
            sub,
            billingStart,
            billingEnd,
            triggeredBy,
          );

          if (result.skipped) {
            skipped++;
          } else {
            created++;
            // Advance next billing date
            await this.prisma.subscription.update({
              where: { id: sub.id },
              data: {
                nextBillingDate: billingEnd,
              },
            });
          }
        }
      } catch (err: any) {
        failed++;
        errors.push({
          subscriptionId: sub.id,
          subscriptionNumber: sub.number,
          error: err.message,
        });
      }
    }

    const durationMs = Date.now() - startTime;

    // 4. Update BillingRun audit record with final metrics
    await this.prisma.billingRun.update({
      where: { id: billingRun.id },
      data: {
        completedAt: new Date(),
        processed,
        created,
        skipped,
        failed,
        errors: errors.length > 0 ? errors : undefined,
      },
    });

    return {
      billingRunId: billingRun.id,
      isDryRun,
      targetDate: targetDate.toISOString().split('T')[0],
      processed,
      created,
      skipped,
      failed,
      errors,
      durationMs,
    };
  }

  /**
   * List historical billing run audit logs
   */
  async getBillingRuns(limit: number = 20) {
    return this.prisma.billingRun.findMany({
      take: Math.min(limit, 100),
      orderBy: { startedAt: 'desc' },
    });
  }
}

