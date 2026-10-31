import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProductType } from '@prisma/client';
import { CreateVariantDto } from './create-variant.dto';

export class CreateProductDto {
  @ApiProperty({ example: 'Brightloop CRM Software' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: ProductType, example: ProductType.SOFTWARE })
  @IsEnum(ProductType)
  type!: ProductType;

  @ApiProperty({ example: 1200.0, description: 'Base selling price in INR' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salesPrice!: number;

  @ApiProperty({ example: 450.0, description: 'Cost price in INR' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costPrice!: number;

  @ApiPropertyOptional({ example: 'Flagship enterprise edition' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Default Tax ID to apply' })
  @IsOptional()
  @IsString()
  defaultTaxId?: string;

  @ApiPropertyOptional({ type: [CreateVariantDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  variants?: CreateVariantDto[];
}
