import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TaxesService } from './taxes.service';
import { CreateTaxDto } from './dto/create-tax.dto';
import { UpdateTaxDto } from './dto/update-tax.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('taxes')
@Controller('taxes')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TaxesController {
  constructor(private readonly taxesService: TaxesService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new tax/GST rule (Admin only)' })
  @ApiResponse({ status: 201, description: 'Tax rule created' })
  async create(@Body() dto: CreateTaxDto) {
    return this.taxesService.createTax(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all taxes' })
  @ApiQuery({ name: 'onlyActive', required: false, type: Boolean })
  async findAll(@Query('onlyActive') onlyActive?: string) {
    const filter = onlyActive === undefined ? true : onlyActive === 'true';
    return this.taxesService.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tax rule by ID' })
  async findOne(@Param('id') id: string) {
    return this.taxesService.findById(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update tax rule (Admin only)' })
  async update(@Param('id') id: string, @Body() dto: UpdateTaxDto) {
    return this.taxesService.updateTax(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete or archive tax rule (Admin only)' })
  async remove(@Param('id') id: string) {
    return this.taxesService.archiveTax(id);
  }
}

