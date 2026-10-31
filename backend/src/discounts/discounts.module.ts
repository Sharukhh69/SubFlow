import { Module } from '@nestjs/common';
import { DiscountsService } from './discounts.service';
import { DiscountsController } from './discounts.controller';
import { DiscountEvaluatorService } from './discount-evaluator.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DiscountsController],
  providers: [DiscountsService, DiscountEvaluatorService],
  exports: [DiscountsService, DiscountEvaluatorService],
})
export class DiscountsModule {}
