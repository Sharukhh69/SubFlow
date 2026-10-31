import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaymentTerms } from '@prisma/client';

export class CreateSubscriptionFromTemplateDto {
  @ApiProperty({ description: 'Quotation Template ID to instantiate' })
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @ApiProperty({ description: 'Target Customer Profile ID' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ example: '2026-11-01', description: 'Subscription start date (YYYY-MM-DD)' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ enum: PaymentTerms, default: PaymentTerms.IMMEDIATE })
  @IsOptional()
  @IsEnum(PaymentTerms)
  paymentTerms?: PaymentTerms = PaymentTerms.IMMEDIATE;

  @ApiPropertyOptional({ example: 'Generated from Q4 Enterprise Sales Template' })
  @IsOptional()
  @IsString()
  notes?: string;
}
