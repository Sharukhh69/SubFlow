import { apiClient } from './client';
import { Subscription, SubscriptionStatus } from '../types';

export const subscriptionsApi = {
  getAll: async (params?: {
    page?: number;
    limit?: number;
    status?: SubscriptionStatus;
    customerId?: string;
    search?: string;
  }): Promise<{ data: Subscription[]; meta: { total: number; page: number; limit: number; totalPages: number } }> => {
    const res = await apiClient.get('/subscriptions', { params });
    const d = res.data;
    if (d.meta) return d;
    return {
      data: d.data || [],
      meta: {
        total: d.total ?? (d.data?.length || 0),
        page: d.page ?? 1,
        limit: d.limit ?? 10,
        totalPages: d.totalPages ?? 1,
      },
    };
  },

  getById: async (id: string): Promise<Subscription> => {
    const res = await apiClient.get<Subscription>(`/subscriptions/${id}`);
    return res.data;
  },

  create: async (payload: {
    customerId: string;
    planId: string;
    startDate: string;
    paymentTerms?: string;
    lines: Array<{
      productId: string;
      variantId?: string;
      taxId?: string;
      quantity: number;
      unitPrice?: number;
    }>;
  }): Promise<Subscription> => {
    const res = await apiClient.post<Subscription>('/subscriptions', payload);
    return res.data;
  },

  createFromTemplate: async (payload: {
    templateId: string;
    customerId: string;
    startDate?: string;
    paymentTerms?: string;
  }): Promise<Subscription> => {
    const res = await apiClient.post<Subscription>('/subscriptions/from-template', payload);
    return res.data;
  },

  transition: async (id: string, targetStatus: SubscriptionStatus, reason?: string): Promise<Subscription> => {
    const res = await apiClient.post<Subscription>(`/subscriptions/${id}/transition`, {
      status: targetStatus,
      reason,
    });
    return res.data;
  },
};
