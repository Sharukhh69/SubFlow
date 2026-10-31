import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentTerms } from '@prisma/client';

export class CreateSubscriptionLineDto {
  @ApiProperty({ description: 'Catalog Product ID' })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiPropertyOptional({ description: 'Optional Product Variant ID' })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiPropertyOptional({ description: 'Optional Tax rule ID (defaults to product default tax)' })
  @IsOptional()
  @IsString()
  taxId?: string;

  @ApiProperty({ example: 1, minimum: 1, default: 1 })
  @IsInt()
  @Min(1)
  quantity: number = 1;

  @ApiPropertyOptional({
    description: 'Unit price override. If omitted, calculated as base sales price + variant extra price.',
  })
  @IsOptional()
  @IsNumber()
  unitPrice?: number;
}

export class CreateSubscriptionDto {
  @ApiProperty({ description: 'Target Customer Profile ID' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiProperty({ description: 'Selected Billing Plan ID' })
  @IsString()
  @IsNotEmpty()
  planId: string;

  @ApiProperty({ example: '2026-11-01', description: 'Subscription effective start date (YYYY-MM-DD)' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: '2027-11-01', description: 'Subscription contract expiry date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({ enum: PaymentTerms, default: PaymentTerms.IMMEDIATE })
  @IsOptional()
  @IsEnum(PaymentTerms)
  paymentTerms?: PaymentTerms = PaymentTerms.IMMEDIATE;

  @ApiPropertyOptional({ example: 'Enterprise contract negotiated with 5% volume allowance' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({ type: [CreateSubscriptionLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSubscriptionLineDto)
  lines: CreateSubscriptionLineDto[];
}
