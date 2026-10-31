import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaymentTerms } from '@prisma/client';

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({ example: '2026-11-01', description: 'Updated start date' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2027-11-01', description: 'Updated contract expiry date' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({ enum: PaymentTerms })
  @IsOptional()
  @IsEnum(PaymentTerms)
  paymentTerms?: PaymentTerms;

  @ApiPropertyOptional({ example: 'Updated terms after procurement review' })
  @IsOptional()
  @IsString()
  notes?: string;
}

