import { apiClient } from './client';
import { Invoice, InvoiceStatus } from '../types';

export interface InvoiceFilters {
  page?: number;
  limit?: number;
  status?: InvoiceStatus;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface InvoicesResponse {
  data: Invoice[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const invoicesApi = {
  getAll: async (params?: InvoiceFilters): Promise<InvoicesResponse> => {
    const res = await apiClient.get('/invoices', { params });
    const d = res.data;
    const items = d.data || d.items || (Array.isArray(d) ? d : []);
    return {
      data: items,
      meta: d.meta || { total: items.length, page: 1, limit: items.length, totalPages: 1 },
    };
  },

  getById: async (id: string): Promise<Invoice> => {
    const res = await apiClient.get<Invoice>(`/invoices/${id}`);
    return res.data;
  },

  generateOnDemand: async (subscriptionId: string): Promise<Invoice> => {
    const res = await apiClient.post<Invoice>(`/invoices/generate/${subscriptionId}`);
    return res.data;
  },

  confirm: async (id: string): Promise<Invoice> => {
    const res = await apiClient.post<Invoice>(`/invoices/${id}/confirm`);
    return res.data;
  },

  cancel: async (id: string): Promise<Invoice> => {
    const res = await apiClient.post<Invoice>(`/invoices/${id}/cancel`);
    return res.data;
  },

  getPrintHtml: async (id: string): Promise<string> => {
    const res = await apiClient.get<string>(`/invoices/${id}/print`, {
      headers: { Accept: 'text/html' },
      responseType: 'text',
    });
    return res.data;
  },
};
