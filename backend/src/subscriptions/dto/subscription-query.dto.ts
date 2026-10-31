import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { SubscriptionStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class SubscriptionQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: SubscriptionStatus, description: 'Filter by lifecycle status' })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiPropertyOptional({ description: 'Filter by customer profile ID' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Filter by plan ID' })
  @IsOptional()
  @IsString()
  planId?: string;
}
