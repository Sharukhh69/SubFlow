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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { CreateSubscriptionFromTemplateDto } from './dto/create-subscription-from-template.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { TransitionSubscriptionDto } from './dto/transition-subscription.dto';
import { SubscriptionQueryDto } from './dto/subscription-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Role } from '@prisma/client';

@ApiTags('subscriptions')
@Controller('subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  @Roles(Role.ADMIN, Role.STAFF)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new subscription in DRAFT status (Admin & Staff)' })
  @ApiResponse({ status: 201, description: 'Subscription created in DRAFT status' })
  @ApiResponse({ status: 400, description: 'Validation failed or plan minimum quantity not satisfied' })
  async create(
    @Body() dto: CreateSubscriptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subscriptionsService.create(dto, user);
  }

  @Post('from-template')
  @Roles(Role.ADMIN, Role.STAFF)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Instantiate a subscription quotation from a template (Admin & Staff)' })
  @ApiResponse({ status: 201, description: 'Subscription quotation instantiated successfully' })
  @ApiResponse({ status: 400, description: 'Template inactive or invalid lines' })
  async createFromTemplate(
    @Body() dto: CreateSubscriptionFromTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subscriptionsService.createFromTemplate(dto, user);
  }

  @Get()
  @Roles(Role.ADMIN, Role.STAFF, Role.CUSTOMER)
  @ApiOperation({ summary: 'List subscriptions (Customer Portal isolated to own account)' })
  @ApiResponse({ status: 200, description: 'Paginated subscriptions list' })
  async findAll(
    @Query() query: SubscriptionQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subscriptionsService.findAll(query, user);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.STAFF, Role.CUSTOMER)
  @ApiOperation({ summary: 'Get subscription by ID (Customer Portal isolated to own account)' })
  @ApiResponse({ status: 200, description: 'Subscription details with lines and plan' })
  @ApiResponse({ status: 403, description: 'Forbidden: Cannot access other customers subscriptions' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subscriptionsService.findById(id, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Update draft or quotation subscription header details (Admin & Staff)' })
  @ApiResponse({ status: 200, description: 'Subscription updated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot update active or closed subscriptions' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subscriptionsService.update(id, dto, user);
  }

  @Post(':id/transition')
  @Roles(Role.ADMIN, Role.STAFF, Role.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute lifecycle state transition (State Machine)' })
  @ApiResponse({ status: 200, description: 'Transition executed successfully' })
  @ApiResponse({ status: 400, description: 'Illegal transition or plan capability constraint' })
  @ApiResponse({ status: 403, description: 'Forbidden: Insufficient permissions for target transition' })
  async transition(
    @Param('id') id: string,
    @Body() dto: TransitionSubscriptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subscriptionsService.transitionStatus(id, dto, user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Discard an unconfirmed draft subscription (Admin only)' })
  @ApiResponse({ status: 200, description: 'Draft discarded successfully' })
  @ApiResponse({ status: 400, description: 'Only DRAFT subscriptions can be discarded' })
  @ApiResponse({ status: 404, description: 'Subscription not found' })
  async discardDraft(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.subscriptionsService.discardDraft(id, user);
  }
}
