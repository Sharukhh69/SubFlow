import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { InvoicesService } from './invoices.service';
import { TaxCalculationService } from './tax-calculation.service';
import { SequencesService } from '../common/services/sequences.service';
import { DiscountEvaluatorService } from '../discounts/discount-evaluator.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  Role,
  InvoiceStatus,
  TaxType,
  PaymentTerms,
  BillingPeriod,
  Prisma,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

describe('InvoicesService & TaxCalculationService', () => {
  let invoicesService: InvoicesService;
  let taxService: TaxCalculationService;
  let sequencesService: SequencesService;

  let prisma: {
    invoice: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    subscription: {
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    sequenceCounter: { upsert: ReturnType<typeof vi.fn> };
    auditLog: { create: ReturnType<typeof vi.fn> };
  };

  const adminUser: AuthenticatedUser = {
    id: 'admin-1',
    email: 'admin@brightloop.com',
    name: 'Admin User',
    role: Role.ADMIN,
    isActive: true,
    forcePasswordChange: false,
  };

  const customerAUser: AuthenticatedUser = {
    id: 'user-a',
    email: 'alice@example.com',
    name: 'Alice',
    role: Role.CUSTOMER,
    isActive: true,
    forcePasswordChange: false,
    customerProfileId: 'cust-profile-a',
  };

  beforeEach(async () => {
    prisma = {
      invoice: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      subscription: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      sequenceCounter: { upsert: vi.fn() },
      auditLog: { create: vi.fn() },
      discount: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
      discountRedemption: { create: vi.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        TaxCalculationService,
        SequencesService,
        DiscountEvaluatorService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    invoicesService = module.get<InvoicesService>(InvoicesService);
    taxService = module.get<TaxCalculationService>(TaxCalculationService);
    sequencesService = module.get<SequencesService>(SequencesService);
  });

  describe('TaxCalculationService', () => {
    it('should compute percentage tax correctly (e.g. 18% GST on Rs. 3520)', () => {
      // 2 units at Rs. 1760 each = Rs. 3520
      const calc = taxService.calculateLine(1760, 2, 0, {
        type: TaxType.PERCENTAGE,
        rate: new Prisma.Decimal(0.1800),
      });

      expect(calc.baseSubtotal).toBe(3520.00);
      expect(calc.taxableAmount).toBe(3520.00);
      expect(calc.taxRate).toBe(0.18);
      expect(calc.taxAmount).toBe(633.60); // 3520 * 0.18 = 633.6
      expect(calc.lineTotal).toBe(4153.60); // 3520 + 633.6
    });

    it('should handle zero tax when no tax is assigned', () => {
      const calc = taxService.calculateLine(500, 3, 0, null);
      expect(calc.baseSubtotal).toBe(1500.00);
      expect(calc.taxAmount).toBe(0);
      expect(calc.lineTotal).toBe(1500.00);
    });

    it('should calculate invoice totals across multiple lines', () => {
      const line1 = taxService.calculateLine(1000, 1, 0, { type: TaxType.PERCENTAGE, rate: 0.18 });
      const line2 = taxService.calculateLine(500, 2, 0, null);

      const totals = taxService.calculateTotals([line1, line2]);
      expect(totals.subtotal).toBe(2000.00);
      expect(totals.taxTotal).toBe(180.00);
      expect(totals.grandTotal).toBe(2180.00);
    });
  });

  describe('calculateDueDate (PaymentTerms)', () => {
    const issueDate = new Date('2026-11-01');

    it('should return same day for IMMEDIATE', () => {
      const due = invoicesService.calculateDueDate(issueDate, PaymentTerms.IMMEDIATE);
      expect(due.toISOString().split('T')[0]).toBe('2026-11-01');
    });

    it('should add 15 days for NET_15', () => {
      const due = invoicesService.calculateDueDate(issueDate, PaymentTerms.NET_15);
      expect(due.toISOString().split('T')[0]).toBe('2026-11-16');
    });

    it('should add 30 days for NET_30', () => {
      const due = invoicesService.calculateDueDate(issueDate, PaymentTerms.NET_30);
      expect(due.toISOString().split('T')[0]).toBe('2026-12-01');
    });

    it('should add 60 days for NET_60', () => {
      const due = invoicesService.calculateDueDate(issueDate, PaymentTerms.NET_60);
      expect(due.toISOString().split('T')[0]).toBe('2026-12-31');
    });
  });

  describe('createFromSubscription & Idempotency', () => {
    const mockSub = {
      id: 'sub-1',
      number: 'SUB-00001',
      customerId: 'cust-profile-a',
      paymentTerms: PaymentTerms.NET_30,
      customer: {
        company: 'Acme Corp',
        addressLine1: '100 Acme Way',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        gstin: '27AAACA1234A1Z5',
        user: { name: 'Alice', email: 'alice@example.com' },
      },
      lines: [
        {
          productId: 'prod-1',
          quantity: 2,
          unitPrice: new Prisma.Decimal(1760),
          product: { name: 'SubFlow Pro' },
          variant: { attributeName: 'Brand', attributeValue: 'Odoo' },
          tax: { type: TaxType.PERCENTAGE, rate: new Prisma.Decimal(0.18) },
        },
      ],
    };

    it('should skip creating invoice if already exists for period (Idempotency)', async () => {
      prisma.invoice.findUnique.mockResolvedValue({ id: 'existing-inv', number: 'INV-00001' });

      const result = await invoicesService.createFromSubscription(
        mockSub,
        new Date('2026-11-01'),
        new Date('2026-12-01'),
      );

      expect(result.skipped).toBe(true);
      expect(prisma.invoice.create).not.toHaveBeenCalled();
    });

    it('should snapshot customer details and create invoice atomically when not yet billed', async () => {
      prisma.invoice.findUnique.mockResolvedValue(null);
      prisma.sequenceCounter.upsert.mockResolvedValue({ lastValue: 1 });
      prisma.invoice.create.mockResolvedValue({
        id: 'new-inv',
        number: 'INV-00001',
        snapshotCustomerName: 'Acme Corp',
        grandTotal: new Prisma.Decimal(4153.60),
      });

      const result = await invoicesService.createFromSubscription(
        mockSub,
        new Date('2026-11-01'),
        new Date('2026-12-01'),
      );

      expect(result.skipped).toBe(false);
      expect(result.invoice.number).toBe('INV-00001');
      expect(prisma.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            snapshotCustomerName: 'Acme Corp',
            snapshotCustomerEmail: 'alice@example.com',
            subtotal: expect.any(Prisma.Decimal),
            taxTotal: expect.any(Prisma.Decimal),
            grandTotal: expect.any(Prisma.Decimal),
          }),
        }),
      );
    });
  });

  describe('Portal Data Isolation (findById & findAll)', () => {
    it('should throw ForbiddenException when Customer A attempts to view Customer B invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-b',
        customerId: 'cust-profile-b',
      });

      await expect(invoicesService.findById('inv-b', customerAUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow Customer A to view their OWN invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-a',
        customerId: 'cust-profile-a',
        number: 'INV-00001',
      });

      const res = await invoicesService.findById('inv-a', customerAUser);
      expect(res.id).toBe('inv-a');
    });

    it('should force customerId in findAll query for Customer role', async () => {
      prisma.invoice.count.mockResolvedValue(1);
      prisma.invoice.findMany.mockResolvedValue([
        { id: 'inv-a', customerId: 'cust-profile-a' },
      ]);

      const res = await invoicesService.findAll({}, customerAUser);
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            customerId: 'cust-profile-a',
          }),
        }),
      );
      expect(res.data.length).toBe(1);
    });
  });

  describe('Invoice Lifecycle Transitions', () => {
    it('should confirm a DRAFT invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        number: 'INV-00001',
        status: InvoiceStatus.DRAFT,
      });
      prisma.invoice.update.mockResolvedValue({
        id: 'inv-1',
        status: InvoiceStatus.CONFIRMED,
      });

      const confirmed = await invoicesService.confirm('inv-1', adminUser);
      expect(confirmed.status).toBe(InvoiceStatus.CONFIRMED);
      expect(prisma.invoice.update).toHaveBeenCalled();
    });

    it('should reject confirming an already CONFIRMED invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: InvoiceStatus.CONFIRMED,
      });

      await expect(invoicesService.confirm('inv-1', adminUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject cancelling a PAID invoice', async () => {
      prisma.invoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: InvoiceStatus.PAID,
      });

      await expect(invoicesService.cancel('inv-1', adminUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});

