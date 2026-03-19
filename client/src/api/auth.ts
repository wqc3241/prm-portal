import apiClient from './client';
import type {
  ApiResponse,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  User,
} from '../types';

export const authApi = {
  register(data: RegisterRequest) {
    return apiClient.post<ApiResponse<AuthResponse>>('/auth/register', data);
  },

  login(data: LoginRequest) {
    return apiClient.post<ApiResponse<AuthResponse>>('/auth/login', data);
  },

  refresh(refreshToken: string) {
    return apiClient.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
      '/auth/refresh',
      { refreshToken }
    );
  },

  logout() {
    return apiClient.post<ApiResponse<null>>('/auth/logout');
  },

  getMe() {
    return apiClient.get<ApiResponse<User>>('/auth/me');
  },

  updateMe(data: Partial<Pick<User, 'first_name' | 'last_name' | 'title' | 'phone' | 'avatar_url' | 'timezone' | 'notification_prefs'>>) {
    return apiClient.patch<ApiResponse<User>>('/auth/me', data);
  },

  forgotPassword(data: ForgotPasswordRequest) {
    return apiClient.post<ApiResponse<{ message: string }>>('/auth/forgot-password', data);
  },

  resetPassword(data: ResetPasswordRequest) {
    return apiClient.post<ApiResponse<{ message: string }>>('/auth/reset-password', data);
  },
};
