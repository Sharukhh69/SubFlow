import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { QuotationTemplatesService } from './quotation-templates.service';
import { QuotationTemplatesController } from './quotation-templates.controller';

@Module({
  imports: [PrismaModule],
  controllers: [QuotationTemplatesController],
  providers: [QuotationTemplatesService],
  exports: [QuotationTemplatesService],
})
export class QuotationTemplatesModule {}
