import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateVariantDto {
  @ApiProperty({ example: 'Brand', description: 'Attribute name (e.g. Brand, Tier, Storage)' })
  @IsString()
  @IsNotEmpty()
  attributeName!: string;

  @ApiProperty({ example: 'Odoo', description: 'Attribute value (e.g. Odoo, Pro, 500GB)' })
  @IsString()
  @IsNotEmpty()
  attributeValue!: string;

  @ApiProperty({ example: 560.0, description: 'Surcharge added to base product sales price' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  extraPrice: number = 0;
}

export class UpdateVariantDto {
  @ApiPropertyOptional({ example: 'Brand' })
  @IsOptional()
  @IsString()
  attributeName?: string;

  @ApiPropertyOptional({ example: 'Odoo' })
  @IsOptional()
  @IsString()
  attributeValue?: string;

  @ApiPropertyOptional({ example: 560.0 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  extraPrice?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

