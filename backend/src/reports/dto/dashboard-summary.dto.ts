import { ApiProperty } from '@nestjs/swagger';

export class DashboardSummaryDto {
  @ApiProperty({ example: 42, description: 'Total number of currently ACTIVE subscriptions' })
  activeSubscriptions!: number;

  @ApiProperty({ example: 125000.5, description: 'Monthly Recurring Revenue (normalized to INR)' })
  mrr!: number;

  @ApiProperty({ example: 1500006.0, description: 'Annual Recurring Revenue (MRR * 12)' })
  arr!: number;

  @ApiProperty({ example: 854000.0, description: 'Cumulative cash collected across all payment channels' })
  totalRevenueCollected!: number;

  @ApiProperty({ example: 34500.0, description: 'Outstanding unpaid balance on confirmed invoices' })
  totalOutstanding!: number;

  @ApiProperty({ example: 4, description: 'Total count of delinquent confirmed invoices with dueDate < today' })
  overdueInvoicesCount!: number;

  @ApiProperty({ example: '2026-10-31T10:00:00.000Z', description: 'Timestamp when metrics were computed' })
  generatedAt!: string;

  @ApiProperty({ example: false, description: 'Whether this response was served from in-memory cache' })
  isCached!: boolean;
}

