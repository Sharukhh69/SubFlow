import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaxDto } from './dto/create-tax.dto';
import { UpdateTaxDto } from './dto/update-tax.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class TaxesService {
  constructor(private readonly prisma: PrismaService) {}

  async createTax(dto: CreateTaxDto) {
    return this.prisma.tax.create({
      data: {
        name: dto.name.trim(),
        type: dto.type,
        rate: new Prisma.Decimal(dto.rate),
        isActive: true,
      },
    });
  }

  async findAll(onlyActive: boolean = true) {
    return this.prisma.tax.findMany({
      where: onlyActive ? { isActive: true } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const tax = await this.prisma.tax.findUnique({
      where: { id },
    });
    if (!tax) {
      throw new NotFoundException(`Tax rule with ID "${id}" not found`);
    }
    return tax;
  }

  async updateTax(id: string, dto: UpdateTaxDto) {
    await this.findById(id);

    return this.prisma.tax.update({
      where: { id },
      data: {
        name: dto.name ? dto.name.trim() : undefined,
        type: dto.type,
        rate: dto.rate !== undefined ? new Prisma.Decimal(dto.rate) : undefined,
        isActive: dto.isActive,
      },
    });
  }

  async archiveTax(id: string) {
    await this.findById(id);

    // Check if referenced in products or invoice lines
    const [productCount, invoiceLineCount] = await Promise.all([
      this.prisma.product.count({ where: { defaultTaxId: id } }),
      this.prisma.invoiceLine.count({ where: { taxId: id } }),
    ]);

    if (productCount > 0 || invoiceLineCount > 0) {
      await this.prisma.tax.update({
        where: { id },
        data: { isActive: false },
      });
      return { message: 'Tax rule has historical references and was soft-deactivated (isActive=false)' };
    }

    await this.prisma.tax.delete({ where: { id } });
    return { message: 'Tax rule deleted permanently' };
  }
}

