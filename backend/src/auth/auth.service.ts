import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Role, User } from '@prisma/client';
import { LoginDto } from './dto/login.dto';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly accessExpires: string;
  private readonly refreshExpiresDays: number = 7;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    this.jwtSecret = this.config.get<string>('JWT_SECRET', 'brightloop-subflow-jwt-secret-key-dev-32chars!');
    this.accessExpires = this.config.get<string>('JWT_ACCESS_EXPIRES', '15m');
  }

  // SHA-256 helper for Refresh Token hashing
  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  // Generate random 40-byte hex refresh token
  private generateRawRefreshToken(): string {
    return crypto.randomBytes(40).toString('hex');
  }

  // Mint Access JWT (15 mins)
  generateAccessToken(user: { id: string; email: string; role: Role }): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwtService.sign(payload, {
      secret: this.jwtSecret,
      expiresIn: this.accessExpires as any,
    });
  }

  // Validate email + password against User table
  async validateUser(loginDto: LoginDto): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email.toLowerCase().trim() },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account has been deactivated. Contact an administrator.');
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return user;
  }

  // Issue Access Token & create initial Refresh Token family
  async login(user: User) {
    const accessToken = this.generateAccessToken(user);
    const rawRefreshToken = this.generateRawRefreshToken();
    const tokenHash = this.hashToken(rawRefreshToken);
    const family = crypto.randomUUID();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshExpiresDays);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        family,
        expiresAt,
      },
    });

    // Fetch customer profile if exists
    const customerProfile = await this.prisma.customerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        forcePasswordChange: user.forcePasswordChange,
        customerProfileId: customerProfile?.id,
      },
    };
  }

  // Customer self-registration in an atomic transaction (Assumption #8)
  async registerCustomer(dto: RegisterCustomerDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const newUser = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          name: dto.name.trim(),
          passwordHash,
          role: Role.CUSTOMER,
          isActive: true,
          forcePasswordChange: false,
        },
      });

      await tx.customerProfile.create({
        data: {
          userId: user.id,
          company: dto.company?.trim(),
          phone: dto.phone?.trim(),
          addressLine1: dto.addressLine1?.trim(),
          addressLine2: dto.addressLine2?.trim(),
          city: dto.city?.trim(),
          state: dto.state?.trim(),
          pincode: dto.pincode?.trim(),
          gstin: dto.gstin?.trim()?.toUpperCase(),
        },
      });

      return user;
    });

    return this.login(newUser);
  }

  // Rotate single-use refresh token with Token Theft Detection (Assumption #9)
  async rotateRefreshToken(rawToken: string) {
    if (!rawToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokenHash = this.hashToken(rawToken);
    const tokenRecord = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // THEFT DETECTION: An already revoked token was presented again!
    if (tokenRecord.revokedAt) {
      // Invalidate all tokens belonging to this family immediately
      await this.prisma.refreshToken.updateMany({
        where: { family: tokenRecord.family },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException(
        'Token reuse detected. All active sessions in this family have been revoked.',
      );
    }

    // Check expiration
    if (tokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired. Please log in again.');
    }

    // Ensure user is still active
    const user = await this.prisma.user.findUnique({
      where: { id: tokenRecord.userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account inactive or deleted');
    }

    // Revoke current token
    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revokedAt: new Date() },
    });

    // Issue new token in SAME family
    const newRawRefreshToken = this.generateRawRefreshToken();
    const newTokenHash = this.hashToken(newRawRefreshToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshExpiresDays);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: newTokenHash,
        family: tokenRecord.family,
        expiresAt,
      },
    });

    const newAccessToken = this.generateAccessToken(user);

    return {
      accessToken: newAccessToken,
      refreshToken: newRawRefreshToken,
    };
  }

  // Logout - revoke the token family associated with the active refresh token
  async logout(rawToken?: string) {
    if (rawToken) {
      const tokenHash = this.hashToken(rawToken);
      const tokenRecord = await this.prisma.refreshToken.findUnique({
        where: { tokenHash },
      });

      if (tokenRecord) {
        await this.prisma.refreshToken.updateMany({
          where: { family: tokenRecord.family },
          data: { revokedAt: new Date() },
        });
      }
    }
    return { message: 'Successfully logged out' };
  }

  // Change password & clear forcePasswordChange flag (Assumption #20)
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Current password does not match');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: newHash,
        forcePasswordChange: false,
      },
    });

    return { message: 'Password updated successfully' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        forcePasswordChange: true,
        customerProfile: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }
}

