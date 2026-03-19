import apiClient from './client';
import type {
  ApiResponse,
  Quote,
  QuoteLineItem,
  QuoteStatusHistory,
  CreateQuoteRequest,
  UpdateQuoteRequest,
  AddLineItemRequest,
  UpdateLineItemRequest,
  ApproveQuoteRequest,
  RejectQuoteRequest,
  QuoteQueryParams,
} from '../types';

export const quotesApi = {
  // ---- CRUD ----
  list(params?: QuoteQueryParams) {
    return apiClient.get<ApiResponse<Quote[]>>('/quotes', { params });
  },

  getById(id: string) {
    return apiClient.get<ApiResponse<Quote>>(`/quotes/${id}`);
  },

  create(data: CreateQuoteRequest) {
    return apiClient.post<ApiResponse<Quote>>('/quotes', data);
  },

  update(id: string, data: UpdateQuoteRequest) {
    return apiClient.patch<ApiResponse<Quote>>(`/quotes/${id}`, data);
  },

  delete(id: string) {
    return apiClient.delete<ApiResponse<null>>(`/quotes/${id}`);
  },

  // ---- Line Items ----
  addLine(quoteId: string, data: AddLineItemRequest) {
    return apiClient.post<ApiResponse<QuoteLineItem>>(
      `/quotes/${quoteId}/lines`,
      data
    );
  },

  updateLine(quoteId: string, lineId: string, data: UpdateLineItemRequest) {
    return apiClient.patch<ApiResponse<QuoteLineItem>>(
      `/quotes/${quoteId}/lines/${lineId}`,
      data
    );
  },

  removeLine(quoteId: string, lineId: string) {
    return apiClient.delete<ApiResponse<null>>(
      `/quotes/${quoteId}/lines/${lineId}`
    );
  },

  // ---- Status transitions ----
  submit(id: string) {
    return apiClient.post<
      ApiResponse<Quote & { auto_approved?: boolean; approval_level?: string }>
    >(`/quotes/${id}/submit`);
  },

  approve(id: string, data?: ApproveQuoteRequest) {
    return apiClient.post<ApiResponse<Quote>>(
      `/quotes/${id}/approve`,
      data ?? {}
    );
  },

  reject(id: string, data: RejectQuoteRequest) {
    return apiClient.post<ApiResponse<Quote>>(`/quotes/${id}/reject`, data);
  },

  send(id: string) {
    return apiClient.post<ApiResponse<Quote>>(`/quotes/${id}/send`);
  },

  accept(id: string) {
    return apiClient.post<ApiResponse<Quote>>(`/quotes/${id}/accept`);
  },

  clone(id: string) {
    return apiClient.post<ApiResponse<Quote>>(`/quotes/${id}/clone`);
  },

  // ---- Pricing ----
  recalculate(id: string) {
    return apiClient.post<ApiResponse<Quote>>(`/quotes/${id}/recalculate`);
  },

  // ---- PDF ----
  getPdfUrl(id: string) {
    return `/api/v1/quotes/${id}/pdf`;
  },

  // ---- History ----
  getHistory(id: string) {
    return apiClient.get<ApiResponse<QuoteStatusHistory[]>>(
      `/activity?entity_type=quote&entity_id=${id}&sort=created_at:desc`
    );
  },
};
