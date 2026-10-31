import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { DiscountType, DiscountScope } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class DiscountQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: DiscountType, description: 'Filter by discount type' })
  @IsOptional()
  @IsEnum(DiscountType)
  type?: DiscountType;

  @ApiPropertyOptional({ enum: DiscountScope, description: 'Filter by discount scope' })
  @IsOptional()
  @IsEnum(DiscountScope)
  scope?: DiscountScope;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  isActive?: boolean;
}
