import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { BillingRunDto } from './dto/billing-run.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Role } from '@prisma/client';

@ApiTags('billing')
@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('run')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute batch recurring billing run (Admin only, supports dry-run)' })
  @ApiResponse({ status: 200, description: 'Billing run completed with summary metrics' })
  @ApiResponse({ status: 403, description: 'Forbidden: Requires ADMIN role' })
  async runBilling(
    @Body() dto: BillingRunDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.billingService.runBilling(dto, user.id);
  }

  @Get('runs')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List historical billing run execution logs (Admin only)' })
  @ApiResponse({ status: 200, description: 'List of past billing runs' })
  @ApiResponse({ status: 403, description: 'Forbidden: Requires ADMIN role' })
  async getBillingRuns(@Query('limit') limit?: number) {
    return this.billingService.getBillingRuns(limit ? Number(limit) : 20);
  }
}

