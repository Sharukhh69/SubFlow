import { apiClient } from './client';
import { AuthResponse, User, LoginPayload, RegisterPayload } from '../types';

export const authApi = {
  login: async (credentials: LoginPayload): Promise<AuthResponse> => {
    const res = await apiClient.post<AuthResponse>('/auth/login', credentials);
    return res.data;
  },

  register: async (data: RegisterPayload): Promise<any> => {
    const res = await apiClient.post('/auth/register', data);
    return res.data;
  },

  me: async (): Promise<User> => {
    const res = await apiClient.get<User>('/auth/me');
    return res.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },
};
