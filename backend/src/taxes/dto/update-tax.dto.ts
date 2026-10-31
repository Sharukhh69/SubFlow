import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { TaxType } from '@prisma/client';

export class UpdateTaxDto {
  @ApiPropertyOptional({ example: 'GST 12%' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: TaxType })
  @IsOptional()
  @IsEnum(TaxType)
  type?: TaxType;

  @ApiPropertyOptional({ example: 0.12 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  rate?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

