import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { TaxCalculationService } from './tax-calculation.service';
import { SequencesService } from '../common/services/sequences.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    TaxCalculationService,
    SequencesService,
  ],
  exports: [
    InvoicesService,
    TaxCalculationService,
  ],
})
export class InvoicesModule {}
