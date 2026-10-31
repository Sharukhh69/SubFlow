import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateCustomerAdminDto } from './dto/create-customer-admin.dto';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { Role, Prisma } from '@prisma/client';
import { PaginatedResult, SortOrder } from '../common/dto/pagination.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Customer Portal: Fetch own customer profile by authenticated user's ID
   */
  async getProfileByUserId(userId: string) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            subscriptions: true,
            invoices: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Customer profile not found for this user');
    }

    return profile;
  }

  /**
   * Customer Portal: Update own customer profile by authenticated user's ID
   */
  async updateProfileByUserId(userId: string, dto: UpdateCustomerDto) {
    const existing = await this.prisma.customerProfile.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new NotFoundException('Customer profile not found for this user');
    }

    if (dto.name) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { name: dto.name.trim() },
      });
    }

    return this.prisma.customerProfile.update({
      where: { id: existing.id },
      data: {
        company: dto.company !== undefined ? dto.company?.trim() : undefined,
        phone: dto.phone !== undefined ? dto.phone?.trim() : undefined,
        addressLine1: dto.addressLine1 !== undefined ? dto.addressLine1?.trim() : undefined,
        addressLine2: dto.addressLine2 !== undefined ? dto.addressLine2?.trim() : undefined,
        city: dto.city !== undefined ? dto.city?.trim() : undefined,
        state: dto.state !== undefined ? dto.state?.trim() : undefined,
        pincode: dto.pincode !== undefined ? dto.pincode?.trim() : undefined,
        gstin: dto.gstin !== undefined ? dto.gstin?.trim()?.toUpperCase() : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
      },
    });
  }

  /**
   * Admin / Staff: List customers with pagination, search, and aggregates
   */
  async findAll(query: CustomerQueryDto): Promise<PaginatedResult<any>> {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.CustomerProfileWhereInput = {};

    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { company: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s, mode: 'insensitive' } },
        { city: { contains: s, mode: 'insensitive' } },
        { gstin: { contains: s, mode: 'insensitive' } },
        { user: { name: { contains: s, mode: 'insensitive' } } },
        { user: { email: { contains: s, mode: 'insensitive' } } },
      ];
    }

    if (query.company) {
      where.company = { contains: query.company.trim(), mode: 'insensitive' };
    }

    if (query.city) {
      where.city = { contains: query.city.trim(), mode: 'insensitive' };
    }

    if (query.state) {
      where.state = { contains: query.state.trim(), mode: 'insensitive' };
    }

    const sortField = query.sort || 'createdAt';
    const sortOrder: Prisma.SortOrder = query.order === SortOrder.ASC ? 'asc' : 'desc';

    const orderBy: Prisma.CustomerProfileOrderByWithRelationInput = {};
    if (sortField === 'name') {
      orderBy.user = { name: sortOrder };
    } else if (sortField === 'company') {
      orderBy.company = sortOrder;
    } else {
      orderBy.createdAt = sortOrder;
    }

    const [total, data] = await Promise.all([
      this.prisma.customerProfile.count({ where }),
      this.prisma.customerProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              isActive: true,
              createdAt: true,
            },
          },
          _count: {
            select: {
              subscriptions: true,
              invoices: true,
            },
          },
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
   * Detail view with Multi-Tenant Customer Portal Data Isolation Check
   * If requester is Role.CUSTOMER, they are ONLY permitted to view their own profile.
   */
  async findById(id: string, currentUser: AuthenticatedUser) {
    if (currentUser.role === Role.CUSTOMER) {
      if (!currentUser.customerProfileId || currentUser.customerProfileId !== id) {
        throw new ForbiddenException(
          'Access denied: You do not have permission to view other customer accounts',
        );
      }
    }

    const profile = await this.prisma.customerProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            subscriptions: true,
            invoices: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException(`Customer profile with ID '${id}' not found`);
    }

    return profile;
  }

  /**
   * Admin: Provision a new customer account directly
   */
  async createCustomerByAdmin(dto: CreateCustomerAdminDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('A user with this email address already exists');
    }

    const rawPassword = dto.password || crypto.randomBytes(8).toString('hex') + 'Aa1!';
    const passwordHash = await bcrypt.hash(rawPassword, 12);
    const forcePasswordChange = !dto.password; // If password was auto-generated, require change on first login

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        name: dto.name.trim(),
        passwordHash,
        role: Role.CUSTOMER,
        isActive: true,
        forcePasswordChange,
        customerProfile: {
          create: {
            company: dto.company?.trim(),
            phone: dto.phone?.trim(),
            addressLine1: dto.addressLine1?.trim(),
            addressLine2: dto.addressLine2?.trim(),
            city: dto.city?.trim(),
            state: dto.state?.trim(),
            pincode: dto.pincode?.trim(),
            gstin: dto.gstin?.trim()?.toUpperCase(),
          },
        },
      },
      include: {
        customerProfile: true,
      },
    });

    return {
      message: 'Customer account provisioned successfully',
      customerProfile: user.customerProfile,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        forcePasswordChange: user.forcePasswordChange,
      },
      temporaryPassword: forcePasswordChange ? rawPassword : undefined,
    };
  }

  /**
   * Admin / Staff: Update customer profile by profile ID
   */
  async updateCustomerById(id: string, dto: UpdateCustomerDto) {
    const existing = await this.prisma.customerProfile.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!existing) {
      throw new NotFoundException(`Customer profile with ID '${id}' not found`);
    }

    if (dto.name) {
      await this.prisma.user.update({
        where: { id: existing.userId },
        data: { name: dto.name.trim() },
      });
    }

    return this.prisma.customerProfile.update({
      where: { id },
      data: {
        company: dto.company !== undefined ? dto.company?.trim() : undefined,
        phone: dto.phone !== undefined ? dto.phone?.trim() : undefined,
        addressLine1: dto.addressLine1 !== undefined ? dto.addressLine1?.trim() : undefined,
        addressLine2: dto.addressLine2 !== undefined ? dto.addressLine2?.trim() : undefined,
        city: dto.city !== undefined ? dto.city?.trim() : undefined,
        state: dto.state !== undefined ? dto.state?.trim() : undefined,
        pincode: dto.pincode !== undefined ? dto.pincode?.trim() : undefined,
        gstin: dto.gstin !== undefined ? dto.gstin?.trim()?.toUpperCase() : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            subscriptions: true,
            invoices: true,
          },
        },
      },
    });
  }
}

