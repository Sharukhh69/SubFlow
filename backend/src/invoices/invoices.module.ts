import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { TaxCalculationService } from './tax-calculation.service';
import { SequencesService } from '../common/services/sequences.service';
import { DiscountEvaluatorService } from '../discounts/discount-evaluator.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InvoicesController],
  providers: [
    InvoicesService,
    TaxCalculationService,
    SequencesService,
    DiscountEvaluatorService,
  ],
  exports: [
    InvoicesService,
    TaxCalculationService,
    DiscountEvaluatorService,
  ],
})
export class InvoicesModule {}

