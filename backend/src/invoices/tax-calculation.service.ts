import { Injectable } from '@nestjs/common';
import { Tax, TaxType, Prisma } from '@prisma/client';

export interface CalculatedLine {
  baseSubtotal: number;
  discount: number;
  taxableAmount: number;
  taxRate: number;
  taxAmount: number;
  lineTotal: number;
}

export interface CalculatedInvoiceTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
}

@Injectable()
export class TaxCalculationService {
  /**
   * Round to 2 decimal places to guarantee financial precision
   */
  round(amount: number): number {
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }

  /**
   * Calculate line level amounts with percentage or fixed tax
   */
  calculateLine(
    unitPrice: number,
    quantity: number,
    discount: number = 0,
    tax?: { type: TaxType; rate: Prisma.Decimal | number } | null,
  ): CalculatedLine {
    const baseSubtotal = this.round(unitPrice * quantity);
    const safeDiscount = this.round(Math.min(discount, baseSubtotal));
    const taxableAmount = this.round(Math.max(0, baseSubtotal - safeDiscount));

    let taxAmount = 0;
    let taxRate = 0;

    if (tax) {
      taxRate = Number(tax.rate);
      if (tax.type === TaxType.PERCENTAGE) {
        // e.g. 18% GST -> rate = 0.1800
        taxAmount = this.round(taxableAmount * taxRate);
      } else if (tax.type === TaxType.FIXED) {
        // Fixed fee per unit quantity
        taxAmount = this.round(taxRate * quantity);
      }
    }

    const lineTotal = this.round(taxableAmount + taxAmount);

    return {
      baseSubtotal,
      discount: safeDiscount,
      taxableAmount,
      taxRate,
      taxAmount,
      lineTotal,
    };
  }

  /**
   * Aggregate line totals into invoice level totals
   */
  calculateTotals(lines: CalculatedLine[]): CalculatedInvoiceTotals {
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    let grandTotal = 0;

    for (const l of lines) {
      subtotal += l.baseSubtotal;
      discountTotal += l.discount;
      taxTotal += l.taxAmount;
      grandTotal += l.lineTotal;
    }

    return {
      subtotal: this.round(subtotal),
      discountTotal: this.round(discountTotal),
      taxTotal: this.round(taxTotal),
      grandTotal: this.round(grandTotal),
    };
  }
}

