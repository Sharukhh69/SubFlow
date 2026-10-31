import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class UpdateStaffStatusDto {
  @ApiProperty({ example: false, description: 'Active status for soft-delete/deactivation' })
  @IsBoolean()
  @IsNotEmpty()
  isActive!: boolean;
}

