import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { CustomersService } from './customers.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

describe('CustomersService', () => {
  let service: CustomersService;
  let prisma: {
    customerProfile: {
      findUnique: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    user: {
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      customerProfile: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  describe('Portal Data Isolation (findById)', () => {
    const adminUser: AuthenticatedUser = {
      id: 'admin-1',
      email: 'admin@brightloop.com',
      name: 'Admin User',
      role: Role.ADMIN,
      isActive: true,
      forcePasswordChange: false,
    };

    const customerAUser: AuthenticatedUser = {
      id: 'user-cust-a',
      email: 'custA@example.com',
      name: 'Customer A',
      role: Role.CUSTOMER,
      isActive: true,
      forcePasswordChange: false,
      customerProfileId: 'profile-a',
    };

    const customerBUser: AuthenticatedUser = {
      id: 'user-cust-b',
      email: 'custB@example.com',
      name: 'Customer B',
      role: Role.CUSTOMER,
      isActive: true,
      forcePasswordChange: false,
      customerProfileId: 'profile-b',
    };

    it('should allow Admin to access any customer profile by id', async () => {
      prisma.customerProfile.findUnique.mockResolvedValue({
        id: 'profile-a',
        userId: 'user-cust-a',
        company: 'Company A Ltd',
        user: { name: 'Customer A' },
      });

      const result = await service.findById('profile-a', adminUser);
      expect(result).toBeDefined();
      expect(result.id).toBe('profile-a');
    });

    it('should allow Customer A to access their OWN profile', async () => {
      prisma.customerProfile.findUnique.mockResolvedValue({
        id: 'profile-a',
        userId: 'user-cust-a',
        company: 'Company A Ltd',
        user: { name: 'Customer A' },
      });

      const result = await service.findById('profile-a', customerAUser);
      expect(result).toBeDefined();
      expect(result.id).toBe('profile-a');
    });

    it('should THROW ForbiddenException (403) when Customer A attempts to access Customer B profile', async () => {
      await expect(
        service.findById('profile-b', customerAUser),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.customerProfile.findUnique).not.toHaveBeenCalled();
    });

    it('should THROW ForbiddenException (403) when customerProfileId is missing on CUSTOMER user', async () => {
      const customerNoProfile: AuthenticatedUser = {
        id: 'user-ghost',
        email: 'ghost@example.com',
        name: 'Ghost User',
        role: Role.CUSTOMER,
        isActive: true,
        forcePasswordChange: false,
        customerProfileId: undefined,
      };

      await expect(
        service.findById('profile-a', customerNoProfile),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if profile does not exist for Admin lookup', async () => {
      prisma.customerProfile.findUnique.mockResolvedValue(null);

      await expect(
        service.findById('non-existent-id', adminUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getProfileByUserId', () => {
    it('should return profile for valid user', async () => {
      prisma.customerProfile.findUnique.mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
        company: 'Wayne Enterprises',
        user: { id: 'user-1', name: 'Bruce Wayne' },
        _count: { subscriptions: 2, invoices: 5 },
      });

      const profile = await service.getProfileByUserId('user-1');
      expect(profile.company).toBe('Wayne Enterprises');
      expect(profile._count.subscriptions).toBe(2);
    });

    it('should throw NotFoundException if profile does not exist', async () => {
      prisma.customerProfile.findUnique.mockResolvedValue(null);

      await expect(service.getProfileByUserId('unknown-user')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateProfileByUserId', () => {
    it('should update profile fields and user name', async () => {
      prisma.customerProfile.findUnique.mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
      });
      prisma.user.update.mockResolvedValue({ id: 'user-1', name: 'Bruce Wayne Updated' });
      prisma.customerProfile.update.mockResolvedValue({
        id: 'profile-1',
        company: 'Wayne Tech',
        city: 'Gotham',
      });

      const updated = await service.updateProfileByUserId('user-1', {
        name: 'Bruce Wayne Updated',
        company: 'Wayne Tech',
        city: 'Gotham',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { name: 'Bruce Wayne Updated' },
      });
      expect(prisma.customerProfile.update).toHaveBeenCalled();
      expect(updated.company).toBe('Wayne Tech');
    });
  });

  describe('createCustomerByAdmin', () => {
    it('should throw ConflictException if email is already in use', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing-id', email: 'taken@example.com' });

      await expect(
        service.createCustomerByAdmin({
          email: 'taken@example.com',
          name: 'Taken Name',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should create user and customerProfile atomically with temporary password', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'new-user-id',
        email: 'fresh@example.com',
        name: 'Fresh Customer',
        role: Role.CUSTOMER,
        isActive: true,
        forcePasswordChange: true,
        customerProfile: {
          id: 'new-profile-id',
          userId: 'new-user-id',
          company: 'Fresh Corp',
        },
      });

      const result = await service.createCustomerByAdmin({
        email: 'fresh@example.com',
        name: 'Fresh Customer',
        company: 'Fresh Corp',
      });

      expect(result.message).toBe('Customer account provisioned successfully');
      expect(result.customerProfile.id).toBe('new-profile-id');
      expect(result.temporaryPassword).toBeDefined();
      expect(prisma.user.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated results with metadata', async () => {
      prisma.customerProfile.count.mockResolvedValue(1);
      prisma.customerProfile.findMany.mockResolvedValue([
        { id: 'p-1', company: 'Acme', user: { name: 'Alice' }, _count: { subscriptions: 1, invoices: 2 } },
      ]);

      const res = await service.findAll({ page: 1, limit: 10 });
      expect(res.meta.total).toBe(1);
      expect(res.meta.totalPages).toBe(1);
      expect(res.data.length).toBe(1);
    });
  });
});

