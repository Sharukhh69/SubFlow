import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

export class BillingRunDto {
  @ApiPropertyOptional({
    description: 'Whether to simulate billing run without persisting invoices or advancing billing dates',
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isDryRun?: boolean = false;

  @ApiPropertyOptional({
    description: 'Target evaluation date for due subscriptions (YYYY-MM-DD). Defaults to current date.',
    example: '2026-11-01',
  })
  @IsOptional()
  @IsDateString()
  targetDate?: string;
}
