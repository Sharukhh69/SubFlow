import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Header,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Role } from '@prisma/client';

@ApiTags('invoices')
@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post('generate/:subscriptionId')
  @Roles(Role.ADMIN, Role.STAFF)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate on-demand invoice for a specific active subscription (Admin & Staff)' })
  @ApiResponse({ status: 201, description: 'Invoice generated successfully' })
  @ApiResponse({ status: 400, description: 'Already invoiced for this period or subscription not active' })
  async generateOnDemand(
    @Param('subscriptionId') subscriptionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoicesService.generateOnDemand(subscriptionId, user);
  }

  @Get()
  @Roles(Role.ADMIN, Role.STAFF, Role.CUSTOMER)
  @ApiOperation({ summary: 'List invoices (Tenant isolated for CUSTOMER role)' })
  @ApiResponse({ status: 200, description: 'Paginated invoices list' })
  async findAll(
    @Query() query: InvoiceQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoicesService.findAll(query, user);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.STAFF, Role.CUSTOMER)
  @ApiOperation({ summary: 'Get invoice details by ID (Tenant isolated for CUSTOMER role)' })
  @ApiResponse({ status: 200, description: 'Invoice details with lines and payments' })
  @ApiResponse({ status: 403, description: 'Forbidden: Cannot access other customers invoices' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoicesService.findById(id, user);
  }

  @Post(':id/confirm')
  @Roles(Role.ADMIN, Role.STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm a DRAFT invoice (Admin & Staff)' })
  @ApiResponse({ status: 200, description: 'Invoice confirmed' })
  @ApiResponse({ status: 400, description: 'Only DRAFT invoices can be confirmed' })
  async confirm(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoicesService.confirm(id, user);
  }

  @Post(':id/cancel')
  @Roles(Role.ADMIN, Role.STAFF)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel an invoice (Admin & Staff)' })
  @ApiResponse({ status: 200, description: 'Invoice cancelled' })
  @ApiResponse({ status: 400, description: 'PAID invoices cannot be cancelled' })
  async cancel(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoicesService.cancel(id, user);
  }

  @Get(':id/print')
  @Roles(Role.ADMIN, Role.STAFF, Role.CUSTOMER)
  @Header('Content-Type', 'text/html')
  @ApiOperation({ summary: 'Render printable HTML invoice template' })
  @ApiResponse({ status: 200, description: 'HTML template rendered' })
  async print(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.invoicesService.renderPrintableHtml(id, user);
  }
}

