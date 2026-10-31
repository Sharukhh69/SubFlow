import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UserProfileDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: Role })
  role!: Role;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  forcePasswordChange!: boolean;

  @ApiProperty({ required: false })
  customerProfileId?: string;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'JWT Access Token (15m validity)' })
  accessToken!: string;

  @ApiProperty({ type: UserProfileDto })
  user!: UserProfileDto;
}

export class TokenRefreshResponseDto {
  @ApiProperty({ description: 'Rotated JWT Access Token (15m validity)' })
  accessToken!: string;
}

export class MessageResponseDto {
  @ApiProperty()
  message!: string;
}

