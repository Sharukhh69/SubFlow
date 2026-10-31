import { apiClient } from './client';
import {
  Product,
  Plan,
  Tax,
  Discount,
  QuotationTemplate,
  CustomerProfile,
} from '../types';

export const catalogApi = {
  // Products
  getProducts: async (params?: { page?: number; limit?: number; search?: string; type?: string }): Promise<{ data: Product[]; meta: any }> => {
    const res = await apiClient.get('/products', { params });
    const d = res.data;
    const items = d.items || d.data || (Array.isArray(d) ? d : []);
    return {
      data: items,
      meta: d.meta || { total: items.length, page: 1, limit: items.length, totalPages: 1 },
    };
  },

  getProduct: async (id: string): Promise<Product> => {
    const res = await apiClient.get(`/products/${id}`);
    return res.data;
  },

  createProduct: async (data: Partial<Product>): Promise<Product> => {
    const res = await apiClient.post('/products', data);
    return res.data;
  },

  // Plans
  getPlans: async (params?: { onlyActive?: boolean }): Promise<Plan[]> => {
    const res = await apiClient.get('/plans', { params });
    const d = res.data;
    if (Array.isArray(d)) return d;
    return d.items || d.data || [];
  },

  getPlan: async (id: string): Promise<Plan> => {
    const res = await apiClient.get(`/plans/${id}`);
    return res.data;
  },

  createPlan: async (data: Partial<Plan>): Promise<Plan> => {
    const res = await apiClient.post('/plans', data);
    return res.data;
  },

  // Taxes
  getTaxes: async (onlyActive: boolean = true): Promise<Tax[]> => {
    const res = await apiClient.get('/taxes', { params: { onlyActive } });
    const d = res.data;
    if (Array.isArray(d)) return d;
    return d.items || d.data || [];
  },

  // Discounts
  getDiscounts: async (params?: { page?: number; limit?: number; isActive?: boolean }): Promise<{ data: Discount[]; meta: any }> => {
    const res = await apiClient.get('/discounts', { params });
    const d = res.data;
    const items = d.data || d.items || (Array.isArray(d) ? d : []);
    return {
      data: items,
      meta: d.meta || { total: items.length, page: 1, limit: items.length, totalPages: 1 },
    };
  },

  createDiscount: async (data: Partial<Discount>): Promise<Discount> => {
    const res = await apiClient.post('/discounts', data);
    return res.data;
  },

  // Quotation Templates
  getQuotationTemplates: async (params?: { page?: number; limit?: number }): Promise<{ data: QuotationTemplate[]; meta: any }> => {
    const res = await apiClient.get('/quotation-templates', { params });
    const d = res.data;
    const items = d.items || d.data || (Array.isArray(d) ? d : []);
    return {
      data: items,
      meta: d.meta || { total: items.length, page: 1, limit: items.length, totalPages: 1 },
    };
  },

  // Customers
  getCustomers: async (params?: { page?: number; limit?: number; search?: string }): Promise<{ data: CustomerProfile[]; meta: any }> => {
    const res = await apiClient.get('/customers', { params });
    const d = res.data;
    const items = d.items || d.data || (Array.isArray(d) ? d : []);
    return {
      data: items,
      meta: d.meta || { total: items.length, page: 1, limit: items.length, totalPages: 1 },
    };
  },

  getMyProfile: async (): Promise<CustomerProfile> => {
    const res = await apiClient.get('/customers/me');
    return res.data;
  },

  updateMyProfile: async (data: Partial<CustomerProfile>): Promise<CustomerProfile> => {
    const res = await apiClient.patch('/customers/me', data);
    return res.data;
  },
};
