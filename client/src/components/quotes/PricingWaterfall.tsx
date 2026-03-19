import { cn } from '../../utils/cn';
import { formatCurrency, formatPercent } from '../../utils/formatters';
import type { QuoteLineItem } from '../../types';

interface PricingWaterfallProps {
  line: QuoteLineItem;
  compact?: boolean;
}

export function PricingWaterfall({ line, compact = false }: PricingWaterfallProps) {
  const tierDiscountAmt = line.list_price * (line.tier_discount_pct ?? 0) / 100;
  const tierDiscountedPrice = line.list_price - tierDiscountAmt;

  const steps = [
    {
      label: 'List Price',
      value: line.list_price,
      detail: null,
      type: 'base' as const,
    },
    {
      label: 'Tier Discount',
      value: -tierDiscountAmt,
      detail: line.tier_discount_pct != null ? `${formatPercent(line.tier_discount_pct)} off list` : null,
      type: 'discount' as const,
    },
    {
      label: 'Partner Discount',
      value: tierDiscountedPrice - line.unit_price,
      detail:
        line.discount_type === 'percentage'
          ? `${formatPercent(line.discount_value)} off tier price`
          : `${formatCurrency(line.discount_value)}/unit`,
      type: 'discount' as const,
    },
    {
      label: 'Unit Price',
      value: line.unit_price,
      detail: null,
      type: 'result' as const,
    },
  ];

  if (compact) {
    return (
      <div className="text-xs text-gray-500 space-y-0.5">
        <div className="flex justify-between">
          <span>List:</span>
          <span className="font-mono">{formatCurrency(line.list_price)}</span>
        </div>
        {(line.tier_discount_pct ?? 0) > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Tier ({formatPercent(line.tier_discount_pct ?? 0)}):</span>
            <span className="font-mono">-{formatCurrency(tierDiscountAmt)}</span>
          </div>
        )}
        {line.discount_value > 0 && (
          <div className="flex justify-between text-green-600">
            <span>
              Partner (
              {line.discount_type === 'percentage'
                ? formatPercent(line.discount_value)
                : formatCurrency(line.discount_value)}
              ):
            </span>
            <span className="font-mono">
              -{formatCurrency(tierDiscountedPrice - line.unit_price)}
            </span>
          </div>
        )}
        <div className="flex justify-between font-semibold text-gray-900 border-t border-gray-200 pt-0.5">
          <span>Unit:</span>
          <span className="font-mono">{formatCurrency(line.unit_price)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        Pricing Waterfall
      </p>
      {steps.map((step, idx) => {
        if (step.type === 'discount' && step.value === 0) return null;
        return (
          <div
            key={idx}
            className={cn(
              'flex items-center justify-between text-sm',
              step.type === 'result' && 'border-t border-gray-300 pt-1.5 mt-1.5'
            )}
          >
            <div className="flex items-center gap-2">
              {step.type === 'discount' && (
                <span className="w-4 text-center text-green-600 font-medium">-</span>
              )}
              {step.type === 'base' && <span className="w-4" />}
              {step.type === 'result' && <span className="w-4 text-center font-bold">=</span>}
              <span
                className={cn(
                  step.type === 'result' ? 'font-semibold text-gray-900' : 'text-gray-600'
                )}
              >
                {step.label}
              </span>
              {step.detail && (
                <span className="text-xs text-gray-400">({step.detail})</span>
              )}
            </div>
            <span
              className={cn(
                'font-mono tabular-nums',
                step.type === 'discount' ? 'text-green-600' : '',
                step.type === 'result' ? 'font-bold text-gray-900' : 'text-gray-700'
              )}
            >
              {step.type === 'discount'
                ? `-${formatCurrency(Math.abs(step.value))}`
                : formatCurrency(step.value)}
            </span>
          </div>
        );
      })}
      {line.effective_discount_pct != null && (
        <p className="text-xs text-gray-500 mt-2">
          Effective discount from list: {formatPercent(line.effective_discount_pct)}
        </p>
      )}
    </div>
  );
}
