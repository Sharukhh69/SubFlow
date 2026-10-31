import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PaymentsService } from './payments.service';
import { InvoiceStatus, PaymentMethod, Prisma, Role } from '@prisma/client';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let mockPrisma: any;

  const mockAdminUser = { id: 'admin_1', role: Role.ADMIN };
  const mockCustomerAUser = { id: 'cust_user_A', role: Role.CUSTOMER };

  beforeEach(() => {
    mockPrisma = {
      invoice: {
        findUnique: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
      },
      payment: {
        create: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
      },
      customerProfile: {
        findUnique: vi.fn(),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit_1' }),
      },
    };

    service = new PaymentsService(mockPrisma);
  });

  describe('recordPayment', () => {
    it('should throw NotFoundException if invoice does not exist', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      await expect(
        service.recordPayment(
          {
            invoiceId: 'non_existent_inv',
            amount: 500,
            method: PaymentMethod.UPI,
          },
          mockAdminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if invoice is in DRAFT status', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv_draft',
        status: InvoiceStatus.DRAFT,
        grandTotal: new Prisma.Decimal(1000),
        amountPaid: new Prisma.Decimal(0),
      });

      await expect(
        service.recordPayment(
          {
            invoiceId: 'inv_draft',
            amount: 500,
            method: PaymentMethod.CASH,
          },
          mockAdminUser,
        ),
      ).rejects.toThrow('Cannot record payment for a DRAFT invoice');
    });

    it('should throw BadRequestException if invoice is already PAID', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv_paid',
        status: InvoiceStatus.PAID,
        grandTotal: new Prisma.Decimal(1000),
        amountPaid: new Prisma.Decimal(1000),
      });

      await expect(
        service.recordPayment(
          {
            invoiceId: 'inv_paid',
            amount: 100,
            method: PaymentMethod.CARD,
          },
          mockAdminUser,
        ),
      ).rejects.toThrow('Invoice is already fully PAID');
    });

    it('should prevent overpayment when amount exceeds outstanding balance', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv_conf',
        status: InvoiceStatus.CONFIRMED,
        grandTotal: new Prisma.Decimal(1000),
        amountPaid: new Prisma.Decimal(600), // outstanding: 400
      });

      await expect(
        service.recordPayment(
          {
            invoiceId: 'inv_conf',
            amount: 500, // exceeds 400!
            method: PaymentMethod.BANK_TRANSFER,
          },
          mockAdminUser,
        ),
      ).rejects.toThrow('exceeds outstanding invoice balance');
    });

    it('should record partial payment and keep invoice status as CONFIRMED', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv_conf',
        number: 'INV-00001',
        status: InvoiceStatus.CONFIRMED,
        grandTotal: new Prisma.Decimal(1000),
        amountPaid: new Prisma.Decimal(0),
      });

      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay_1',
        amount: new Prisma.Decimal(400),
        method: PaymentMethod.UPI,
      });

      mockPrisma.invoice.update.mockResolvedValue({
        id: 'inv_conf',
        amountPaid: new Prisma.Decimal(400),
        status: InvoiceStatus.CONFIRMED,
      });

      const res = await service.recordPayment(
        {
          invoiceId: 'inv_conf',
          amount: 400,
          method: PaymentMethod.UPI,
          referenceNumber: 'UPI-12345',
        },
        mockAdminUser,
      );

      expect(res.invoice.isFullyPaid).toBe(false);
      expect(res.invoice.status).toBe(InvoiceStatus.CONFIRMED);
      expect(res.invoice.newAmountPaid).toBe(400);
      expect(res.invoice.remainingBalance).toBe(600);
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv_conf' },
        data: {
          amountPaid: new Prisma.Decimal(400),
          status: InvoiceStatus.CONFIRMED,
        },
      });
    });

    it('should record full payment and auto-transition invoice status to PAID', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue({
        id: 'inv_conf',
        number: 'INV-00001',
        status: InvoiceStatus.CONFIRMED,
        grandTotal: new Prisma.Decimal(1000),
        amountPaid: new Prisma.Decimal(400),
      });

      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay_2',
        amount: new Prisma.Decimal(600),
        method: PaymentMethod.BANK_TRANSFER,
      });

      mockPrisma.invoice.update.mockResolvedValue({
        id: 'inv_conf',
        amountPaid: new Prisma.Decimal(1000),
        status: InvoiceStatus.PAID,
      });

      const res = await service.recordPayment(
        {
          invoiceId: 'inv_conf',
          amount: 600,
          method: PaymentMethod.BANK_TRANSFER,
        },
        mockAdminUser,
      );

      expect(res.invoice.isFullyPaid).toBe(true);
      expect(res.invoice.status).toBe(InvoiceStatus.PAID);
      expect(res.invoice.newAmountPaid).toBe(1000);
      expect(res.invoice.remainingBalance).toBe(0);
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv_conf' },
        data: {
          amountPaid: new Prisma.Decimal(1000),
          status: InvoiceStatus.PAID,
        },
      });
    });
  });

  describe('Portal Data Isolation & Security', () => {
    it('should forbid customer from viewing another customer payment', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay_bob',
        invoice: {
          customer: {
            userId: 'bob_user_id', // NOT cust_user_A
          },
        },
      });

      await expect(service.findById('pay_bob', mockCustomerAUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should isolate customer payments list to their own customer profile', async () => {
      mockPrisma.customerProfile.findUnique.mockResolvedValue({
        id: 'cust_profile_A',
        userId: 'cust_user_A',
      });
      mockPrisma.payment.count.mockResolvedValue(1);
      mockPrisma.payment.findMany.mockResolvedValue([
        {
          id: 'pay_alice_1',
          invoice: { snapshotCustomerName: 'Alice' },
        },
      ]);

      const res = await service.findAll({} as any, mockCustomerAUser);

      expect(res.data.length).toBe(1);
      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            invoice: { customerId: 'cust_profile_A' },
          },
        }),
      );
    });
  });

  describe('Overdue Invoices Query', () => {
    it('should filter only confirmed invoices with past due date and remaining balance', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);

      mockPrisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv_overdue_1',
          number: 'INV-00001',
          snapshotCustomerName: 'Overdue Customer',
          snapshotCustomerEmail: 'overdue@test.com',
          subscription: { number: 'SUB-001' },
          issueDate: pastDate,
          dueDate: pastDate,
          grandTotal: new Prisma.Decimal(1000),
          amountPaid: new Prisma.Decimal(200), // remaining 800 -> OVERDUE
          status: InvoiceStatus.CONFIRMED,
        },
        {
          id: 'inv_overdue_paid',
          number: 'INV-00002',
          snapshotCustomerName: 'Paid Customer',
          snapshotCustomerEmail: 'paid@test.com',
          subscription: { number: 'SUB-002' },
          issueDate: pastDate,
          dueDate: pastDate,
          grandTotal: new Prisma.Decimal(500),
          amountPaid: new Prisma.Decimal(500), // remaining 0 -> NOT overdue!
          status: InvoiceStatus.CONFIRMED,
        },
      ]);

      const res = await service.getOverdueInvoices({ page: 1, limit: 10 }, mockAdminUser);

      expect(res.data.length).toBe(1);
      expect(res.data[0].id).toBe('inv_overdue_1');
      expect(res.data[0].outstandingBalance).toBe(800);
    });
  });
});
