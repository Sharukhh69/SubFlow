import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PlansService } from './plans.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlanQueryDto } from './dto/plan-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('plans')
@Controller('plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new subscription billing plan (Admin only)' })
  @ApiResponse({ status: 201, description: 'Plan created' })
  async create(@Body() dto: CreatePlanDto) {
    return this.plansService.createPlan(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all subscription billing plans' })
  async findAll(@Query() query: PlanQueryDto) {
    return this.plansService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get plan details' })
  async findOne(@Param('id') id: string) {
    return this.plansService.findById(id);
  }

  @Get(':id/availability')
  @ApiOperation({ summary: 'Validate if plan is available on a specific date (Assumption #23)' })
  @ApiQuery({ name: 'date', required: false, type: String })
  async checkAvailability(
    @Param('id') id: string,
    @Query('date') dateStr?: string,
  ) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    return this.plansService.validatePlanAvailability(id, targetDate);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update plan properties (Admin only)' })
  async update(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.plansService.updatePlan(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive/Delete plan (soft-delete if referenced in subscriptions)' })
  async remove(@Param('id') id: string) {
    return this.plansService.archivePlan(id);
  }
}

