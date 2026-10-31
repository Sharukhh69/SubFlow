export const formatINR = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || isNaN(Number(val))) {
    return '₹ 0.00';
  }
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(num);
};

export const formatDate = (dateStr: string | Date | undefined | null): string => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return String(dateStr);
  }
};

export const formatDateTime = (dateStr: string | Date | undefined | null): string => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(dateStr);
  }
};

export const getSubscriptionStatusVariant = (status: string) => {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'CONFIRMED':
      return 'info';
    case 'QUOTATION':
      return 'warning';
    case 'DRAFT':
      return 'secondary';
    case 'PAUSED':
      return 'warning';
    case 'CLOSED':
      return 'danger';
    default:
      return 'secondary';
  }
};

export const getInvoiceStatusVariant = (status: string) => {
  switch (status) {
    case 'PAID':
      return 'success';
    case 'CONFIRMED':
      return 'warning';
    case 'DRAFT':
      return 'secondary';
    case 'CANCELLED':
      return 'danger';
    default:
      return 'secondary';
  }
};
