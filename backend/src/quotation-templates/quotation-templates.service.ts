import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuotationTemplateDto } from './dto/create-quotation-template.dto';
import { UpdateQuotationTemplateDto } from './dto/update-quotation-template.dto';

@Injectable()
export class QuotationTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async createTemplate(dto: CreateQuotationTemplateDto) {
    const plan = await this.prisma.plan.findUnique({
      where: { id: dto.planId },
    });

    if (!plan || !plan.isActive) {
      throw new BadRequestException('Referenced plan does not exist or is inactive');
    }

    if (!dto.lines || dto.lines.length === 0) {
      throw new BadRequestException('Quotation template must contain at least one product line');
    }

    // Verify all products exist
    for (const line of dto.lines) {
      const product = await this.prisma.product.findUnique({
        where: { id: line.productId },
      });
      if (!product || !product.isActive) {
        throw new BadRequestException(`Product with ID "${line.productId}" does not exist or is inactive`);
      }
      if (line.variantId) {
        const variant = await this.prisma.productVariant.findUnique({
          where: { id: line.variantId },
        });
        if (!variant || !variant.isActive || variant.productId !== line.productId) {
          throw new BadRequestException(`Variant with ID "${line.variantId}" is invalid for product "${line.productId}"`);
        }
      }
    }

    // Atomic nested write (PgBouncer pooler safe)
    return this.prisma.quotationTemplate.create({
      data: {
        name: dto.name.trim(),
        planId: dto.planId,
        validityDays: dto.validityDays || 30,
        isActive: true,
        lines: {
          create: dto.lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId || null,
            quantity: line.quantity || 1,
          })),
        },
      },
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
  }

  async findAll(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.quotationTemplate.findMany({
        where: { isActive: true },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          plan: true,
          lines: {
            include: {
              product: true,
              variant: true,
            },
          },
        },
      }),
      this.prisma.quotationTemplate.count({ where: { isActive: true } }),
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
    const template = await this.prisma.quotationTemplate.findUnique({
      where: { id },
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

    if (!template) {
      throw new NotFoundException(`Quotation template with ID "${id}" not found`);
    }

    return template;
  }

  async updateTemplate(id: string, dto: UpdateQuotationTemplateDto) {
    await this.findById(id);

    if (dto.planId) {
      const plan = await this.prisma.plan.findUnique({
        where: { id: dto.planId },
      });
      if (!plan || !plan.isActive) {
        throw new BadRequestException('Referenced plan does not exist or is inactive');
      }
    }

    if (dto.lines && dto.lines.length > 0) {
      await this.prisma.quotationTemplateLine.deleteMany({
        where: { templateId: id },
      });
    }

    return this.prisma.quotationTemplate.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
        planId: dto.planId,
        validityDays: dto.validityDays,
        isActive: dto.isActive,
        lines: dto.lines && dto.lines.length > 0 ? {
          create: dto.lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId || null,
            quantity: line.quantity || 1,
          })),
        } : undefined,
      },
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
  }

  async archiveTemplate(id: string) {
    await this.findById(id);

    await this.prisma.quotationTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    return { message: 'Quotation template archived successfully' };
  }
}
