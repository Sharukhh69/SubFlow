import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';
import { DiscountQueryDto } from './dto/discount-query.dto';
import { DiscountEvaluatorService, DiscountWithProducts } from './discount-evaluator.service';
import { DiscountScope, Prisma } from '@prisma/client';

@Injectable()
export class DiscountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evaluator: DiscountEvaluatorService,
  ) {}

  /**
   * Create a new discount rule (Admin only)
   */
  async create(dto: CreateDiscountDto, userId?: string) {
    if (dto.startDate && dto.endDate) {
      if (new Date(dto.startDate) > new Date(dto.endDate)) {
        throw new BadRequestException('startDate cannot be after endDate');
      }
    }

    if (dto.scope === DiscountScope.SPECIFIC_PRODUCTS && (!dto.productIds || dto.productIds.length === 0)) {
      throw new BadRequestException('productIds must be specified when scope is SPECIFIC_PRODUCTS');
    }

    const discount = await this.prisma.discount.create({
      data: {
        name: dto.name,
        type: dto.type,
        value: new Prisma.Decimal(dto.value),
        minPurchaseAmount: dto.minPurchaseAmount ? new Prisma.Decimal(dto.minPurchaseAmount) : null,
        minQuantity: dto.minQuantity || 0,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        usageLimit: dto.usageLimit || null,
        scope: dto.scope || DiscountScope.WHOLE_SUBSCRIPTION,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        products:
          dto.scope === DiscountScope.SPECIFIC_PRODUCTS && dto.productIds?.length
            ? {
                create: dto.productIds.map((productId) => ({
                  product: { connect: { id: productId } },
                })),
              }
            : undefined,
      },
      include: {
        products: {
          include: { product: true },
        },
      },
    });

    try {
      await this.prisma.auditLog.create({
        data: {
          entityType: 'DISCOUNT',
          entityId: discount.id,
          action: 'CREATE_DISCOUNT',
          userId,
          metadata: { name: discount.name, type: discount.type, value: dto.value },
        },
      });
    } catch {
      // Non-critical audit log resilience
    }

    return discount;
  }

  /**
   * List discounts with filtering and pagination
   */
  async findAll(query: DiscountQueryDto) {
    const { page = 1, limit = 20, type, scope, isActive, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.DiscountWhereInput = {};

    if (type) where.type = type;
    if (scope) where.scope = scope;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [total, data] = await Promise.all([
      this.prisma.discount.count({ where }),
      this.prisma.discount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          products: {
            include: { product: true },
          },
          _count: {
            select: { redemptions: true },
          },
        },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find discount by ID
   */
  async findById(id: string) {
    const discount = await this.prisma.discount.findUnique({
      where: { id },
      include: {
        products: {
          include: { product: true },
        },
        redemptions: {
          take: 50,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!discount) {
      throw new NotFoundException(`Discount with ID ${id} not found`);
    }

    return discount;
  }

  /**
   * Update discount
   */
  async update(id: string, dto: UpdateDiscountDto, userId?: string) {
    await this.findById(id);

    if (dto.startDate && dto.endDate) {
      if (new Date(dto.startDate) > new Date(dto.endDate)) {
        throw new BadRequestException('startDate cannot be after endDate');
      }
    }

    // If updating products, delete previous relations first
    if (dto.productIds && dto.scope === DiscountScope.SPECIFIC_PRODUCTS) {
      await this.prisma.discountProduct.deleteMany({
        where: { discountId: id },
      });
    }

    const updated = await this.prisma.discount.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        value: dto.value !== undefined ? new Prisma.Decimal(dto.value) : undefined,
        minPurchaseAmount:
          dto.minPurchaseAmount !== undefined
            ? dto.minPurchaseAmount
              ? new Prisma.Decimal(dto.minPurchaseAmount)
              : null
            : undefined,
        minQuantity: dto.minQuantity,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        usageLimit: dto.usageLimit,
        scope: dto.scope,
        isActive: dto.isActive,
        products:
          dto.productIds && dto.scope === DiscountScope.SPECIFIC_PRODUCTS
            ? {
                create: dto.productIds.map((pId) => ({
                  product: { connect: { id: pId } },
                })),
              }
            : undefined,
      },
      include: {
        products: {
          include: { product: true },
        },
      },
    });

    try {
      await this.prisma.auditLog.create({
        data: {
          entityType: 'DISCOUNT',
          entityId: id,
          action: 'UPDATE_DISCOUNT',
          userId,
          metadata: { name: updated.name, isActive: updated.isActive },
        },
      });
    } catch {
      // Non-critical audit log resilience
    }

    return updated;
  }

  /**
   * Soft-delete discount (deactivation)
   */
  async remove(id: string, userId?: string) {
    await this.findById(id);

    const deactivated = await this.prisma.discount.update({
      where: { id },
      data: { isActive: false },
    });

    try {
      await this.prisma.auditLog.create({
        data: {
          entityType: 'DISCOUNT',
          entityId: id,
          action: 'DEACTIVATE_DISCOUNT',
          userId,
        },
      });
    } catch {
      // Non-critical audit log resilience
    }

    return deactivated;
  }

  /**
   * Fetch all active discounts for evaluation
   */
  async findActiveDiscounts(): Promise<DiscountWithProducts[]> {
    return this.prisma.discount.findMany({
      where: { isActive: true },
      include: {
        products: true,
      },
    });
  }

  /**
   * Atomic usage counter increment
   */
  async incrementUsage(discountId: string) {
    return this.prisma.discount.update({
      where: { id: discountId },
      data: {
        usedCount: { increment: 1 },
      },
    });
  }
}
