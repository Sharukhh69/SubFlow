import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateCustomerDto {
  @ApiPropertyOptional({ example: 'John Doe', description: 'Contact full name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Acme Technologies Ltd', description: 'Company name' })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional({ example: '+91 9876543210' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: '100 Innovation Park' })
  @IsOptional()
  @IsString()
  addressLine1?: string;

  @ApiPropertyOptional({ example: 'Tower B, Suite 500' })
  @IsOptional()
  @IsString()
  addressLine2?: string;

  @ApiPropertyOptional({ example: 'Bengaluru' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Karnataka' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: '560100' })
  @IsOptional()
  @IsString()
  pincode?: string;

  @ApiPropertyOptional({ example: '29ABCDE1234F1Z5' })
  @IsOptional()
  @IsString()
  gstin?: string;
}
