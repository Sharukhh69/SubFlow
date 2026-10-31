import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SubscriptionStatus } from '@prisma/client';

export class TransitionSubscriptionDto {
  @ApiProperty({
    enum: SubscriptionStatus,
    description: 'Target lifecycle status for the subscription',
    example: SubscriptionStatus.CONFIRMED,
  })
  @IsEnum(SubscriptionStatus)
  @IsNotEmpty()
  status: SubscriptionStatus;

  @ApiPropertyOptional({
    description: 'Business reason or context for this transition (recorded in audit logs)',
    example: 'Quotation signed and accepted by customer via enterprise portal',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

