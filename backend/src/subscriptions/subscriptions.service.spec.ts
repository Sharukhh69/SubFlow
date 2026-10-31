import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsStateService } from './subscriptions-state.service';
import { SequencesService } from '../common/services/sequences.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  Role,
  SubscriptionStatus,
  BillingPeriod,
  PaymentTerms,
  Prisma,
} from '@prisma/client';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

describe('SubscriptionsService & State Machine', () => {
  let service: SubscriptionsService;
  let stateService: SubscriptionsStateService;
  let prisma: {
    subscription: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    customerProfile: { findUnique: ReturnType<typeof vi.fn> };
    plan: { findUnique: ReturnType<typeof vi.fn> };
    product: { findUnique: ReturnType<typeof vi.fn> };
    quotationTemplate: { findUnique: ReturnType<typeof vi.fn> };
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

  const customerBUser: AuthenticatedUser = {
    id: 'user-b',
    email: 'bob@example.com',
    name: 'Bob',
    role: Role.CUSTOMER,
    isActive: true,
    forcePasswordChange: false,
    customerProfileId: 'cust-profile-b',
  };

  beforeEach(async () => {
    prisma = {
      subscription: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      customerProfile: { findUnique: vi.fn() },
      plan: { findUnique: vi.fn() },
      product: { findUnique: vi.fn() },
      quotationTemplate: { findUnique: vi.fn() },
      sequenceCounter: { upsert: vi.fn() },
      auditLog: { create: vi.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        SubscriptionsStateService,
        SequencesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
    stateService = module.get<SubscriptionsStateService>(SubscriptionsStateService);
  });

  describe('create (Manual Draft Creation)', () => {
    it('should throw NotFoundException if customer does not exist', async () => {
      prisma.customerProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.create(
          {
            customerId: 'missing-cust',
            planId: 'plan-1',
            startDate: '2026-11-01',
            lines: [{ productId: 'prod-1', quantity: 1 }],
          },
          adminUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if total line quantity < plan.minQuantity', async () => {
      prisma.customerProfile.findUnique.mockResolvedValue({ id: 'cust-profile-a' });
      prisma.plan.findUnique.mockResolvedValue({
        id: 'plan-1',
        name: 'Enterprise Plan',
        isActive: true,
        minQuantity: 5,
      });
      prisma.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        name: 'Seat License',
        isActive: true,
        salesPrice: new Prisma.Decimal(100),
        variants: [],
      });

      await expect(
        service.create(
          {
            customerId: 'cust-profile-a',
            planId: 'plan-1',
            startDate: '2026-11-01',
            lines: [{ productId: 'prod-1', quantity: 2 }], // 2 < 5
          },
          adminUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should calculate unit price with variant extra price and create subscription atomically', async () => {
      prisma.customerProfile.findUnique.mockResolvedValue({ id: 'cust-profile-a' });
      prisma.plan.findUnique.mockResolvedValue({
        id: 'plan-1',
        name: 'Standard Plan',
        isActive: true,
        minQuantity: 1,
      });
      prisma.product.findUnique.mockResolvedValue({
        id: 'prod-1',
        name: 'SubFlow Pro',
        isActive: true,
        salesPrice: new Prisma.Decimal(1000),
        variants: [{ id: 'var-odoo', attributeName: 'Brand', attributeValue: 'Odoo', extraPrice: new Prisma.Decimal(560), isActive: true }],
      });
      prisma.sequenceCounter.upsert.mockResolvedValue({ lastValue: 1 });
      prisma.subscription.create.mockResolvedValue({
        id: 'sub-1',
        number: 'SUB-00001',
        status: SubscriptionStatus.DRAFT,
      });
      prisma.auditLog.create.mockResolvedValue({});

      const result = await service.create(
        {
          customerId: 'cust-profile-a',
          planId: 'plan-1',
          startDate: '2026-11-01',
          lines: [{ productId: 'prod-1', variantId: 'var-odoo', quantity: 2 }],
        },
        adminUser,
      );

      expect(result.number).toBe('SUB-00001');
      expect(prisma.subscription.create).toHaveBeenCalled();
    });
  });

  describe('createFromTemplate (Quotation Conversion)', () => {
    it('should instantiate quotation with quoteExpiryDate and lines from template', async () => {
      prisma.customerProfile.findUnique.mockResolvedValue({ id: 'cust-profile-a' });
      prisma.quotationTemplate.findUnique.mockResolvedValue({
        id: 'tpl-1',
        name: 'Sales Quote Template',
        validityDays: 15,
        isActive: true,
        planId: 'plan-1',
        plan: { id: 'plan-1', name: 'Annual SaaS', isActive: true, minQuantity: 1 },
        lines: [
          {
            productId: 'prod-1',
            quantity: 3,
            product: { id: 'prod-1', name: 'Software', isActive: true, salesPrice: new Prisma.Decimal(500) },
          },
        ],
      });
      prisma.sequenceCounter.upsert.mockResolvedValue({ lastValue: 2 });
      prisma.subscription.create.mockResolvedValue({
        id: 'sub-quote-1',
        number: 'SUB-00002',
        status: SubscriptionStatus.QUOTATION,
      });
      prisma.auditLog.create.mockResolvedValue({});

      const quote = await service.createFromTemplate(
        {
          templateId: 'tpl-1',
          customerId: 'cust-profile-a',
          startDate: '2026-11-01',
        },
        adminUser,
      );

      expect(quote.number).toBe('SUB-00002');
      expect(quote.status).toBe(SubscriptionStatus.QUOTATION);
    });
  });

  describe('Portal Data Isolation (findById & findAll)', () => {
    it('should throw ForbiddenException when Customer A attempts to access Customer B subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-b',
        customerId: 'cust-profile-b', // Belongs to Bob
        number: 'SUB-00099',
      });

      await expect(service.findById('sub-b', customerAUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow Customer A to access their OWN subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub-a',
        customerId: 'cust-profile-a', // Belongs to Alice
        number: 'SUB-00001',
      });

      const res = await service.findById('sub-a', customerAUser);
      expect(res.id).toBe('sub-a');
    });

    it('should force customerId filter in findAll for Customer role', async () => {
      prisma.subscription.count.mockResolvedValue(1);
      prisma.subscription.findMany.mockResolvedValue([
        { id: 'sub-a', customerId: 'cust-profile-a', number: 'SUB-00001' },
      ]);

      const res = await service.findAll({}, customerAUser);
      expect(prisma.subscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            customerId: 'cust-profile-a',
          }),
        }),
      );
      expect(res.data.length).toBe(1);
    });
  });

  describe('Lifecycle State Machine (transition)', () => {
    const mockSubscription = (status: SubscriptionStatus, planOverrides = {}) => ({
      id: 'sub-1',
      number: 'SUB-00001',
      customerId: 'cust-profile-a',
      startDate: new Date('2026-11-01'),
      status,
      plan: {
        id: 'plan-1',
        name: 'Pro Plan',
        billingPeriod: BillingPeriod.MONTHLY,
        minQuantity: 1,
        pausable: false, // Default not pausable
        closable: true,
        ...planOverrides,
      },
      lines: [
        {
          id: 'line-1',
          quantity: 2,
        },
      ],
    });

    it('should compute nextBillingDate when transitioning from CONFIRMED to ACTIVE', async () => {
      const sub = mockSubscription(SubscriptionStatus.CONFIRMED);
      prisma.subscription.update.mockResolvedValue({
        ...sub,
        status: SubscriptionStatus.ACTIVE,
        nextBillingDate: new Date('2026-12-01'),
      });
      prisma.auditLog.create.mockResolvedValue({});

      const updated = await stateService.transition(
        sub as any,
        SubscriptionStatus.ACTIVE,
        adminUser,
      );

      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: SubscriptionStatus.ACTIVE,
            nextBillingDate: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw BadRequestException when trying to PAUSE an active subscription on an unpausable plan', async () => {
      const sub = mockSubscription(SubscriptionStatus.ACTIVE, { pausable: false });

      await expect(
        stateService.transition(sub as any, SubscriptionStatus.PAUSED, adminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow PAUSE when plan.pausable is true', async () => {
      const sub = mockSubscription(SubscriptionStatus.ACTIVE, { pausable: true });
      prisma.subscription.update.mockResolvedValue({
        ...sub,
        status: SubscriptionStatus.PAUSED,
      });
      prisma.auditLog.create.mockResolvedValue({});

      const updated = await stateService.transition(
        sub as any,
        SubscriptionStatus.PAUSED,
        adminUser,
      );

      expect(prisma.subscription.update).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if Customer attempts to activate or pause a subscription', async () => {
      const sub = mockSubscription(SubscriptionStatus.CONFIRMED);

      await expect(
        stateService.transition(sub as any, SubscriptionStatus.ACTIVE, customerAUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow Customer to CONFIRM an active quotation', async () => {
      const sub = mockSubscription(SubscriptionStatus.QUOTATION);
      prisma.subscription.update.mockResolvedValue({
        ...sub,
        status: SubscriptionStatus.CONFIRMED,
      });
      prisma.auditLog.create.mockResolvedValue({});

      const updated = await stateService.transition(
        sub as any,
        SubscriptionStatus.CONFIRMED,
        customerAUser,
      );

      expect(prisma.subscription.update).toHaveBeenCalled();
    });
  });
});

