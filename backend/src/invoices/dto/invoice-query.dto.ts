import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { InvoiceStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class InvoiceQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: InvoiceStatus, description: 'Filter by invoice status' })
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @ApiPropertyOptional({ description: 'Filter by customer profile ID' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Filter by subscription ID' })
  @IsOptional()
  @IsString()
  subscriptionId?: string;

  @ApiPropertyOptional({ description: 'Filter by issue date from (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  fromIssueDate?: string;

  @ApiPropertyOptional({ description: 'Filter by issue date to (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  toIssueDate?: string;
}
