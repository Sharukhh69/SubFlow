import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Subscription, Plan, SubscriptionLine, SubscriptionStatus, Role, BillingPeriod } from '@prisma/client';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

type SubscriptionWithRelations = Subscription & {
  plan: Plan;
  lines: SubscriptionLine[];
};

@Injectable()
export class SubscriptionsStateService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Computes the next billing date based on effective start date and billing period
   */
  calculateNextBillingDate(startDate: Date, billingPeriod: BillingPeriod): Date {
    const next = new Date(startDate);
    switch (billingPeriod) {
      case BillingPeriod.DAILY:
        next.setDate(next.getDate() + 1);
        break;
      case BillingPeriod.WEEKLY:
        next.setDate(next.getDate() + 7);
        break;
      case BillingPeriod.MONTHLY:
        next.setMonth(next.getMonth() + 1);
        break;
      case BillingPeriod.YEARLY:
        next.setFullYear(next.getFullYear() + 1);
        break;
    }
    return next;
  }

  /**
   * Enforces the formal Subscription Lifecycle State Machine
   */
  async transition(
    subscription: SubscriptionWithRelations,
    targetStatus: SubscriptionStatus,
    currentUser: AuthenticatedUser,
    reason?: string,
  ): Promise<Subscription> {
    const currentStatus = subscription.status;

    if (currentStatus === targetStatus) {
      throw new BadRequestException(
        `Subscription is already in '${currentStatus}' status`,
      );
    }

    if (currentStatus === SubscriptionStatus.CLOSED) {
      throw new BadRequestException(
        'Subscription is in terminal CLOSED status and cannot transition to any other status',
      );
    }

    // Role-based restrictions
    if (currentUser.role === Role.CUSTOMER) {
      if (subscription.customerId !== currentUser.customerProfileId) {
        throw new ForbiddenException(
          'Access denied: You do not have permission to transition this subscription',
        );
      }

      // Customers can ONLY confirm or reject active Quotations
      const isAllowedCustomerTransition =
        currentStatus === SubscriptionStatus.QUOTATION &&
        (targetStatus === SubscriptionStatus.CONFIRMED || targetStatus === SubscriptionStatus.CLOSED);

      if (!isAllowedCustomerTransition) {
        throw new ForbiddenException(
          'Customers are only authorized to confirm or reject active quotations',
        );
      }
    }

    const totalQuantity = subscription.lines.reduce((sum, l) => sum + l.quantity, 0);
    const updateData: any = { status: targetStatus };

    // State transition graph validation
    switch (currentStatus) {
      case SubscriptionStatus.DRAFT:
        if (targetStatus === SubscriptionStatus.QUOTATION) {
          if (subscription.lines.length === 0) {
            throw new BadRequestException('Cannot send quote for subscription with zero line items');
          }
          if (totalQuantity < subscription.plan.minQuantity) {
            throw new BadRequestException(
              `Total quantity (${totalQuantity}) is less than plan minimum quantity (${subscription.plan.minQuantity})`,
            );
          }
          // Default quote validity: 30 days from now if not already set
          if (!subscription.quoteExpiryDate) {
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + 30);
            updateData.quoteExpiryDate = expiry;
          }
        } else if (targetStatus === SubscriptionStatus.CONFIRMED) {
          if (subscription.lines.length === 0) {
            throw new BadRequestException('Cannot confirm subscription with zero line items');
          }
          if (totalQuantity < subscription.plan.minQuantity) {
            throw new BadRequestException(
              `Total quantity (${totalQuantity}) is less than plan minimum quantity (${subscription.plan.minQuantity})`,
            );
          }
        } else if (targetStatus !== SubscriptionStatus.CLOSED) {
          throw new BadRequestException(
            `Illegal status transition from '${currentStatus}' to '${targetStatus}'. Allowed: QUOTATION, CONFIRMED, CLOSED`,
          );
        }
        break;

      case SubscriptionStatus.QUOTATION:
        if (targetStatus === SubscriptionStatus.CONFIRMED) {
          // Check quote expiry date
          if (subscription.quoteExpiryDate && new Date(subscription.quoteExpiryDate) < new Date()) {
            throw new BadRequestException(
              'This quotation has expired. A refreshed quote must be generated before confirming.',
            );
          }
          if (totalQuantity < subscription.plan.minQuantity) {
            throw new BadRequestException(
              `Total quantity (${totalQuantity}) is less than plan minimum quantity (${subscription.plan.minQuantity})`,
            );
          }
        } else if (targetStatus !== SubscriptionStatus.CLOSED) {
          throw new BadRequestException(
            `Illegal status transition from '${currentStatus}' to '${targetStatus}'. Allowed: CONFIRMED, CLOSED`,
          );
        }
        break;

      case SubscriptionStatus.CONFIRMED:
        if (targetStatus === SubscriptionStatus.ACTIVE) {
          // When activating, compute initial nextBillingDate
          const effectiveDate = new Date(subscription.startDate);
          updateData.nextBillingDate = this.calculateNextBillingDate(
            effectiveDate,
            subscription.plan.billingPeriod,
          );
        } else if (targetStatus !== SubscriptionStatus.CLOSED) {
          throw new BadRequestException(
            `Illegal status transition from '${currentStatus}' to '${targetStatus}'. Allowed: ACTIVE, CLOSED`,
          );
        }
        break;

      case SubscriptionStatus.ACTIVE:
        if (targetStatus === SubscriptionStatus.PAUSED) {
          if (!subscription.plan.pausable) {
            throw new BadRequestException(
              `Plan '${subscription.plan.name}' does not allow pausing active subscriptions`,
            );
          }
        } else if (targetStatus === SubscriptionStatus.CLOSED) {
          const isExpired =
            subscription.expiryDate && new Date(subscription.expiryDate) <= new Date();

          if (!subscription.plan.closable && !isExpired) {
            throw new BadRequestException(
              `Plan '${subscription.plan.name}' does not allow early closure before contract expiry date`,
            );
          }
          updateData.nextBillingDate = null;
        } else {
          throw new BadRequestException(
            `Illegal status transition from '${currentStatus}' to '${targetStatus}'. Allowed: PAUSED, CLOSED`,
          );
        }
        break;

      case SubscriptionStatus.PAUSED:
        if (targetStatus === SubscriptionStatus.ACTIVE) {
          // Resume subscription
          if (!subscription.nextBillingDate || new Date(subscription.nextBillingDate) < new Date()) {
            updateData.nextBillingDate = this.calculateNextBillingDate(
              new Date(),
              subscription.plan.billingPeriod,
            );
          }
        } else if (targetStatus === SubscriptionStatus.CLOSED) {
          updateData.nextBillingDate = null;
        } else {
          throw new BadRequestException(
            `Illegal status transition from '${currentStatus}' to '${targetStatus}'. Allowed: ACTIVE, CLOSED`,
          );
        }
        break;
    }

    // Persist transition
    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: updateData,
      include: {
        customer: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        plan: true,
        lines: {
          include: {
            product: true,
            variant: true,
            tax: true,
          },
        },
      },
    });

    // Write audit log entry (with resilience for transient Neon PgBouncer connection resets)
    try {
      await this.prisma.auditLog.create({
        data: {
          entityType: 'SUBSCRIPTION',
          entityId: subscription.id,
          action: 'STATUS_TRANSITION',
          fromStatus: currentStatus,
          toStatus: targetStatus,
          userId: currentUser.id,
          metadata: {
            subscriptionNumber: subscription.number,
            planName: subscription.plan.name,
            reason: reason || undefined,
          },
        },
      });
    } catch {
      try {
        await this.prisma.auditLog.create({
          data: {
            entityType: 'SUBSCRIPTION',
            entityId: subscription.id,
            action: 'STATUS_TRANSITION',
            fromStatus: currentStatus,
            toStatus: targetStatus,
            userId: currentUser.id,
            metadata: {
              subscriptionNumber: subscription.number,
              planName: subscription.plan.name,
              reason: reason || undefined,
            },
          },
        });
      } catch {
        // Non-blocking: status update succeeded
      }
    }

    return updated;
  }
}
