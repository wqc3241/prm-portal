import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQuote, useUpdateQuote } from '../../hooks/useQuotes';
import {
  PageHeader,
  FormField,
  Input,
  Textarea,
  Skeleton,
} from '../../components/shared';

export function QuoteEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: quote, isLoading } = useQuote(id);
  const updateMutation = useUpdateQuote(id!);

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [taxAmount, setTaxAmount] = useState('0');

  useEffect(() => {
    if (quote) {
      setCustomerName(quote.customer_name);
      setCustomerEmail(quote.customer_email ?? '');
      setValidFrom(quote.valid_from?.split('T')[0] ?? '');
      setValidUntil(quote.valid_until?.split('T')[0] ?? '');
      setPaymentTerms(quote.payment_terms ?? '');
      setNotes(quote.notes ?? '');
      setTermsAndConditions(quote.terms_and_conditions ?? '');
      setTaxAmount(String(quote.tax_amount ?? 0));
    }
  }, [quote]);

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Quote not found
        </h2>
        <button
          onClick={() => navigate('/quotes')}
          className="text-sm font-medium text-panw-navy hover:text-panw-blue"
        >
          Back to Quotes
        </button>
      </div>
    );
  }

  const isEditable = quote.status === 'draft' || quote.status === 'rejected';
  if (!isEditable) {
    navigate(`/quotes/${id}`);
    return null;
  }

  const handleSave = async () => {
    if (!customerName.trim()) {
      toast.error('Customer name is required');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim() || undefined,
        valid_from: validFrom || undefined,
        valid_until: validUntil || undefined,
        payment_terms: paymentTerms || undefined,
        notes: notes || undefined,
        terms_and_conditions: termsAndConditions || undefined,
        tax_amount: Number(taxAmount),
      });
      navigate(`/quotes/${id}`);
    } catch {
      // Error handled
    }
  };

  return (
    <div>
      <PageHeader
        title={`Edit ${quote.quote_number}`}
        breadcrumbs={[
          { label: 'Quotes', to: '/quotes' },
          { label: quote.quote_number, to: `/quotes/${id}` },
          { label: 'Edit' },
        ]}
      />

      <div className="max-w-2xl">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
          <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-3">
            Customer Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Customer Name" htmlFor="edit-customer-name" required>
              <Input
                id="edit-customer-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </FormField>
            <FormField label="Customer Email" htmlFor="edit-customer-email">
              <Input
                id="edit-customer-email"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </FormField>
          </div>

          <h3 className="text-sm font-semibold text-gray-900 border-b border-gray-200 pb-3 pt-2">
            Quote Settings
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Valid From" htmlFor="edit-valid-from">
              <Input
                id="edit-valid-from"
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
              />
            </FormField>
            <FormField label="Valid Until" htmlFor="edit-valid-until">
              <Input
                id="edit-valid-until"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </FormField>
            <FormField label="Payment Terms" htmlFor="edit-payment-terms">
              <Input
                id="edit-payment-terms"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
              />
            </FormField>
            <FormField label="Tax Amount" htmlFor="edit-tax">
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">
                  $
                </span>
                <Input
                  id="edit-tax"
                  type="number"
                  min="0"
                  step="0.01"
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(e.target.value)}
                  className="pl-7"
                />
              </div>
            </FormField>
          </div>

          <FormField label="Notes" htmlFor="edit-notes">
            <Textarea
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </FormField>

          <FormField label="Terms & Conditions" htmlFor="edit-terms">
            <Textarea
              id="edit-terms"
              value={termsAndConditions}
              onChange={(e) => setTermsAndConditions(e.target.value)}
              rows={3}
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => navigate(`/quotes/${id}`)}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="rounded-md bg-panw-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-panw-navy shadow-sm disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
