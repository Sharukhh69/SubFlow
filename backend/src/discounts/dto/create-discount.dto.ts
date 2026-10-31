import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
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
import { DiscountType, DiscountScope } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateDiscountDto {
  @ApiProperty({ example: 'Summer Special 10% Off', description: 'Promotional discount name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: DiscountType, example: DiscountType.PERCENTAGE })
  @IsEnum(DiscountType)
  type!: DiscountType;

  @ApiProperty({ example: 10.0, description: 'Discount value (e.g. 10 for 10% or 500 for Rs.500 fixed)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  value!: number;

  @ApiPropertyOptional({ example: 1000.0, description: 'Minimum cart subtotal required to qualify' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  minPurchaseAmount?: number;

  @ApiPropertyOptional({ example: 2, description: 'Minimum total items quantity required' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  minQuantity?: number;

  @ApiPropertyOptional({ example: '2026-06-01', description: 'Promotion start date (ISO string)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Promotion expiration date (ISO string)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 100, description: 'Maximum lifetime allowed redemptions' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  usageLimit?: number;

  @ApiPropertyOptional({ enum: DiscountScope, default: DiscountScope.WHOLE_SUBSCRIPTION })
  @IsOptional()
  @IsEnum(DiscountScope)
  scope?: DiscountScope = DiscountScope.WHOLE_SUBSCRIPTION;

  @ApiPropertyOptional({ example: ['prod_123', 'prod_456'], description: 'Product IDs if scope is SPECIFIC_PRODUCTS' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

