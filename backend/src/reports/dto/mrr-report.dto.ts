import { ApiProperty } from '@nestjs/swagger';
import { BillingPeriod } from '@prisma/client';

export class PlanMrrBreakdownDto {
  @ApiProperty({ example: 'plan_123', description: 'Plan ID' })
  planId!: string;

  @ApiProperty({ example: 'Pro Enterprise', description: 'Plan Name' })
  planName!: string;

  @ApiProperty({ enum: BillingPeriod, example: BillingPeriod.MONTHLY, description: 'Billing Period' })
  billingPeriod!: BillingPeriod;

  @ApiProperty({ example: 14, description: 'Count of active subscriptions for this plan' })
  activeSubscriptionsCount!: number;

  @ApiProperty({ example: 45000.0, description: 'Total normalized MRR contributed by this plan' })
  totalMrr!: number;

  @ApiProperty({ example: 540000.0, description: 'Total normalized ARR contributed by this plan' })
  totalArr!: number;
}

export class PeriodMrrBreakdownDto {
  @ApiProperty({ enum: BillingPeriod, example: BillingPeriod.MONTHLY, description: 'Billing Period' })
  billingPeriod!: BillingPeriod;

  @ApiProperty({ example: 25, description: 'Active subscriptions count with this interval' })
  activeSubscriptionsCount!: number;

  @ApiProperty({ example: 75000.0, description: 'Normalized MRR from this interval' })
  totalMrr!: number;
}

export class MrrReportDto {
  @ApiProperty({ example: 125000.5, description: 'Total normalized Monthly Recurring Revenue' })
  totalMrr!: number;

  @ApiProperty({ example: 1500006.0, description: 'Total Annual Recurring Revenue (MRR * 12)' })
  totalArr!: number;

  @ApiProperty({ example: 42, description: 'Total count of active subscriptions' })
  activeSubscriptionsCount!: number;

  @ApiProperty({ type: [PlanMrrBreakdownDto], description: 'MRR breakdown segmented by subscription plan' })
  byPlan!: PlanMrrBreakdownDto[];

  @ApiProperty({ type: [PeriodMrrBreakdownDto], description: 'MRR breakdown segmented by billing frequency' })
  byPeriod!: PeriodMrrBreakdownDto[];

  @ApiProperty({ example: '2026-10-31T10:00:00.000Z', description: 'Calculation timestamp' })
  generatedAt!: string;
}
