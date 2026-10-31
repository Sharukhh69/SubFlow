import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { RevenueCalculationService } from './revenue-calculation.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReportsController],
  providers: [ReportsService, RevenueCalculationService],
  exports: [ReportsService, RevenueCalculationService],
})
export class ReportsModule {}
