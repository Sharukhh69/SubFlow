import { ApiProperty } from '@nestjs/swagger';

export class MonthlyTrendDto {
  @ApiProperty({ example: '2026-10', description: 'Calendar month in YYYY-MM format' })
  month!: string;

  @ApiProperty({ example: 450000.0, description: 'Cash collected in this month' })
  collectedRevenue!: number;

  @ApiProperty({ example: 520000.0, description: 'Total invoiced grand total in this month' })
  invoicedRevenue!: number;

  @ApiProperty({ example: 38, description: 'Number of payments recorded in this month' })
  paymentCount!: number;

  @ApiProperty({ example: 45, description: 'Number of confirmed invoices issued in this month' })
  invoiceCount!: number;
}

export class RevenueTrendDto {
  @ApiProperty({ type: [MonthlyTrendDto], description: 'Chronological monthly revenue series' })
  months!: MonthlyTrendDto[];

  @ApiProperty({ example: 2500000.0, description: 'Total cash collected across the entire trend window' })
  totalCollected!: number;

  @ApiProperty({ example: 2800000.0, description: 'Total invoiced revenue across the entire trend window' })
  totalInvoiced!: number;

  @ApiProperty({ example: '2026-10-31T10:00:00.000Z', description: 'Generation timestamp' })
  generatedAt!: string;
}

