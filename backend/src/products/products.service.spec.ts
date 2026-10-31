import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProductType, Prisma } from '@prisma/client';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('ProductsService (Unit)', () => {
  let productsService: ProductsService;

  const mockProduct = {
    id: 'prod-123',
    name: 'Brightloop CRM',
    type: ProductType.SOFTWARE,
    salesPrice: new Prisma.Decimal(1200.0),
    costPrice: new Prisma.Decimal(450.0),
    notes: 'Base software',
    defaultTaxId: null,
    isActive: true,
    variants: [],
    defaultTax: null,
  };

  const mockPrismaService = {
    product: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    productVariant: {
      createMany: vi.fn(),
      updateMany: vi.fn(),
    },
    subscriptionLine: {
      count: vi.fn(),
    },
    invoiceLine: {
      count: vi.fn(),
    },
    quotationTemplateLine: {
      count: vi.fn(),
    },
    tax: {
      findUnique: vi.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    productsService = module.get<ProductsService>(ProductsService);
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(productsService).toBeDefined();
  });

  describe('createProduct', () => {
    it('should create product with variants in transaction', async () => {
      mockPrismaService.product.create.mockResolvedValue({
        ...mockProduct,
        variants: [
          {
            id: 'var-1',
            productId: 'prod-123',
            attributeName: 'Brand',
            attributeValue: 'Odoo',
            extraPrice: new Prisma.Decimal(560.0),
            isActive: true,
          },
        ],
      });

      const result = await productsService.createProduct({
        name: 'Brightloop CRM',
        type: ProductType.SOFTWARE,
        salesPrice: 1200.0,
        costPrice: 450.0,
        variants: [
          {
            attributeName: 'Brand',
            attributeValue: 'Odoo',
            extraPrice: 560.0,
          },
        ],
      });

      expect(result).toBeDefined();
      expect(result.variants).toHaveLength(1);
      expect(result.variants[0].attributeValue).toBe('Odoo');
      expect(mockPrismaService.product.create).toHaveBeenCalled();
    });
  });

  describe('archiveProduct (Assumption #15 Safe Soft-Delete)', () => {
    it('should soft-delete (isActive=false) if product is referenced in subscriptions', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.subscriptionLine.count.mockResolvedValue(3); // 3 references!
      mockPrismaService.invoiceLine.count.mockResolvedValue(0);
      mockPrismaService.quotationTemplateLine.count.mockResolvedValue(0);

      const result = await productsService.archiveProduct('prod-123');

      expect(result.softDeleted).toBe(true);
      expect(mockPrismaService.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-123' },
        data: { isActive: false },
      });
      expect(mockPrismaService.product.delete).not.toHaveBeenCalled();
    });

    it('should permanently delete if product has zero references', async () => {
      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockPrismaService.subscriptionLine.count.mockResolvedValue(0);
      mockPrismaService.invoiceLine.count.mockResolvedValue(0);
      mockPrismaService.quotationTemplateLine.count.mockResolvedValue(0);

      const result = await productsService.archiveProduct('prod-123');

      expect(result.softDeleted).toBe(false);
      expect(mockPrismaService.product.delete).toHaveBeenCalledWith({
        where: { id: 'prod-123' },
      });
      expect(mockPrismaService.product.update).not.toHaveBeenCalled();
    });
  });
});
