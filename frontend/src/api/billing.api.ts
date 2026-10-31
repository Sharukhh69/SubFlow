import { apiClient } from './client';
import { BillingRun } from '../types';

export interface BillingRunPayload {
  isDryRun?: boolean;
  targetDate?: string;
}

export interface BillingRunResult {
  runId: string;
  isDryRun: boolean;
  totalEligible: number;
  invoicesGenerated: number;
  invoicesFailed: number;
  executionDurationMs: number;
  details?: any[];
}

export const billingApi = {
  runBilling: async (payload: BillingRunPayload = {}): Promise<BillingRunResult> => {
    const res = await apiClient.post<BillingRunResult>('/billing/run', payload);
    return res.data;
  },

  getRuns: async (limit: number = 20): Promise<BillingRun[]> => {
    const res = await apiClient.get<BillingRun[]>('/billing/runs', { params: { limit } });
    return res.data;
  },
};
