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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateVariantDto, UpdateVariantDto } from './dto/create-variant.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('products')
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new product with optional variants (Admin only)' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  async create(@Body() dto: CreateProductDto) {
    return this.productsService.createProduct(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List products with filters & pagination' })
  @ApiResponse({ status: 200, description: 'Paginated products list' })
  async findAll(@Query() query: ProductQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get product details including variants and default tax' })
  @ApiResponse({ status: 200, description: 'Product details' })
  @ApiResponse({ status: 404, description: 'Product not found' })
  async findOne(@Param('id') id: string) {
    return this.productsService.findById(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update product properties (Admin only)' })
  async update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.updateProduct(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive/Delete product (safe soft-delete if referenced in subs/invoices)' })
  async remove(@Param('id') id: string) {
    return this.productsService.archiveProduct(id);
  }

  @Post(':id/variants')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Add a new variant to an existing product (Admin only)' })
  async addVariant(@Param('id') id: string, @Body() dto: CreateVariantDto) {
    return this.productsService.addVariant(id, dto);
  }

  @Patch('variants/:variantId')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update a variant surcharge or status (Admin only)' })
  async updateVariant(@Param('variantId') variantId: string, @Body() dto: UpdateVariantDto) {
    return this.productsService.updateVariant(variantId, dto);
  }
}

