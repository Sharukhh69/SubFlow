import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerAdminDto } from './dto/create-customer-admin.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Role } from '@prisma/client';

@ApiTags('customers')
@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get('me')
  @Roles(Role.CUSTOMER, Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Get current customer profile (Customer portal / Self-service)' })
  @ApiResponse({ status: 200, description: 'Current customer profile returned' })
  @ApiResponse({ status: 404, description: 'Customer profile not found for user' })
  async getMyProfile(@CurrentUser() user: AuthenticatedUser) {
    return this.customersService.getProfileByUserId(user.id);
  }

  @Patch('me')
  @Roles(Role.CUSTOMER, Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Update current customer profile (Customer portal / Self-service)' })
  @ApiResponse({ status: 200, description: 'Customer profile updated successfully' })
  @ApiResponse({ status: 404, description: 'Customer profile not found for user' })
  async updateMyProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.updateProfileByUserId(user.id, dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'List and search customers with pagination (Admin & Staff)' })
  @ApiResponse({ status: 200, description: 'Paginated customer list with counts' })
  @ApiResponse({ status: 403, description: 'Forbidden: Requires ADMIN or STAFF role' })
  async listCustomers(@Query() query: CustomerQueryDto) {
    return this.customersService.findAll(query);
  }

  @Post()
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Provision new customer account (Admin only)' })
  @ApiResponse({ status: 201, description: 'Customer provisioned successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: Requires ADMIN role' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async createCustomer(@Body() dto: CreateCustomerAdminDto) {
    return this.customersService.createCustomerByAdmin(dto);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.STAFF, Role.CUSTOMER)
  @ApiOperation({ summary: 'Get customer by ID (Enforces strict portal data isolation for CUSTOMER)' })
  @ApiResponse({ status: 200, description: 'Customer details returned' })
  @ApiResponse({ status: 403, description: 'Forbidden: Customer cannot access other customer profiles' })
  @ApiResponse({ status: 404, description: 'Customer profile not found' })
  async getCustomerById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.customersService.findById(id, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Update customer by ID (Admin & Staff)' })
  @ApiResponse({ status: 200, description: 'Customer updated successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden: Requires ADMIN or STAFF role' })
  @ApiResponse({ status: 404, description: 'Customer profile not found' })
  async updateCustomerById(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.updateCustomerById(id, dto);
  }
}
