import { Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsStateService } from './subscriptions-state.service';
import { SequencesService } from '../common/services/sequences.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    SubscriptionsStateService,
    SequencesService,
  ],
  exports: [
    SubscriptionsService,
    SubscriptionsStateService,
    SequencesService,
  ],
})
export class SubscriptionsModule {}
