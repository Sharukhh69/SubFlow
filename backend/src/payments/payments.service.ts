import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { PaymentQueryDto } from './dto/payment-query.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { InvoiceStatus, Prisma, Role } from '@prisma/client';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to round currency amounts to 2 decimal places
   */
  private round(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  /**
   * Record a payment against an invoice (Admin / Staff)
   */
  async recordPayment(dto: RecordPaymentDto, user: any) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: dto.invoiceId },
      include: {
        customer: {
          include: { user: true },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${dto.invoiceId} not found`);
    }

    // 1. Enforce Lifecycle State: Only CONFIRMED invoices can receive payments
    if (invoice.status === InvoiceStatus.DRAFT) {
      throw new BadRequestException(
        'Cannot record payment for a DRAFT invoice. The invoice must be CONFIRMED first.',
      );
    }
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Cannot record payment for a CANCELLED invoice.');
    }
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Invoice is already fully PAID.');
    }

    // 2. Validate Overpayment Guard (Assumption 4 & 8)
    const grandTotal = Number(invoice.grandTotal);
    const amountPaid = Number(invoice.amountPaid);
    const outstanding = this.round(grandTotal - amountPaid);

    if (dto.amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero.');
    }

    if (dto.amount > outstanding) {
      throw new BadRequestException(
        `Payment amount (Rs. ${dto.amount}) exceeds outstanding invoice balance (Rs. ${outstanding}). Overpayment is not permitted.`,
      );
    }

    // 3. Create Payment Record
    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();

    const payment = await this.prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        method: dto.method,
        amount: new Prisma.Decimal(dto.amount),
        paymentDate,
        referenceNumber: dto.referenceNumber || null,
        note: dto.note || null,
        recordedById: user.id,
      },
      include: {
        invoice: {
          select: {
            id: true,
            number: true,
            grandTotal: true,
            amountPaid: true,
            status: true,
          },
        },
        recordedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // 4. Update Invoice Balance and Auto-Transition to PAID if fully settled
    const newAmountPaid = this.round(amountPaid + dto.amount);
    const isFullyPaid = newAmountPaid >= grandTotal;
    const newStatus = isFullyPaid ? InvoiceStatus.PAID : invoice.status;

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        amountPaid: new Prisma.Decimal(newAmountPaid),
        status: newStatus,
      },
    });

    // 5. Audit Logging (resilient against transient network drops)
    try {
      await this.prisma.auditLog.create({
        data: {
          entityType: 'INVOICE',
          entityId: invoice.id,
          action: isFullyPaid ? 'PAYMENT_SETTLED' : 'PARTIAL_PAYMENT',
          fromStatus: invoice.status,
          toStatus: newStatus,
          userId: user.id,
          metadata: {
            paymentId: payment.id,
            amount: dto.amount,
            method: dto.method,
            newAmountPaid,
            remainingBalance: Math.max(0, this.round(grandTotal - newAmountPaid)),
            referenceNumber: dto.referenceNumber,
          },
        },
      });
    } catch {
      // Non-critical audit log resilience
    }

    return {
      payment,
      invoice: {
        id: invoice.id,
        number: invoice.number,
        grandTotal,
        previousAmountPaid: amountPaid,
        newAmountPaid,
        remainingBalance: Math.max(0, this.round(grandTotal - newAmountPaid)),
        status: newStatus,
        isFullyPaid,
      },
    };
  }

  /**
   * List payments with portal tenant isolation
   */
  async findAll(query: PaymentQueryDto, user: any) {
    const { page = 1, limit = 20, invoiceId, customerId, method, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentWhereInput = {};

    // Customer Portal Isolation: Customers can ONLY see payments for their invoices
    if (user.role === Role.CUSTOMER) {
      const profile = await this.prisma.customerProfile.findUnique({
        where: { userId: user.id },
      });
      if (!profile) {
        return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
      }
      where.invoice = { customerId: profile.id };
    } else {
      if (customerId) {
        where.invoice = { customerId };
      }
    }

    if (invoiceId) {
      where.invoiceId = invoiceId;
    }
    if (method) {
      where.method = method;
    }
    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) where.paymentDate.gte = new Date(startDate);
      if (endDate) where.paymentDate.lte = new Date(endDate);
    }

    const [total, data] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { paymentDate: 'desc' },
        include: {
          invoice: {
            select: {
              id: true,
              number: true,
              grandTotal: true,
              amountPaid: true,
              status: true,
              snapshotCustomerName: true,
            },
          },
          recordedBy: {
            select: { id: true, name: true, email: true },
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
   * Retrieve a single payment receipt by ID
   */
  async findById(id: string, user: any) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        invoice: {
          include: {
            customer: {
              include: { user: true },
            },
          },
        },
        recordedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    // Portal isolation check
    if (user.role === Role.CUSTOMER && payment.invoice.customer.userId !== user.id) {
      throw new ForbiddenException('You do not have permission to view this payment receipt.');
    }

    return payment;
  }

  /**
   * List overdue confirmed invoices requiring collection (Assumption 11: derived overdue)
   */
  async getOverdueInvoices(query: PaginationDto, user: any) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where: Prisma.InvoiceWhereInput = {
      status: InvoiceStatus.CONFIRMED,
      dueDate: { lt: today },
    };

    if (user.role === Role.CUSTOMER) {
      const profile = await this.prisma.customerProfile.findUnique({
        where: { userId: user.id },
      });
      if (!profile) {
        return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
      }
      where.customerId = profile.id;
    }

    // Retrieve candidates and filter where grandTotal > amountPaid
    const invoices = await this.prisma.invoice.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      include: {
        customer: {
          include: { user: { select: { name: true, email: true } } },
        },
        subscription: {
          select: { id: true, number: true },
        },
      },
    });

    const overdueList = invoices.filter(
      (inv) => Number(inv.grandTotal) > Number(inv.amountPaid),
    );

    const total = overdueList.length;
    const paginated = overdueList.slice(skip, skip + limit);

    return {
      data: paginated.map((inv) => ({
        id: inv.id,
        number: inv.number,
        customerId: inv.customerId,
        customerName: inv.snapshotCustomerName,
        customerEmail: inv.snapshotCustomerEmail,
        subscriptionNumber: inv.subscription.number,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        grandTotal: inv.grandTotal,
        amountPaid: inv.amountPaid,
        outstandingBalance: this.round(Number(inv.grandTotal) - Number(inv.amountPaid)),
        status: inv.status,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

