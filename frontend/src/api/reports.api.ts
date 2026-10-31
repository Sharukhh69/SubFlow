import { apiClient } from './client';
import {
  DashboardSummaryDto,
  MrrReportDto,
  AgingReportDto,
  RevenueTrendDto,
} from '../types';

export const reportsApi = {
  getSummary: async (params?: { startDate?: string; endDate?: string; planId?: string }): Promise<DashboardSummaryDto> => {
    const res = await apiClient.get<DashboardSummaryDto>('/reports/summary', { params });
    return res.data;
  },

  getMrr: async (): Promise<MrrReportDto> => {
    const res = await apiClient.get<MrrReportDto>('/reports/mrr');
    return res.data;
  },

  getAging: async (): Promise<AgingReportDto> => {
    const res = await apiClient.get<AgingReportDto>('/reports/aging');
    return res.data;
  },

  getRevenueTrend: async (months: number = 6): Promise<RevenueTrendDto> => {
    const res = await apiClient.get<RevenueTrendDto>('/reports/revenue-trend', {
      params: { months },
    });
    return res.data;
  },
};
