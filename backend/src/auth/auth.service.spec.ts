import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { vi, describe, it, expect, beforeEach, beforeAll } from 'vitest';

describe('AuthService (Unit)', () => {
  let authService: AuthService;

  const mockUser = {
    id: 'user-123',
    email: 'admin@brightloop.com',
    name: 'Super Admin',
    passwordHash: '',
    role: Role.ADMIN,
    isActive: true,
    forcePasswordChange: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    mockUser.passwordHash = await bcrypt.hash('Admin@12345', 10);
  });

  const mockPrismaService = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    customerProfile: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const mockJwtService = {
    sign: vi.fn().mockReturnValue('mock-jwt-token-123'),
  };

  const mockConfigService = {
    get: vi.fn((key: string, defaultValue?: any) => {
      if (key === 'JWT_SECRET') return 'test-secret-key-min-32-chars-long!';
      if (key === 'JWT_ACCESS_EXPIRES') return '15m';
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  describe('validateUser', () => {
    it('should validate user with correct password', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.validateUser({
        email: 'admin@brightloop.com',
        password: 'Admin@12345',
      });

      expect(result).toBeDefined();
      expect(result.email).toBe(mockUser.email);
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        authService.validateUser({
          email: 'admin@brightloop.com',
          password: 'WrongPassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.validateUser({
          email: 'nonexistent@brightloop.com',
          password: 'Admin@12345',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user is deactivated', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(
        authService.validateUser({
          email: 'admin@brightloop.com',
          password: 'Admin@12345',
        }),
      ).rejects.toThrow('Your account has been deactivated. Contact an administrator.');
    });
  });

  describe('login', () => {
    it('should mint an access token and create a refresh token record', async () => {
      mockPrismaService.refreshToken.create.mockResolvedValue({ id: 'ref-1' });
      mockPrismaService.customerProfile.findUnique.mockResolvedValue(null);

      const result = await authService.login(mockUser as any);

      expect(result.accessToken).toBe('mock-jwt-token-123');
      expect(result.refreshToken).toBeDefined();
      expect(typeof result.refreshToken).toBe('string');
      expect(mockPrismaService.refreshToken.create).toHaveBeenCalled();
    });
  });

  describe('rotateRefreshToken (Theft Detection)', () => {
    it('should detect token reuse and revoke the entire family', async () => {
      const revokedTokenRecord = {
        id: 'token-old',
        userId: 'user-123',
        tokenHash: 'somehash',
        family: 'family-abc-123',
        expiresAt: new Date(Date.now() + 100000),
        revokedAt: new Date(Date.now() - 5000), // already revoked!
      };

      mockPrismaService.refreshToken.findUnique.mockResolvedValue(revokedTokenRecord);

      await expect(authService.rotateRefreshToken('replayed-raw-token')).rejects.toThrow(
        'Token reuse detected. All active sessions in this family have been revoked.',
      );

      expect(mockPrismaService.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { family: 'family-abc-123' },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
