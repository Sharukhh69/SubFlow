import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DiscountEvaluatorService } from './discount-evaluator.service';
import { DiscountsService } from './discounts.service';
import { DiscountScope, DiscountType, Prisma } from '@prisma/client';

describe('Discounts & Promotional Engine', () => {
  let evaluator: DiscountEvaluatorService;
  let service: DiscountsService;
  let mockPrisma: any;

  beforeEach(() => {
    evaluator = new DiscountEvaluatorService();

    mockPrisma = {
      discount: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      discountProduct: {
        deleteMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit_1' }),
      },
    };

    service = new DiscountsService(mockPrisma, evaluator);
  });

  describe('DiscountEvaluatorService (Pure Strategy & Non-Stacking)', () => {
    it('should select best single percentage discount for whole subscription', () => {
      const discounts: any[] = [
        {
          id: 'disc_10',
          name: '10% Off',
          type: DiscountType.PERCENTAGE,
          value: new Prisma.Decimal(10),
          scope: DiscountScope.WHOLE_SUBSCRIPTION,
          isActive: true,
          products: [],
        },
        {
          id: 'disc_20',
          name: '20% Off',
          type: DiscountType.PERCENTAGE,
          value: new Prisma.Decimal(20),
          scope: DiscountScope.WHOLE_SUBSCRIPTION,
          isActive: true,
          products: [],
        },
      ];

      const lines = [{ productId: 'p1', quantity: 2, unitPrice: 1000 }];
      const subtotal = 2000;

      const result = evaluator.evaluateBestDiscount(discounts, subtotal, lines);

      expect(result.bestDiscount?.id).toBe('disc_20');
      expect(result.discountAmount).toBe(400); // 20% of 2000
    });

    it('should correctly evaluate fixed discount vs percentage and pick the higher value', () => {
      const discounts: any[] = [
        {
          id: 'disc_fixed_300',
          name: 'Rs. 300 Flat Off',
          type: DiscountType.FIXED,
          value: new Prisma.Decimal(300),
          scope: DiscountScope.WHOLE_SUBSCRIPTION,
          isActive: true,
          products: [],
        },
        {
          id: 'disc_pct_10',
          name: '10% Off',
          type: DiscountType.PERCENTAGE,
          value: new Prisma.Decimal(10),
          scope: DiscountScope.WHOLE_SUBSCRIPTION,
          isActive: true,
          products: [],
        },
      ];

      // Cart subtotal: 2000. 10% is 200, but flat 300 is 300.
      const lines = [{ productId: 'p1', quantity: 2, unitPrice: 1000 }];
      const result = evaluator.evaluateBestDiscount(discounts, 2000, lines);

      expect(result.bestDiscount?.id).toBe('disc_fixed_300');
      expect(result.discountAmount).toBe(300);
    });

    it('should skip discount if cart subtotal is below minPurchaseAmount', () => {
      const discounts: any[] = [
        {
          id: 'disc_high_spend',
          name: 'Rs. 500 off on 5000+',
          type: DiscountType.FIXED,
          value: new Prisma.Decimal(500),
          minPurchaseAmount: new Prisma.Decimal(5000),
          scope: DiscountScope.WHOLE_SUBSCRIPTION,
          isActive: true,
          products: [],
        },
      ];

      const lines = [{ productId: 'p1', quantity: 1, unitPrice: 3000 }];
      const result = evaluator.evaluateBestDiscount(discounts, 3000, lines);

      expect(result.bestDiscount).toBeNull();
      expect(result.discountAmount).toBe(0);
    });

    it('should skip discount if cart total items quantity is below minQuantity', () => {
      const discounts: any[] = [
        {
          id: 'disc_bulk',
          name: 'Bulk order discount',
          type: DiscountType.PERCENTAGE,
          value: new Prisma.Decimal(15),
          minQuantity: 5,
          scope: DiscountScope.WHOLE_SUBSCRIPTION,
          isActive: true,
          products: [],
        },
      ];

      const lines = [{ productId: 'p1', quantity: 3, unitPrice: 500 }];
      const result = evaluator.evaluateBestDiscount(discounts, 1500, lines);

      expect(result.bestDiscount).toBeNull();
      expect(result.discountAmount).toBe(0);
    });

    it('should skip discount if usage limit has been reached', () => {
      const discounts: any[] = [
        {
          id: 'disc_capped',
          name: 'First 10 redemptions only',
          type: DiscountType.PERCENTAGE,
          value: new Prisma.Decimal(25),
          usageLimit: 10,
          usedCount: 10, // Exhausted!
          scope: DiscountScope.WHOLE_SUBSCRIPTION,
          isActive: true,
          products: [],
        },
      ];

      const lines = [{ productId: 'p1', quantity: 1, unitPrice: 2000 }];
      const result = evaluator.evaluateBestDiscount(discounts, 2000, lines);

      expect(result.bestDiscount).toBeNull();
      expect(result.discountAmount).toBe(0);
    });

    it('should skip discount if target date is outside validity window', () => {
      const discounts: any[] = [
        {
          id: 'disc_expired',
          name: 'Expired Promo',
          type: DiscountType.PERCENTAGE,
          value: new Prisma.Decimal(50),
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-01-31'),
          scope: DiscountScope.WHOLE_SUBSCRIPTION,
          isActive: true,
          products: [],
        },
      ];

      const lines = [{ productId: 'p1', quantity: 1, unitPrice: 1000 }];
      const result = evaluator.evaluateBestDiscount(discounts, 1000, lines, new Date('2026-06-01'));

      expect(result.bestDiscount).toBeNull();
      expect(result.discountAmount).toBe(0);
    });

    it('should calculate product-specific discounts only on eligible lines', () => {
      const discounts: any[] = [
        {
          id: 'disc_addon_only',
          name: '20% off Addon Product',
          type: DiscountType.PERCENTAGE,
          value: new Prisma.Decimal(20),
          scope: DiscountScope.SPECIFIC_PRODUCTS,
          isActive: true,
          products: [{ productId: 'addon_prod_id' }],
        },
      ];

      const lines = [
        { productId: 'main_software_id', quantity: 1, unitPrice: 3000 },
        { productId: 'addon_prod_id', quantity: 2, unitPrice: 500 }, // Subtotal: 1000
      ];

      const result = evaluator.evaluateBestDiscount(discounts, 4000, lines);

      expect(result.bestDiscount?.id).toBe('disc_addon_only');
      expect(result.discountAmount).toBe(200); // 20% of 1000, not 4000!
    });
  });

  describe('DiscountsService CRUD & State Management', () => {
    it('should reject creation if startDate is after endDate', async () => {
      await expect(
        service.create({
          name: 'Invalid Promo',
          type: DiscountType.FIXED,
          value: 100,
          startDate: '2026-12-31',
          endDate: '2026-01-01',
        }),
      ).rejects.toThrow('startDate cannot be after endDate');
    });

    it('should reject specific products scope if no productIds provided', async () => {
      await expect(
        service.create({
          name: 'Product Promo',
          type: DiscountType.PERCENTAGE,
          value: 10,
          scope: DiscountScope.SPECIFIC_PRODUCTS,
          productIds: [],
        }),
      ).rejects.toThrow('productIds must be specified when scope is SPECIFIC_PRODUCTS');
    });

    it('should atomically increment usedCount', async () => {
      mockPrisma.discount.update.mockResolvedValue({ id: 'disc_1', usedCount: 1 });

      const res = await service.incrementUsage('disc_1');
      expect(res.usedCount).toBe(1);
      expect(mockPrisma.discount.update).toHaveBeenCalledWith({
        where: { id: 'disc_1' },
        data: { usedCount: { increment: 1 } },
      });
    });
  });
});
