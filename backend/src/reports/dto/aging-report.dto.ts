import { ApiProperty } from '@nestjs/swagger';

export class AgingInvoiceItemDto {
  @ApiProperty({ example: 'inv_123', description: 'Invoice ID' })
  invoiceId!: string;

  @ApiProperty({ example: 'INV-2026-0001', description: 'Invoice Number' })
  invoiceNumber!: string;

  @ApiProperty({ example: 'Acme Corp', description: 'Customer Name' })
  customerName!: string;

  @ApiProperty({ example: '2026-09-15', description: 'Invoice Due Date (YYYY-MM-DD)' })
  dueDate!: string;

  @ApiProperty({ example: 46, description: 'Days past due date' })
  daysPastDue!: number;

  @ApiProperty({ example: 12000.0, description: 'Grand Total of Invoice' })
  grandTotal!: number;

  @ApiProperty({ example: 2000.0, description: 'Amount already paid' })
  amountPaid!: number;

  @ApiProperty({ example: 10000.0, description: 'Remaining unpaid delinquent amount' })
  outstandingAmount!: number;
}

export class AgingBucketDto {
  @ApiProperty({ example: '31-60', description: 'Bucket key (0-30, 31-60, 61-90, 90+)' })
  bucket!: string;

  @ApiProperty({ example: '31 to 60 Days', description: 'Human-readable bucket label' })
  label!: string;

  @ApiProperty({ example: 5, description: 'Count of delinquent invoices in bucket' })
  invoiceCount!: number;

  @ApiProperty({ example: 45000.0, description: 'Total outstanding amount in this aging bucket' })
  totalAmount!: number;

  @ApiProperty({ type: [AgingInvoiceItemDto], description: 'Detailed invoice items in this aging bucket' })
  invoices!: AgingInvoiceItemDto[];
}

export class AgingReportDto {
  @ApiProperty({ example: 125000.0, description: 'Total overdue balance across all delinquent invoices' })
  totalOverdueAmount!: number;

  @ApiProperty({ example: 12, description: 'Total number of delinquent overdue invoices' })
  totalOverdueCount!: number;

  @ApiProperty({ example: '2026-10-31', description: 'Reference cutoff date for aging calculation' })
  asOfDate!: string;

  @ApiProperty({ type: [AgingBucketDto], description: 'Aging buckets breakdown' })
  buckets!: AgingBucketDto[];

  @ApiProperty({ example: '2026-10-31T10:00:00.000Z', description: 'Generation timestamp' })
  generatedAt!: string;
}

