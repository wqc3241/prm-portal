import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { quotesApi } from '../api/quotes';
import { getApiErrorMessage } from '../api/client';
import type {
  CreateQuoteRequest,
  UpdateQuoteRequest,
  AddLineItemRequest,
  UpdateLineItemRequest,
  ApproveQuoteRequest,
  RejectQuoteRequest,
  QuoteQueryParams,
} from '../types';

// ---- Query Keys ----
const quoteKeys = {
  all: ['quotes'] as const,
  lists: () => [...quoteKeys.all, 'list'] as const,
  list: (params: QuoteQueryParams) => [...quoteKeys.lists(), params] as const,
  details: () => [...quoteKeys.all, 'detail'] as const,
  detail: (id: string) => [...quoteKeys.details(), id] as const,
  history: (id: string) => [...quoteKeys.all, 'history', id] as const,
};

// ---- Queries ----

export function useQuotes(params: QuoteQueryParams) {
  return useQuery({
    queryKey: quoteKeys.list(params),
    queryFn: async () => {
      const { data } = await quotesApi.list(params);
      return data;
    },
  });
}

export function useQuote(id: string | undefined) {
  return useQuery({
    queryKey: quoteKeys.detail(id!),
    queryFn: async () => {
      const { data } = await quotesApi.getById(id!);
      return data.data;
    },
    enabled: !!id,
  });
}

export function useQuoteHistory(id: string | undefined) {
  return useQuery({
    queryKey: quoteKeys.history(id!),
    queryFn: async () => {
      const { data } = await quotesApi.getHistory(id!);
      return data.data;
    },
    enabled: !!id,
  });
}

// ---- Mutations ----

function useInvalidateQuote(id?: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });
    if (id) {
      queryClient.invalidateQueries({ queryKey: quoteKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: quoteKeys.history(id) });
    }
  };
}

export function useCreateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateQuoteRequest) => quotesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });
      toast.success('Quote created');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useUpdateQuote(id: string) {
  const invalidate = useInvalidateQuote(id);
  return useMutation({
    mutationFn: (data: UpdateQuoteRequest) => quotesApi.update(id, data),
    onSuccess: () => {
      invalidate();
      toast.success('Quote updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useDeleteQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => quotesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });
      toast.success('Quote deleted');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useAddLine(quoteId: string) {
  const invalidate = useInvalidateQuote(quoteId);
  return useMutation({
    mutationFn: (data: AddLineItemRequest) => quotesApi.addLine(quoteId, data),
    onSuccess: () => {
      invalidate();
      toast.success('Line item added');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useUpdateLine(quoteId: string) {
  const invalidate = useInvalidateQuote(quoteId);
  return useMutation({
    mutationFn: ({
      lineId,
      data,
    }: {
      lineId: string;
      data: UpdateLineItemRequest;
    }) => quotesApi.updateLine(quoteId, lineId, data),
    onSuccess: () => {
      invalidate();
      toast.success('Line item updated');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useRemoveLine(quoteId: string) {
  const invalidate = useInvalidateQuote(quoteId);
  return useMutation({
    mutationFn: (lineId: string) => quotesApi.removeLine(quoteId, lineId),
    onSuccess: () => {
      invalidate();
      toast.success('Line item removed');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useSubmitQuote(id: string) {
  const invalidate = useInvalidateQuote(id);
  return useMutation({
    mutationFn: () => quotesApi.submit(id),
    onSuccess: (res) => {
      invalidate();
      const autoApproved = res.data.data && 'auto_approved' in res.data.data && res.data.data.auto_approved;
      if (autoApproved) {
        toast.success('Quote auto-approved! All discounts within tier threshold.');
      } else {
        toast.success('Quote submitted for approval');
      }
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useApproveQuote(id: string) {
  const invalidate = useInvalidateQuote(id);
  return useMutation({
    mutationFn: (data?: ApproveQuoteRequest) => quotesApi.approve(id, data),
    onSuccess: () => {
      invalidate();
      toast.success('Quote approved');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useRejectQuote(id: string) {
  const invalidate = useInvalidateQuote(id);
  return useMutation({
    mutationFn: (data: RejectQuoteRequest) => quotesApi.reject(id, data),
    onSuccess: () => {
      invalidate();
      toast.success('Quote rejected');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useSendQuote(id: string) {
  const invalidate = useInvalidateQuote(id);
  return useMutation({
    mutationFn: () => quotesApi.send(id),
    onSuccess: () => {
      invalidate();
      toast.success('Quote sent to customer');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useAcceptQuote(id: string) {
  const invalidate = useInvalidateQuote(id);
  return useMutation({
    mutationFn: () => quotesApi.accept(id),
    onSuccess: () => {
      invalidate();
      toast.success('Quote marked as accepted');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useCloneQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => quotesApi.clone(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });
      toast.success('Quote cloned as new draft');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}

export function useRecalculateQuote(id: string) {
  const invalidate = useInvalidateQuote(id);
  return useMutation({
    mutationFn: () => quotesApi.recalculate(id),
    onSuccess: () => {
      invalidate();
      toast.success('Pricing recalculated with current prices and tier');
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });
}
