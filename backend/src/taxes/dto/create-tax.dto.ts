import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';
import { TaxType } from '@prisma/client';

export class CreateTaxDto {
  @ApiProperty({ example: 'GST 18%', description: 'Tax rule name' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ enum: TaxType, example: TaxType.PERCENTAGE })
  @IsEnum(TaxType)
  type!: TaxType;

  @ApiProperty({ example: 0.18, description: 'Tax rate (e.g. 0.18 for 18% or fixed monetary amount)' })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  rate!: number;
}

