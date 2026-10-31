import React from 'react';
import { Badge } from './Badge';
import { SubscriptionStatus, InvoiceStatus } from '../../types';
import {
  getSubscriptionStatusVariant,
  getInvoiceStatusVariant,
} from '../../utils/formatters';

interface StatusBadgeProps {
  status: SubscriptionStatus | InvoiceStatus | string;
  type?: 'subscription' | 'invoice' | 'generic';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'generic' }) => {
  let variant: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' = 'default';

  if (type === 'subscription') {
    const v = getSubscriptionStatusVariant(status as string);
    variant = v === 'secondary' ? 'default' : (v as any);
  } else if (type === 'invoice') {
    const v = getInvoiceStatusVariant(status as string);
    variant = v === 'secondary' ? 'default' : (v as any);
  } else {
    switch (String(status).toUpperCase()) {
      case 'ACTIVE':
      case 'PAID':
      case 'SUCCESS':
        variant = 'success';
        break;
      case 'CONFIRMED':
      case 'PENDING':
        variant = 'warning';
        break;
      case 'CLOSED':
      case 'CANCELLED':
      case 'FAILED':
        variant = 'danger';
        break;
      case 'QUOTATION':
      case 'INFO':
        variant = 'info';
        break;
      default:
        variant = 'default';
        break;
    }
  }

  return <Badge variant={variant}>{status}</Badge>;
};
