import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Role } from '@prisma/client';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Record payment against a confirmed invoice (Admin/Staff only)' })
  recordPayment(
    @Body() recordPaymentDto: RecordPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.recordPayment(recordPaymentDto, user);
  }

  @Get('overdue/invoices')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'List all overdue confirmed invoices requiring collection' })
  getOverdueInvoices(
    @Query() query: PaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.getOverdueInvoices(query, user);
  }

  @Get()
  @Roles(Role.ADMIN, Role.STAFF, Role.CUSTOMER)
  @ApiOperation({ summary: 'List payments (portal-isolated for customers)' })
  findAll(
    @Query() query: PaymentQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.findAll(query, user);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.STAFF, Role.CUSTOMER)
  @ApiOperation({ summary: 'Get payment receipt details by ID' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.findById(id, user);
  }
}
