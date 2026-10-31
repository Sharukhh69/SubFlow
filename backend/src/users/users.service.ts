import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStaffDto } from './dto/create-staff.dto';
import { UpdateStaffStatusDto } from './dto/update-staff.dto';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createStaff(dto: CreateStaffDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    if (dto.role === Role.CUSTOMER) {
      throw new BadRequestException('Cannot create customer through staff management endpoint');
    }

    const passwordHash = await bcrypt.hash(dto.temporaryPassword, 12);

    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        name: dto.name.trim(),
        passwordHash,
        role: dto.role,
        isActive: true,
        forcePasswordChange: true, // Requires password change on first login (Assumption #20)
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        forcePasswordChange: true,
        createdAt: true,
      },
    });

    return user;
  }

  async findAllStaff(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const where = {
      role: {
        in: [Role.ADMIN, Role.STAFF],
      },
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          forcePasswordChange: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Soft-delete / deactivate staff (Assumption #14)
  async setStaffStatus(id: string, dto: UpdateStaffStatusDto, currentUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('Staff member not found');
    }

    if (user.id === currentUserId && !dto.isActive) {
      throw new BadRequestException('Cannot deactivate your own administrative account');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive: dto.isActive },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });

    // If deactivated, revoke all their refresh token sessions immediately
    if (!dto.isActive) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: id },
        data: { revokedAt: new Date() },
      });
    }

    return updated;
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        forcePasswordChange: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}

