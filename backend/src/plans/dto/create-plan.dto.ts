import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { BillingPeriod } from '@prisma/client';

export class CreatePlanDto {
  @ApiProperty({ example: 'Enterprise Annual' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 12000.0, description: 'Base plan recurring price in INR' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @ApiProperty({ enum: BillingPeriod, example: BillingPeriod.YEARLY })
  @IsEnum(BillingPeriod)
  billingPeriod!: BillingPeriod;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  minQuantity: number = 1;

  @ApiPropertyOptional({ example: '2026-01-01', description: 'Available start date (inclusive)' })
  @IsOptional()
  @IsDateString()
  availableFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Available end date (inclusive)' })
  @IsOptional()
  @IsDateString()
  availableTo?: string;

  @ApiPropertyOptional({ default: false, description: 'Automatically close subscription upon end' })
  @IsOptional()
  @IsBoolean()
  autoClose?: boolean;

  @ApiPropertyOptional({ default: true, description: 'Can customer close plan early' })
  @IsOptional()
  @IsBoolean()
  closable?: boolean;

  @ApiPropertyOptional({ default: false, description: 'Can customer pause recurring billing' })
  @IsOptional()
  @IsBoolean()
  pausable?: boolean;

  @ApiPropertyOptional({ default: true, description: 'Can subscription be renewed' })
  @IsOptional()
  @IsBoolean()
  renewable?: boolean;
}
