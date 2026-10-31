import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SequencesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates a collision-free, monotonic sequence number.
   * Leverages Prisma's atomic SQL increment under the hood.
   * Example: getNextSequence('subscription', 'SUB') -> "SUB-00001"
   */
  async getNextSequence(
    name: string,
    prefix: string = 'SUB',
    padding: number = 5,
  ): Promise<string> {
    const counter = await this.prisma.sequenceCounter.upsert({
      where: { name },
      update: {
        lastValue: {
          increment: 1,
        },
      },
      create: {
        name,
        lastValue: 1,
      },
    });

    const paddedNumber = String(counter.lastValue).padStart(padding, '0');
    return `${prefix}-${paddedNumber}`;
  }

  /**
   * Convenience helper for Subscription sequential numbering
   */
  async getNextSubscriptionNumber(): Promise<string> {
    return this.getNextSequence('subscription', 'SUB', 5);
  }
}
