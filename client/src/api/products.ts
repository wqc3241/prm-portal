import apiClient from './client';
import type {
  ApiResponse,
  Product,
  ProductCategory,
  ProductQueryParams,
  TierProductPricing,
} from '../types';

export const productsApi = {
  list(params?: ProductQueryParams) {
    return apiClient.get<ApiResponse<Product[]>>('/products', { params });
  },

  getById(id: string) {
    return apiClient.get<ApiResponse<Product>>(`/products/${id}`);
  },

  create(data: Partial<Product>) {
    return apiClient.post<ApiResponse<Product>>('/products', data);
  },

  update(id: string, data: Partial<Product>) {
    return apiClient.patch<ApiResponse<Product>>(`/products/${id}`, data);
  },

  delete(id: string) {
    return apiClient.delete<ApiResponse<null>>(`/products/${id}`);
  },

  getCategories() {
    return apiClient.get<ApiResponse<ProductCategory[]>>('/products/categories');
  },

  createCategory(data: { name: string; parent_id?: string; sort_order?: number }) {
    return apiClient.post<ApiResponse<ProductCategory>>('/products/categories', data);
  },

  updateCategory(id: string, data: Partial<ProductCategory>) {
    return apiClient.patch<ApiResponse<ProductCategory>>(
      `/products/categories/${id}`,
      data
    );
  },

  getTierPricing(productId: string) {
    return apiClient.get<ApiResponse<TierProductPricing[]>>(
      `/products/${productId}/tier-pricing`
    );
  },

  setTierPricing(
    productId: string,
    tierId: string,
    data: { discount_pct: number; special_price?: number | null }
  ) {
    return apiClient.put<ApiResponse<TierProductPricing>>(
      `/products/${productId}/tier-pricing/${tierId}`,
      data
    );
  },
};
