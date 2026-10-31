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
import { QuotationTemplatesService } from './quotation-templates.service';
import { CreateQuotationTemplateDto } from './dto/create-quotation-template.dto';
import { UpdateQuotationTemplateDto } from './dto/update-quotation-template.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('quotation-templates')
@Controller('quotation-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class QuotationTemplatesController {
  constructor(private readonly templatesService: QuotationTemplatesService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Create a new quotation template (Admin only)' })
  @ApiResponse({ status: 201, description: 'Quotation template created' })
  async create(@Body() dto: CreateQuotationTemplateDto) {
    return this.templatesService.createTemplate(dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'List reusable quotation templates (Admin & Staff)' })
  async findAll(@Query() query: PaginationDto) {
    return this.templatesService.findAll(query.page, query.limit);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.STAFF)
  @ApiOperation({ summary: 'Get quotation template details' })
  async findOne(@Param('id') id: string) {
    return this.templatesService.findById(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update quotation template (Admin only)' })
  async update(@Param('id') id: string, @Body() dto: UpdateQuotationTemplateDto) {
    return this.templatesService.updateTemplate(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive quotation template (Admin only)' })
  async remove(@Param('id') id: string) {
    return this.templatesService.archiveTemplate(id);
  }
}

