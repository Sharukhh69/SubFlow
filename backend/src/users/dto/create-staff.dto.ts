import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

export class CreateStaffDto {
  @ApiProperty({ example: 'staff1@brightloop.com' })
  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'Jane Smith' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: 'Staff@12345', description: 'Temporary password (min 8 chars)' })
  @IsString()
  @MinLength(8)
  @IsNotEmpty()
  temporaryPassword!: string;

  @ApiProperty({ enum: Role, default: Role.STAFF })
  @IsEnum(Role)
  role: Role = Role.STAFF;
}

