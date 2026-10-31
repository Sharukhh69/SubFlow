import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SequencesService } from '../common/services/sequences.service';
import { TaxCalculationService, CalculatedLine } from './tax-calculation.service';
import { InvoiceQueryDto } from './dto/invoice-query.dto';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import {
  Role,
  InvoiceStatus,
  SubscriptionStatus,
  PaymentTerms,
  BillingPeriod,
  DiscountScope,
  DiscountType,
  Prisma,
} from '@prisma/client';
import { PaginatedResult, SortOrder } from '../common/dto/pagination.dto';
import { DiscountEvaluatorService } from '../discounts/discount-evaluator.service';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sequencesService: SequencesService,
    private readonly taxCalculationService: TaxCalculationService,
    private readonly discountEvaluatorService: DiscountEvaluatorService,
  ) {}

  /**
   * Derive invoice due date based on payment terms
   */
  calculateDueDate(issueDate: Date, paymentTerms: PaymentTerms): Date {
    const due = new Date(issueDate);
    switch (paymentTerms) {
      case PaymentTerms.IMMEDIATE:
        break; // Same day
      case PaymentTerms.NET_15:
        due.setDate(due.getDate() + 15);
        break;
      case PaymentTerms.NET_30:
        due.setDate(due.getDate() + 30);
        break;
      case PaymentTerms.NET_60:
        due.setDate(due.getDate() + 60);
        break;
    }
    return due;
  }

  /**
   * Calculate end date for a billing period
   */
  calculatePeriodEnd(startDate: Date, billingPeriod: BillingPeriod): Date {
    const end = new Date(startDate);
    switch (billingPeriod) {
      case BillingPeriod.DAILY:
        end.setDate(end.getDate() + 1);
        break;
      case BillingPeriod.WEEKLY:
        end.setDate(end.getDate() + 7);
        break;
      case BillingPeriod.MONTHLY:
        end.setMonth(end.getMonth() + 1);
        break;
      case BillingPeriod.YEARLY:
        end.setFullYear(end.getFullYear() + 1);
        break;
    }
    return end;
  }

  /**
   * Format customer snapshot address
   */
  formatSnapshotAddress(customer: any): string {
    const parts = [
      customer.company,
      customer.addressLine1,
      customer.addressLine2,
      customer.city,
      customer.state,
      customer.pincode,
      customer.gstin ? `GSTIN: ${customer.gstin}` : null,
      customer.phone ? `Phone: ${customer.phone}` : null,
    ].filter(Boolean);

    return parts.join(', ');
  }

  /**
   * Core generator: Creates an Invoice from an active subscription
   */
  async createFromSubscription(
    subscription: any,
    billingStart: Date,
    billingEnd: Date,
    userId?: string,
  ) {
    // 1. Idempotency Check: (subscriptionId, billingPeriodStart)
    const existing = await this.prisma.invoice.findUnique({
      where: {
        subscriptionId_billingPeriodStart: {
          subscriptionId: subscription.id,
          billingPeriodStart: billingStart,
        },
      },
    });

    if (existing) {
      return { skipped: true, invoice: existing };
    }

    // 2. Snapshot Customer Details
    const customer = subscription.customer;
    const snapshotCustomerName = customer.company || customer.user.name;
    const snapshotCustomerEmail = customer.user.email;
    const snapshotCustomerAddress = this.formatSnapshotAddress(customer);

    // 3. Process lines with Tax Calculation & Promotional Discounts
    const calculatedLines: CalculatedLine[] = [];
    const lineWrites: Prisma.InvoiceLineCreateWithoutInvoiceInput[] = [];

    // Query active promotional discounts
    let activeDiscounts: any[] = [];
    try {
      if (this.prisma.discount) {
        activeDiscounts = await this.prisma.discount.findMany({
          where: { isActive: true },
          include: { products: true },
        });
      }
    } catch {
      activeDiscounts = [];
    }

    const rawSubtotal = subscription.lines.reduce(
      (sum: number, l: any) => sum + Number(l.unitPrice) * l.quantity,
      0,
    );

    const evaluatorLines = subscription.lines.map((subLine: any) => ({
      productId: subLine.productId,
      quantity: subLine.quantity,
      unitPrice: Number(subLine.unitPrice),
    }));

    const evaluation = this.discountEvaluatorService.evaluateBestDiscount(
      activeDiscounts,
      rawSubtotal,
      evaluatorLines,
      new Date(),
    );

    const bestDiscount = evaluation.bestDiscount;
    const discountAmount = evaluation.discountAmount;

    for (const subLine of subscription.lines) {
      let lineDiscount = 0;
      if (bestDiscount) {
        const lineBase = Number(subLine.unitPrice) * subLine.quantity;
        if (
          bestDiscount.scope === DiscountScope.SPECIFIC_PRODUCTS &&
          subLine.productId &&
          bestDiscount.products.some((p: any) => p.productId === subLine.productId)
        ) {
          if (bestDiscount.type === DiscountType.PERCENTAGE) {
            lineDiscount = this.taxCalculationService.round(
              lineBase * (Number(bestDiscount.value) / 100),
            );
          } else if (bestDiscount.type === DiscountType.FIXED) {
            lineDiscount = Math.min(lineBase, Number(bestDiscount.value));
          }
        } else if (bestDiscount.scope === DiscountScope.WHOLE_SUBSCRIPTION) {
          if (bestDiscount.type === DiscountType.PERCENTAGE) {
            lineDiscount = this.taxCalculationService.round(
              lineBase * (Number(bestDiscount.value) / 100),
            );
          } else if (bestDiscount.type === DiscountType.FIXED && rawSubtotal > 0) {
            lineDiscount = this.taxCalculationService.round(
              (lineBase / rawSubtotal) * Number(bestDiscount.value),
            );
          }
        }
      }

      const calc = this.taxCalculationService.calculateLine(
        Number(subLine.unitPrice),
        subLine.quantity,
        lineDiscount,
        subLine.tax,
      );
      calculatedLines.push(calc);

      const variantLabel = subLine.variant
        ? `${subLine.variant.attributeName}: ${subLine.variant.attributeValue}`
        : null;

      lineWrites.push({
        product: subLine.productId ? { connect: { id: subLine.productId } } : undefined,
        variant: subLine.variantId ? { connect: { id: subLine.variantId } } : undefined,
        tax: subLine.taxId ? { connect: { id: subLine.taxId } } : undefined,
        productName: subLine.product.name,
        variantLabel,
        quantity: subLine.quantity,
        unitPrice: new Prisma.Decimal(subLine.unitPrice),
        discount: new Prisma.Decimal(calc.discount),
        taxRate: new Prisma.Decimal(calc.taxRate),
        taxAmount: new Prisma.Decimal(calc.taxAmount),
        lineTotal: new Prisma.Decimal(calc.lineTotal),
      });
    }

    // 4. Totals Calculation
    const totals = this.taxCalculationService.calculateTotals(calculatedLines);
    const finalDiscountTotal = totals.discountTotal;
    const finalGrandTotal = totals.grandTotal;

    // 5. Sequence Numbering & Due Date
    const number = await this.sequencesService.getNextInvoiceNumber();
    const issueDate = new Date();
    const dueDate = this.calculateDueDate(issueDate, subscription.paymentTerms);

    // 6. Atomic Database Persistence
    const invoice = await this.prisma.invoice.create({
      data: {
        number,
        subscriptionId: subscription.id,
        customerId: subscription.customerId,
        snapshotCustomerName,
        snapshotCustomerEmail,
        snapshotCustomerAddress,
        billingPeriodStart: billingStart,
        billingPeriodEnd: billingEnd,
        issueDate,
        dueDate,
        subtotal: new Prisma.Decimal(totals.subtotal),
        discountTotal: new Prisma.Decimal(finalDiscountTotal),
        taxTotal: new Prisma.Decimal(totals.taxTotal),
        grandTotal: new Prisma.Decimal(finalGrandTotal),
        status: InvoiceStatus.DRAFT,
        lines: {
          create: lineWrites,
        },
      },
      include: {
        lines: true,
        customer: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        subscription: true,
      },
    });

    // Record Discount Redemption and update usage count atomically
    if (bestDiscount && discountAmount > 0) {
      try {
        if (this.prisma.discountRedemption) {
          await this.prisma.discountRedemption.create({
            data: {
              discountId: bestDiscount.id,
              invoiceId: invoice.id,
              amount: new Prisma.Decimal(discountAmount),
            },
          });
        }
        if (this.prisma.discount) {
          await this.prisma.discount.update({
            where: { id: bestDiscount.id },
            data: { usedCount: { increment: 1 } },
          });
        }
      } catch {
        // Non-blocking redemption record
      }
    }

    // 7. Audit log (resilient)
    try {
      await this.prisma.auditLog.create({
        data: {
          entityType: 'INVOICE',
          entityId: invoice.id,
          action: 'GENERATE_INVOICE',
          toStatus: InvoiceStatus.DRAFT,
          userId: userId || undefined,
          metadata: {
            invoiceNumber: invoice.number,
            subscriptionNumber: subscription.number,
            grandTotal: totals.grandTotal,
          },
        },
      });
    } catch {
      // Non-blocking
    }

    return { skipped: false, invoice };
  }

  /**
   * On-demand invoice generation for a specific subscription
   */
  async generateOnDemand(subscriptionId: string, currentUser: AuthenticatedUser) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        customer: {
          include: { user: true },
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

    if (!subscription) {
      throw new NotFoundException(`Subscription with ID '${subscriptionId}' not found`);
    }

    if (
      subscription.status !== SubscriptionStatus.ACTIVE &&
      subscription.status !== SubscriptionStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        `Cannot generate invoice for subscription in '${subscription.status}' status. Must be ACTIVE or CONFIRMED.`,
      );
    }

    const billingStart = subscription.nextBillingDate
      ? new Date(subscription.nextBillingDate)
      : new Date(subscription.startDate);

    const billingEnd = this.calculatePeriodEnd(billingStart, subscription.plan.billingPeriod);

    const result = await this.createFromSubscription(
      subscription,
      billingStart,
      billingEnd,
      currentUser.id,
    );

    if (result.skipped) {
      throw new BadRequestException(
        `An invoice already exists for subscription '${subscription.number}' for billing cycle starting ${billingStart.toISOString().split('T')[0]}`,
      );
    }

    // Advance next billing date
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        nextBillingDate: billingEnd,
      },
    });

    return result.invoice;
  }

  /**
   * List invoices with search, filters & tenant portal isolation
   */
  async findAll(query: InvoiceQueryDto, currentUser: AuthenticatedUser): Promise<PaginatedResult<any>> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.InvoiceWhereInput = {};

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

    if (query.subscriptionId) {
      where.subscriptionId = query.subscriptionId;
    }

    if (query.fromIssueDate || query.toIssueDate) {
      where.issueDate = {};
      if (query.fromIssueDate) where.issueDate.gte = new Date(query.fromIssueDate);
      if (query.toIssueDate) where.issueDate.lte = new Date(query.toIssueDate);
    }

    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { number: { contains: s, mode: 'insensitive' } },
        { snapshotCustomerName: { contains: s, mode: 'insensitive' } },
        { snapshotCustomerEmail: { contains: s, mode: 'insensitive' } },
      ];
    }

    const sortField = query.sort || 'createdAt';
    const sortOrder: Prisma.SortOrder = query.order === SortOrder.ASC ? 'asc' : 'desc';

    const [total, data] = await Promise.all([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
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
          subscription: {
            select: { id: true, number: true, status: true, planId: true },
          },
          lines: true,
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
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            product: true,
            variant: true,
            tax: true,
          },
        },
        customer: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        subscription: {
          include: { plan: true },
        },
        payments: true,
        discountRedemptions: {
          include: { discount: true },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID '${id}' not found`);
    }

    if (currentUser.role === Role.CUSTOMER) {
      if (invoice.customerId !== currentUser.customerProfileId) {
        throw new ForbiddenException(
          'Access denied: You do not have permission to view this invoice',
        );
      }
    }

    return invoice;
  }

  /**
   * Admin / Staff: Confirm draft invoice
   */
  async confirm(id: string, currentUser: AuthenticatedUser) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID '${id}' not found`);
    }

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT invoices can be confirmed. Current status is '${invoice.status}'`,
      );
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.CONFIRMED },
      include: { lines: true, customer: true },
    });

    try {
      await this.prisma.auditLog.create({
        data: {
          entityType: 'INVOICE',
          entityId: invoice.id,
          action: 'CONFIRM_INVOICE',
          fromStatus: InvoiceStatus.DRAFT,
          toStatus: InvoiceStatus.CONFIRMED,
          userId: currentUser.id,
          metadata: { invoiceNumber: invoice.number },
        },
      });
    } catch {
      // Non-blocking
    }

    return updated;
  }

  /**
   * Admin / Staff: Cancel invoice
   */
  async cancel(id: string, currentUser: AuthenticatedUser) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID '${id}' not found`);
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Paid invoices cannot be cancelled');
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.CANCELLED },
      include: { lines: true, customer: true },
    });

    try {
      await this.prisma.auditLog.create({
        data: {
          entityType: 'INVOICE',
          entityId: invoice.id,
          action: 'CANCEL_INVOICE',
          fromStatus: invoice.status,
          toStatus: InvoiceStatus.CANCELLED,
          userId: currentUser.id,
          metadata: { invoiceNumber: invoice.number },
        },
      });
    } catch {
      // Non-blocking
    }

    return updated;
  }

  /**
   * Render Printable HTML Invoice
   */
  async renderPrintableHtml(id: string, currentUser: AuthenticatedUser): Promise<string> {
    const invoice = await this.findById(id, currentUser);

    const lineRows = invoice.lines
      .map(
        (l: any, i: number) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${l.productName}</strong> ${l.variantLabel ? `(${l.variantLabel})` : ''}</td>
          <td style="text-align: right;">${l.quantity}</td>
          <td style="text-align: right;">₹${Number(l.unitPrice).toFixed(2)}</td>
          <td style="text-align: right;">${(Number(l.taxRate) * 100).toFixed(0)}% (₹${Number(l.taxAmount).toFixed(2)})</td>
          <td style="text-align: right;"><strong>₹${Number(l.lineTotal).toFixed(2)}</strong></td>
        </tr>`,
      )
      .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Tax Invoice - ${invoice.number}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 40px; color: #2D3748; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #E2E8F0; padding-bottom: 20px; }
    .company-title { font-size: 24px; font-weight: bold; color: #3182CE; }
    .invoice-title { font-size: 28px; font-weight: bold; text-align: right; color: #2D3748; }
    .meta { margin-top: 20px; display: flex; justify-content: space-between; }
    .bill-to { width: 50%; }
    .invoice-details { width: 40%; text-align: right; }
    table { width: 100%; border-collapse: collapse; margin-top: 30px; }
    th { background: #EDF2F7; text-align: left; padding: 10px; border-bottom: 2px solid #CBD5E0; }
    td { padding: 10px; border-bottom: 1px solid #E2E8F0; }
    .totals { margin-top: 20px; float: right; width: 300px; }
    .totals-row { display: flex; justify-content: space-between; padding: 6px 0; }
    .grand-total { font-size: 18px; font-weight: bold; border-top: 2px solid #2D3748; border-bottom: 2px solid #2D3748; padding: 8px 0; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .badge-CONFIRMED { background: #C6F6D5; color: #22543D; }
    .badge-DRAFT { background: #FEFCBF; color: #744210; }
    .badge-PAID { background: #BEE3F8; color: #2A4365; }
    .badge-CANCELLED { background: #FED7D7; color: #742A2A; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-title">Brightloop Software Ltd</div>
      <div>100 Innovation Boulevard, Tech Park</div>
      <div>Bengaluru, Karnataka - 560100</div>
      <div>GSTIN: 29AAAAA0000A1Z5</div>
    </div>
    <div>
      <div class="invoice-title">TAX INVOICE</div>
      <div><strong>${invoice.number}</strong></div>
      <div>Status: <span class="badge badge-${invoice.status}">${invoice.status}</span></div>
    </div>
  </div>

  <div class="meta">
    <div class="bill-to">
      <strong>Billed To:</strong><br>
      ${invoice.snapshotCustomerName}<br>
      ${invoice.snapshotCustomerEmail}<br>
      ${invoice.snapshotCustomerAddress || 'Address on file'}
    </div>
    <div class="invoice-details">
      <strong>Issue Date:</strong> ${invoice.issueDate.toISOString().split('T')[0]}<br>
      <strong>Due Date:</strong> ${invoice.dueDate.toISOString().split('T')[0]}<br>
      <strong>Billing Cycle:</strong> ${invoice.billingPeriodStart.toISOString().split('T')[0]} to ${invoice.billingPeriodEnd.toISOString().split('T')[0]}<br>
      <strong>Subscription:</strong> ${invoice.subscription.number}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Description</th>
        <th style="text-align: right;">Qty</th>
        <th style="text-align: right;">Unit Price</th>
        <th style="text-align: right;">Tax</th>
        <th style="text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${lineRows}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row">
      <span>Subtotal:</span>
      <span>₹${Number(invoice.subtotal).toFixed(2)}</span>
    </div>
    <div class="totals-row">
      <span>Tax Total:</span>
      <span>₹${Number(invoice.taxTotal).toFixed(2)}</span>
    </div>
    <div class="totals-row grand-total">
      <span>Grand Total:</span>
      <span>₹${Number(invoice.grandTotal).toFixed(2)}</span>
    </div>
  </div>
</body>
</html>`;
  }
}

