import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SequencesService } from '../common/services/sequences.service';
import { SubscriptionsStateService } from './subscriptions-state.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { CreateSubscriptionFromTemplateDto } from './dto/create-subscription-from-template.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { TransitionSubscriptionDto } from './dto/transition-subscription.dto';
import { SubscriptionQueryDto } from './dto/subscription-query.dto';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Role, SubscriptionStatus, Prisma } from '@prisma/client';
import { PaginatedResult, SortOrder } from '../common/dto/pagination.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequencesService: SequencesService,
    private readonly stateService: SubscriptionsStateService,
  ) {}

  /**
   * Admin / Staff: Create a new Subscription manually in DRAFT status
   */
  async create(dto: CreateSubscriptionDto, currentUser: AuthenticatedUser) {
    // 1. Verify Customer exists
    const customer = await this.prisma.customerProfile.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer) {
      throw new NotFoundException(`Customer profile with ID '${dto.customerId}' not found`);
    }

    // 2. Verify Plan exists & is active
    const plan = await this.prisma.plan.findUnique({
      where: { id: dto.planId },
    });
    if (!plan || !plan.isActive) {
      throw new BadRequestException(`Plan with ID '${dto.planId}' not found or is currently inactive`);
    }

    // 3. Verify Plan availability dates
    const startDate = new Date(dto.startDate);
    if (plan.availableFrom && startDate < new Date(plan.availableFrom)) {
      throw new BadRequestException(`Plan is only available from ${plan.availableFrom}`);
    }
    if (plan.availableTo && startDate > new Date(plan.availableTo)) {
      throw new BadRequestException(`Plan availability expired on ${plan.availableTo}`);
    }

    // 4. Validate lines
    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('A subscription must contain at least one line item');
    }

    let totalQuantity = 0;
    const lineCreates: Prisma.SubscriptionLineCreateWithoutSubscriptionInput[] = [];

    for (const line of dto.lines) {
      const product = await this.prisma.product.findUnique({
        where: { id: line.productId },
        include: { variants: true },
      });

      if (!product || !product.isActive) {
        throw new BadRequestException(`Product with ID '${line.productId}' not found or is inactive`);
      }

      let extraPrice = 0;
      if (line.variantId) {
        const variant = product.variants.find((v) => v.id === line.variantId && v.isActive);
        if (!variant) {
          throw new BadRequestException(
            `Variant with ID '${line.variantId}' is invalid for product '${product.name}'`,
          );
        }
        extraPrice = Number(variant.extraPrice);
      }

      const unitPrice =
        line.unitPrice !== undefined
          ? Number(line.unitPrice)
          : Number(product.salesPrice) + extraPrice;

      const lineAmount = unitPrice * line.quantity;
      const taxId = line.taxId || product.defaultTaxId || undefined;

      totalQuantity += line.quantity;

      lineCreates.push({
        product: { connect: { id: product.id } },
        variant: line.variantId ? { connect: { id: line.variantId } } : undefined,
        tax: taxId ? { connect: { id: taxId } } : undefined,
        quantity: line.quantity,
        unitPrice: new Prisma.Decimal(unitPrice),
        lineAmount: new Prisma.Decimal(lineAmount),
      });
    }

    if (totalQuantity < plan.minQuantity) {
      throw new BadRequestException(
        `Total line quantity (${totalQuantity}) does not satisfy plan minimum quantity (${plan.minQuantity})`,
      );
    }

    // 5. Generate collision-free sequence number
    const number = await this.sequencesService.getNextSubscriptionNumber();

    // 6. Create subscription atomically with lines
    const subscription = await this.prisma.subscription.create({
      data: {
        number,
        customerId: dto.customerId,
        planId: dto.planId,
        startDate,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        paymentTerms: dto.paymentTerms,
        status: SubscriptionStatus.DRAFT,
        createdById: currentUser.id,
        notes: dto.notes?.trim(),
        lines: {
          create: lineCreates,
        },
      },
      include: {
        customer: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        plan: true,
        lines: {
          include: {
            product: true,
            variant: true,
            tax: true,
          },
        },
      },
    });

    // 7. Audit log (resilient to transient connection drops)
    try {
      await this.prisma.auditLog.create({
        data: {
          entityType: 'SUBSCRIPTION',
          entityId: subscription.id,
          action: 'CREATE_DRAFT',
          toStatus: SubscriptionStatus.DRAFT,
          userId: currentUser.id,
          metadata: {
            subscriptionNumber: subscription.number,
            totalQuantity,
          },
        },
      });
    } catch {
      // Non-blocking for audit log
    }

    return subscription;
  }

  /**
   * Sales Rep / Staff: Instantiate a Subscription Quotation directly from a Quotation Template
   */
  async createFromTemplate(
    dto: CreateSubscriptionFromTemplateDto,
    currentUser: AuthenticatedUser,
  ) {
    // 1. Verify Customer
    const customer = await this.prisma.customerProfile.findUnique({
      where: { id: dto.customerId },
    });
    if (!customer) {
      throw new NotFoundException(`Customer profile with ID '${dto.customerId}' not found`);
    }

    // 2. Fetch Quotation Template with Lines & Relations
    const template = await this.prisma.quotationTemplate.findUnique({
      where: { id: dto.templateId },
      include: {
        plan: true,
        lines: {
          include: {
            product: true,
            variant: true,
          },
        },
      },
    });

    if (!template || !template.isActive) {
      throw new BadRequestException(
        `Quotation template with ID '${dto.templateId}' not found or is inactive`,
      );
    }

    if (!template.plan || !template.plan.isActive) {
      throw new BadRequestException(
        `Template plan '${template.plan?.name}' is currently inactive`,
      );
    }

    const startDate = new Date(dto.startDate);
    if (template.plan.availableFrom && startDate < new Date(template.plan.availableFrom)) {
      throw new BadRequestException(`Plan is only available from ${template.plan.availableFrom}`);
    }
    if (template.plan.availableTo && startDate > new Date(template.plan.availableTo)) {
      throw new BadRequestException(`Plan availability expired on ${template.plan.availableTo}`);
    }

    if (!template.lines || template.lines.length === 0) {
      throw new BadRequestException('Quotation template contains zero line items');
    }

    // 3. Resolve line items & current pricing
    let totalQuantity = 0;
    const lineCreates: Prisma.SubscriptionLineCreateWithoutSubscriptionInput[] = [];

    for (const tplLine of template.lines) {
      if (!tplLine.product || !tplLine.product.isActive) {
        throw new BadRequestException(
          `Product in template line '${tplLine.product?.name}' is inactive`,
        );
      }

      const extraPrice = tplLine.variant?.isActive ? Number(tplLine.variant.extraPrice) : 0;
      const unitPrice = Number(tplLine.product.salesPrice) + extraPrice;
      const lineAmount = unitPrice * tplLine.quantity;
      const taxId = tplLine.product.defaultTaxId || undefined;

      totalQuantity += tplLine.quantity;

      lineCreates.push({
        product: { connect: { id: tplLine.productId } },
        variant: tplLine.variantId ? { connect: { id: tplLine.variantId } } : undefined,
        tax: taxId ? { connect: { id: taxId } } : undefined,
        quantity: tplLine.quantity,
        unitPrice: new Prisma.Decimal(unitPrice),
        lineAmount: new Prisma.Decimal(lineAmount),
      });
    }

    if (totalQuantity < template.plan.minQuantity) {
      throw new BadRequestException(
        `Template line total quantity (${totalQuantity}) does not satisfy plan minimum (${template.plan.minQuantity})`,
      );
    }

    // 4. Calculate quote expiry date
    const quoteExpiryDate = new Date(startDate);
    quoteExpiryDate.setDate(quoteExpiryDate.getDate() + (template.validityDays || 30));

    // 5. Generate sequence number
    const number = await this.sequencesService.getNextSubscriptionNumber();

    // 6. Create subscription in QUOTATION status
    const subscription = await this.prisma.subscription.create({
      data: {
        number,
        customerId: dto.customerId,
        planId: template.planId,
        startDate,
        paymentTerms: dto.paymentTerms,
        status: SubscriptionStatus.QUOTATION,
        quoteExpiryDate,
        createdById: currentUser.id,
        notes: dto.notes?.trim() || `Instantiated from template: ${template.name}`,
        lines: {
          create: lineCreates,
        },
      },
      include: {
        customer: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        plan: true,
        lines: {
          include: {
            product: true,
            variant: true,
            tax: true,
          },
        },
      },
    });

    // 7. Audit log (resilient to transient connection drops)
    try {
      await this.prisma.auditLog.create({
        data: {
          entityType: 'SUBSCRIPTION',
          entityId: subscription.id,
          action: 'INSTANTIATE_FROM_TEMPLATE',
          toStatus: SubscriptionStatus.QUOTATION,
          userId: currentUser.id,
          metadata: {
            templateId: template.id,
            templateName: template.name,
            validityDays: template.validityDays,
          },
        },
      });
    } catch {
      // Non-blocking for audit log
    }

    return subscription;
  }

  /**
   * List Subscriptions with Search, Filter & Tenant Portal Data Isolation
   */
  async findAll(query: SubscriptionQueryDto, currentUser: AuthenticatedUser): Promise<PaginatedResult<any>> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.SubscriptionWhereInput = {};

    // Strict Tenant Isolation for Customer role
    if (currentUser.role === Role.CUSTOMER) {
      if (!currentUser.customerProfileId) {
        throw new ForbiddenException('User has no associated customer profile');
      }
      where.customerId = currentUser.customerProfileId;
    } else {
      if (query.customerId) {
        where.customerId = query.customerId;
      }
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.planId) {
      where.planId = query.planId;
    }

    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { number: { contains: s, mode: 'insensitive' } },
        { notes: { contains: s, mode: 'insensitive' } },
        { customer: { company: { contains: s, mode: 'insensitive' } } },
        { customer: { user: { name: { contains: s, mode: 'insensitive' } } } },
        { customer: { user: { email: { contains: s, mode: 'insensitive' } } } },
      ];
    }

    const sortField = query.sort || 'createdAt';
    const sortOrder: Prisma.SortOrder = query.order === SortOrder.ASC ? 'asc' : 'desc';

    const [total, data] = await Promise.all([
      this.prisma.subscription.count({ where }),
      this.prisma.subscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortField]: sortOrder },
        include: {
          customer: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          plan: true,
          lines: {
            include: {
              product: true,
              variant: true,
              tax: true,
            },
          },
          _count: {
            select: { invoices: true },
          },
        },
      }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Detail view with Tenant Isolation check
   */
  async findById(id: string, currentUser: AuthenticatedUser) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        plan: true,
        lines: {
          include: {
            product: true,
            variant: true,
            tax: true,
          },
        },
        invoices: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID '${id}' not found`);
    }

    // Portal data isolation check
    if (currentUser.role === Role.CUSTOMER) {
      if (subscription.customerId !== currentUser.customerProfileId) {
        throw new ForbiddenException(
          'Access denied: You do not have permission to view this subscription',
        );
      }
    }

    return subscription;
  }

  /**
   * Update draft/quotation subscription headers
   */
  async update(id: string, dto: UpdateSubscriptionDto, currentUser: AuthenticatedUser) {
    const existing = await this.prisma.subscription.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Subscription with ID '${id}' not found`);
    }

    if (
      existing.status !== SubscriptionStatus.DRAFT &&
      existing.status !== SubscriptionStatus.QUOTATION
    ) {
      throw new BadRequestException(
        `Cannot edit header details of subscription in '${existing.status}' status`,
      );
    }

    return this.prisma.subscription.update({
      where: { id },
      data: {
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
        paymentTerms: dto.paymentTerms,
        notes: dto.notes !== undefined ? dto.notes?.trim() : undefined,
      },
      include: {
        customer: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        plan: true,
        lines: {
          include: {
            product: true,
            variant: true,
            tax: true,
          },
        },
      },
    });
  }

  /**
   * Execute State Machine Transition
   */
  async transitionStatus(
    id: string,
    dto: TransitionSubscriptionDto,
    currentUser: AuthenticatedUser,
  ) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
      include: {
        plan: true,
        lines: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID '${id}' not found`);
    }

    return this.stateService.transition(
      subscription,
      dto.status,
      currentUser,
      dto.reason,
    );
  }

  /**
   * Admin: Discard / Cancel an unconfirmed draft
   */
  async discardDraft(id: string, currentUser: AuthenticatedUser) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID '${id}' not found`);
    }

    if (subscription.status !== SubscriptionStatus.DRAFT) {
      throw new BadRequestException(
        `Only subscriptions in DRAFT status can be discarded. Current status: ${subscription.status}`,
      );
    }

    await this.prisma.subscription.delete({
      where: { id },
    });

    return {
      message: `Draft subscription '${subscription.number}' discarded successfully`,
    };
  }
}
