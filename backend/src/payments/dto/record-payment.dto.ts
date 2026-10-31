import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';

export class RecordPaymentDto {
  @ApiProperty({ description: 'Target Invoice ID' })
  @IsString()
  @IsNotEmpty()
  invoiceId!: string;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.UPI })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiProperty({ example: 4153.6, description: 'Payment amount received' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  amount!: number;

  @ApiPropertyOptional({ example: '2026-11-01', description: 'Date payment was received (defaults to now)' })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional({ example: 'UPI-TXN-9876543210', description: 'Bank / Gateway reference or check number' })
  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @ApiPropertyOptional({ example: 'Customer paid via Google Pay business account', description: 'Notes' })
  @IsOptional()
  @IsString()
  note?: string;
}

