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
import { UsersService } from './users.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffStatusDto } from './dto/update-staff.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Role } from '@prisma/client';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('staff')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create staff or admin member (Admin only)' })
  @ApiResponse({ status: 201, description: 'Staff member created successfully' })
  @ApiResponse({ status: 403, description: 'Access denied: Requires ADMIN role' })
  @ApiResponse({ status: 409, description: 'User with email already exists' })
  async createStaff(@Body() dto: CreateStaffDto) {
    return this.usersService.createStaff(dto);
  }

  @Get('staff')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'List all staff and admin members (Admin only)' })
  @ApiResponse({ status: 200, description: 'Paginated list of staff members' })
  async listStaff(@Query() pagination: PaginationDto) {
    return this.usersService.findAllStaff(pagination.page, pagination.limit);
  }

  @Patch('staff/:id/status')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate or deactivate staff member (Admin only - soft delete)' })
  @ApiResponse({ status: 200, description: 'Staff status updated' })
  @ApiResponse({ status: 400, description: 'Cannot deactivate yourself' })
  @ApiResponse({ status: 404, description: 'Staff member not found' })
  async updateStaffStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStaffStatusDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.usersService.setStaffStatus(id, dto, currentUser.id);
  }
}
