import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateTemplateLineDto {
  @ApiProperty({ description: 'Product ID' })
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiPropertyOptional({ description: 'Optional Product Variant ID' })
  @IsOptional()
  @IsString()
  variantId?: string;

  @ApiProperty({ default: 1, example: 1 })
  @IsInt()
  @Min(1)
  quantity: number = 1;
}

export class CreateQuotationTemplateDto {
  @ApiProperty({ example: 'Standard SaaS 30-Day Offer' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ description: 'Plan ID to attach' })
  @IsString()
  @IsNotEmpty()
  planId!: string;

  @ApiPropertyOptional({ default: 30, example: 30, description: 'Offer validity window in days' })
  @IsOptional()
  @IsInt()
  @Min(1)
  validityDays: number = 30;

  @ApiProperty({ type: [CreateTemplateLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTemplateLineDto)
  lines!: CreateTemplateLineDto[];
}

