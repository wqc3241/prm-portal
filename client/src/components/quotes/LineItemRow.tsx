import { useState } from 'react';
import { TrashIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/solid';
import { cn } from '../../utils/cn';
import { formatCurrency, formatPercent, humanize } from '../../utils/formatters';
import { PricingWaterfall } from './PricingWaterfall';
import type { QuoteLineItem } from '../../types';

interface LineItemRowProps {
  line: QuoteLineItem;
  index: number;
  editable?: boolean;
  onUpdate?: (lineId: string, field: string, value: number | string) => void;
  onRemove?: (lineId: string) => void;
  isUpdating?: boolean;
  isRemoving?: boolean;
}

export function LineItemRow({
  line,
  index,
  editable = false,
  onUpdate,
  onRemove,
  isUpdating,
  isRemoving,
}: LineItemRowProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr className={cn('group', isUpdating && 'opacity-60')}>
        {/* # */}
        <td className="py-3 px-3 text-xs text-gray-400 text-center">
          {index + 1}
        </td>

        {/* Product */}
        <td className="py-3 px-3">
          <div className="text-sm font-medium text-gray-900">
            {line.product_name}
          </div>
          {line.product_sku && (
            <div className="text-xs text-gray-500 font-mono">
              {line.product_sku}
            </div>
          )}
        </td>

        {/* Qty */}
        <td className="py-3 px-3 text-center">
          {editable ? (
            <input
              type="number"
              min="1"
              value={line.quantity}
              onChange={(e) => onUpdate?.(line.id, 'quantity', Number(e.target.value))}
              className="w-16 rounded border-0 py-1 px-2 text-sm text-center text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-panw-blue"
            />
          ) : (
            <span className="text-sm text-gray-700">{line.quantity}</span>
          )}
        </td>

        {/* List Price */}
        <td className="py-3 px-3 text-right text-sm text-gray-500 font-mono">
          {formatCurrency(line.list_price)}
        </td>

        {/* Tier Discount */}
        <td className="py-3 px-3 text-right text-sm text-gray-500">
          {formatPercent(line.tier_discount_pct ?? 0)}
        </td>

        {/* Partner Discount */}
        <td className="py-3 px-3 text-right">
          {editable ? (
            <div className="flex items-center justify-end gap-1">
              <input
                type="number"
                min="0"
                max={line.discount_type === 'percentage' ? 100 : undefined}
                step="0.1"
                value={line.discount_value}
                onChange={(e) =>
                  onUpdate?.(line.id, 'discount_value', Number(e.target.value))
                }
                className="w-20 rounded border-0 py-1 px-2 text-sm text-right text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-panw-blue"
              />
              <span className="text-xs text-gray-500">
                {line.discount_type === 'percentage' ? '%' : '$'}
              </span>
            </div>
          ) : (
            <span className="text-sm text-gray-700">
              {line.discount_type === 'percentage'
                ? formatPercent(line.discount_value)
                : formatCurrency(line.discount_value)}
            </span>
          )}
        </td>

        {/* Unit Price */}
        <td className="py-3 px-3 text-right text-sm font-medium text-gray-900 font-mono">
          {formatCurrency(line.unit_price)}
        </td>

        {/* Line Total */}
        <td className="py-3 px-3 text-right text-sm font-semibold text-gray-900 font-mono">
          {formatCurrency(line.line_total)}
        </td>

        {/* Approval */}
        <td className="py-3 px-3 text-center">
          {line.discount_approved ? (
            <CheckCircleIcon
              className="h-5 w-5 text-green-500 mx-auto"
              aria-label="Discount approved"
            />
          ) : line.discount_value > 0 ? (
            <div className="flex flex-col items-center">
              <ExclamationCircleIcon
                className="h-5 w-5 text-yellow-500"
                aria-label="Needs approval"
              />
              {line.approval_level && (
                <span className="text-[10px] text-yellow-700 mt-0.5">
                  {humanize(line.approval_level)}
                </span>
              )}
            </div>
          ) : (
            <CheckCircleIcon
              className="h-5 w-5 text-gray-300 mx-auto"
              aria-label="No discount"
            />
          )}
        </td>

        {/* Actions */}
        <td className="py-3 px-3 text-center">
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              aria-label={expanded ? 'Collapse pricing details' : 'Expand pricing details'}
            >
              {expanded ? (
                <ChevronUpIcon className="h-4 w-4" />
              ) : (
                <ChevronDownIcon className="h-4 w-4" />
              )}
            </button>
            {editable && (
              <button
                onClick={() => onRemove?.(line.id)}
                disabled={isRemoving}
                className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 disabled:opacity-50"
                aria-label="Remove line item"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded pricing waterfall */}
      {expanded && (
        <tr>
          <td colSpan={10} className="px-3 pb-3">
            <div className="ml-8 max-w-sm">
              <PricingWaterfall line={line} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
