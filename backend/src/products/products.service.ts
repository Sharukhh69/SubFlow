import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateVariantDto, UpdateVariantDto } from './dto/create-variant.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async createProduct(dto: CreateProductDto) {
    if (dto.defaultTaxId) {
      const tax = await this.prisma.tax.findUnique({
        where: { id: dto.defaultTaxId },
      });
      if (!tax || !tax.isActive) {
        throw new BadRequestException('Default tax rule does not exist or is inactive');
      }
    }

    // Atomic nested write (PgBouncer pooler safe)
    return this.prisma.product.create({
      data: {
        name: dto.name.trim(),
        type: dto.type,
        salesPrice: new Prisma.Decimal(dto.salesPrice),
        costPrice: new Prisma.Decimal(dto.costPrice),
        notes: dto.notes?.trim(),
        defaultTaxId: dto.defaultTaxId,
        isActive: true,
        variants: dto.variants && dto.variants.length > 0 ? {
          create: dto.variants.map((v) => ({
            attributeName: v.attributeName.trim(),
            attributeValue: v.attributeValue.trim(),
            extraPrice: new Prisma.Decimal(v.extraPrice || 0),
            isActive: true,
          })),
        } : undefined,
      },
      include: {
        variants: true,
        defaultTax: true,
      },
    });
  }

  async findAll(query: ProductQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      isActive: query.onlyActive ? true : undefined,
      type: query.type || undefined,
      name: query.search
        ? { contains: query.search.trim(), mode: 'insensitive' }
        : undefined,
    };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          variants: { where: { isActive: true } },
          defaultTax: true,
        },
      }),
      this.prisma.product.count({ where }),
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
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        variants: true,
        defaultTax: true,
      },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID "${id}" not found`);
    }

    return product;
  }

  async updateProduct(id: string, dto: UpdateProductDto) {
    await this.findById(id);

    if (dto.defaultTaxId) {
      const tax = await this.prisma.tax.findUnique({
        where: { id: dto.defaultTaxId },
      });
      if (!tax || !tax.isActive) {
        throw new BadRequestException('Default tax rule does not exist or is inactive');
      }
    }

    return this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
        type: dto.type,
        salesPrice: dto.salesPrice !== undefined ? new Prisma.Decimal(dto.salesPrice) : undefined,
        costPrice: dto.costPrice !== undefined ? new Prisma.Decimal(dto.costPrice) : undefined,
        notes: dto.notes !== undefined ? dto.notes?.trim() : undefined,
        defaultTaxId: dto.defaultTaxId,
        isActive: dto.isActive,
      },
      include: {
        variants: true,
        defaultTax: true,
      },
    });
  }

  // Safe soft-delete check (Assumption #15)
  async archiveProduct(id: string) {
    await this.findById(id);

    const [subCount, invCount, quoteCount] = await Promise.all([
      this.prisma.subscriptionLine.count({ where: { productId: id } }),
      this.prisma.invoiceLine.count({ where: { productId: id } }),
      this.prisma.quotationTemplateLine.count({ where: { productId: id } }),
    ]);

    const isReferenced = subCount > 0 || invCount > 0 || quoteCount > 0;

    if (isReferenced) {
      await this.prisma.product.update({
        where: { id },
        data: { isActive: false },
      });
      await this.prisma.productVariant.updateMany({
        where: { productId: id },
        data: { isActive: false },
      });
      return {
        message: 'Product is referenced in historical records and was soft-deactivated (isActive=false)',
        softDeleted: true,
      };
    }

    await this.prisma.product.delete({ where: { id } });
    return {
      message: 'Product deleted permanently',
      softDeleted: false,
    };
  }

  async addVariant(productId: string, dto: CreateVariantDto) {
    await this.findById(productId);

    return this.prisma.productVariant.create({
      data: {
        productId,
        attributeName: dto.attributeName.trim(),
        attributeValue: dto.attributeValue.trim(),
        extraPrice: new Prisma.Decimal(dto.extraPrice || 0),
        isActive: true,
      },
    });
  }

  async updateVariant(variantId: string, dto: UpdateVariantDto) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
    });

    if (!variant) {
      throw new NotFoundException(`Product variant with ID "${variantId}" not found`);
    }

    return this.prisma.productVariant.update({
      where: { id: variantId },
      data: {
        attributeName: dto.attributeName ? dto.attributeName.trim() : undefined,
        attributeValue: dto.attributeValue ? dto.attributeValue.trim() : undefined,
        extraPrice: dto.extraPrice !== undefined ? new Prisma.Decimal(dto.extraPrice) : undefined,
        isActive: dto.isActive,
      },
    });
  }
}
