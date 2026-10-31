import { Injectable } from '@nestjs/common';
import { Discount, DiscountProduct, DiscountScope, DiscountType } from '@prisma/client';

export type DiscountWithProducts = Discount & {
  products: DiscountProduct[];
};

export interface EvaluatorLineItem {
  productId?: string | null;
  quantity: number;
  unitPrice: number;
}

export interface DiscountEvaluationResult {
  bestDiscount: DiscountWithProducts | null;
  discountAmount: number;
}

@Injectable()
export class DiscountEvaluatorService {
  /**
   * Round to 2 decimal places for financial calculations
   */
  round(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  /**
   * Evaluates active discounts and returns the best single discount (Assumption 6: non-stacking)
   */
  evaluateBestDiscount(
    discounts: DiscountWithProducts[],
    subtotal: number,
    lines: EvaluatorLineItem[],
    targetDate: Date = new Date(),
  ): DiscountEvaluationResult {
    let bestDiscount: DiscountWithProducts | null = null;
    let maxDiscountAmount = 0;

    const totalQuantity = lines.reduce((acc, l) => acc + (l.quantity || 0), 0);
    const targetTime = new Date(targetDate).setHours(0, 0, 0, 0);

    for (const discount of discounts) {
      if (!discount.isActive) continue;

      // 1. Check Usage Limits
      if (discount.usageLimit !== null && discount.usageLimit !== undefined) {
        if (discount.usedCount >= discount.usageLimit) continue;
      }

      // 2. Check Date Validity Window
      if (discount.startDate) {
        const startTime = new Date(discount.startDate).setHours(0, 0, 0, 0);
        if (targetTime < startTime) continue;
      }
      if (discount.endDate) {
        const endTime = new Date(discount.endDate).setHours(23, 59, 59, 999);
        if (targetTime > endTime) continue;
      }

      // 3. Check Minimum Purchase Amount
      if (discount.minPurchaseAmount) {
        const minSpend = Number(discount.minPurchaseAmount);
        if (subtotal < minSpend) continue;
      }

      // 4. Check Minimum Total Items Quantity
      if (discount.minQuantity && discount.minQuantity > 0) {
        if (totalQuantity < discount.minQuantity) continue;
      }

      // 5. Calculate Discount Amount based on Scope
      let calculatedAmount = 0;
      const discountValue = Number(discount.value);

      if (discount.scope === DiscountScope.WHOLE_SUBSCRIPTION) {
        if (discount.type === DiscountType.PERCENTAGE) {
          calculatedAmount = this.round(subtotal * (discountValue / 100));
        } else if (discount.type === DiscountType.FIXED) {
          calculatedAmount = this.round(Math.min(subtotal, discountValue));
        }
      } else if (discount.scope === DiscountScope.SPECIFIC_PRODUCTS) {
        const targetProductIds = new Set(discount.products.map((p) => p.productId));
        const matchingLines = lines.filter(
          (l) => l.productId && targetProductIds.has(l.productId),
        );

        if (matchingLines.length === 0) continue;

        const eligibleLineSubtotal = matchingLines.reduce(
          (sum, l) => sum + Number(l.unitPrice) * l.quantity,
          0,
        );

        if (discount.type === DiscountType.PERCENTAGE) {
          calculatedAmount = this.round(eligibleLineSubtotal * (discountValue / 100));
        } else if (discount.type === DiscountType.FIXED) {
          calculatedAmount = this.round(Math.min(eligibleLineSubtotal, discountValue));
        }
      }

      // 6. Maximize Savings: Pick the best single discount
      if (calculatedAmount > maxDiscountAmount) {
        maxDiscountAmount = calculatedAmount;
        bestDiscount = discount;
      }
    }

    return {
      bestDiscount,
      discountAmount: maxDiscountAmount,
    };
  }
}
