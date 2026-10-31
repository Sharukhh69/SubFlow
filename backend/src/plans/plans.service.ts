import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlanQueryDto } from './dto/plan-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  async createPlan(dto: CreatePlanDto) {
    if (dto.availableFrom && dto.availableTo) {
      if (new Date(dto.availableFrom) > new Date(dto.availableTo)) {
        throw new BadRequestException('availableFrom date must be prior to or equal to availableTo date');
      }
    }

    return this.prisma.plan.create({
      data: {
        name: dto.name.trim(),
        price: new Prisma.Decimal(dto.price),
        billingPeriod: dto.billingPeriod,
        minQuantity: dto.minQuantity || 1,
        availableFrom: dto.availableFrom ? new Date(dto.availableFrom) : null,
        availableTo: dto.availableTo ? new Date(dto.availableTo) : null,
        autoClose: dto.autoClose ?? false,
        closable: dto.closable ?? true,
        pausable: dto.pausable ?? false,
        renewable: dto.renewable ?? true,
        isActive: true,
      },
    });
  }

  async findAll(query: PlanQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PlanWhereInput = {
      isActive: query.onlyActive ? true : undefined,
      billingPeriod: query.billingPeriod || undefined,
      name: query.search
        ? { contains: query.search.trim(), mode: 'insensitive' }
        : undefined,
    };

    const [items, total] = await Promise.all([
      this.prisma.plan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.plan.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string) {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with ID "${id}" not found`);
    }

    return plan;
  }

  // Plan availability window validation (Assumption #23)
  async validatePlanAvailability(planId: string, targetDate: Date = new Date()): Promise<{ available: boolean; reason?: string }> {
    const plan = await this.findById(planId);

    if (!plan.isActive) {
      return { available: false, reason: 'Plan is currently inactive' };
    }

    const checkDate = new Date(targetDate);
    checkDate.setHours(0, 0, 0, 0);

    if (plan.availableFrom) {
      const from = new Date(plan.availableFrom);
      from.setHours(0, 0, 0, 0);
      if (checkDate < from) {
        return { available: false, reason: `Plan is not yet available (availableFrom: ${plan.availableFrom.toISOString().slice(0, 10)})` };
      }
    }

    if (plan.availableTo) {
      const to = new Date(plan.availableTo);
      to.setHours(23, 59, 59, 999);
      if (checkDate > to) {
        return { available: false, reason: `Plan has expired (availableTo: ${plan.availableTo.toISOString().slice(0, 10)})` };
      }
    }

    return { available: true };
  }

  async updatePlan(id: string, dto: UpdatePlanDto) {
    await this.findById(id);

    if (dto.availableFrom && dto.availableTo) {
      if (new Date(dto.availableFrom) > new Date(dto.availableTo)) {
        throw new BadRequestException('availableFrom date must be prior to or equal to availableTo date');
      }
    }

    return this.prisma.plan.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
        price: dto.price !== undefined ? new Prisma.Decimal(dto.price) : undefined,
        billingPeriod: dto.billingPeriod,
        minQuantity: dto.minQuantity,
        availableFrom: dto.availableFrom !== undefined ? (dto.availableFrom ? new Date(dto.availableFrom) : null) : undefined,
        availableTo: dto.availableTo !== undefined ? (dto.availableTo ? new Date(dto.availableTo) : null) : undefined,
        isActive: dto.isActive,
        autoClose: dto.autoClose,
        closable: dto.closable,
        pausable: dto.pausable,
        renewable: dto.renewable,
      },
    });
  }

  async archivePlan(id: string) {
    await this.findById(id);

    const [subCount, quoteCount] = await Promise.all([
      this.prisma.subscription.count({ where: { planId: id } }),
      this.prisma.quotationTemplate.count({ where: { planId: id } }),
    ]);

    if (subCount > 0 || quoteCount > 0) {
      await this.prisma.plan.update({
        where: { id },
        data: { isActive: false },
      });
      return {
        message: 'Plan has associated subscriptions or quotation templates and was soft-deactivated (isActive=false)',
        softDeleted: true,
      };
    }

    await this.prisma.plan.delete({ where: { id } });
    return {
      message: 'Plan deleted permanently',
      softDeleted: false,
    };
  }
}
