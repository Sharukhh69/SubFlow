import { apiClient } from './client';
import { Payment, PaymentMethod } from '../types';

export interface RecordPaymentPayload {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  referenceNumber?: string;
  note?: string;
}

export interface PaymentFilters {
  page?: number;
  limit?: number;
  invoiceId?: string;
  method?: PaymentMethod;
  startDate?: string;
  endDate?: string;
}

export interface PaymentsResponse {
  data: Payment[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const paymentsApi = {
  getAll: async (params?: PaymentFilters): Promise<PaymentsResponse> => {
    const res = await apiClient.get<PaymentsResponse>('/payments', { params });
    return res.data;
  },

  getById: async (id: string): Promise<Payment> => {
    const res = await apiClient.get<Payment>(`/payments/${id}`);
    return res.data;
  },

  recordPayment: async (payload: RecordPaymentPayload): Promise<Payment> => {
    const res = await apiClient.post<Payment>('/payments', payload);
    return res.data;
  },

  getOverdueInvoices: async (params?: { page?: number; limit?: number }): Promise<any> => {
    const res = await apiClient.get('/payments/overdue/invoices', { params });
    return res.data;
  },
};

