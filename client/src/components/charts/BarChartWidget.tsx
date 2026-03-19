import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Skeleton } from '../shared/LoadingSkeleton';
import { CHART_COLORS } from './chartColors';

interface BarDef {
  dataKey: string;
  color?: string;
  label: string;
  stackId?: string;
}

interface BarChartWidgetProps {
  data: Array<Record<string, unknown>>;
  xKey: string;
  bars: BarDef[];
  stacked?: boolean;
  horizontal?: boolean;
  loading?: boolean;
  height?: number;
  title?: string;
  formatTooltip?: (value: number) => string;
}

export function BarChartWidget({
  data,
  xKey,
  bars,
  stacked = false,
  horizontal = false,
  loading = false,
  height = 300,
  title,
  formatTooltip,
}: BarChartWidgetProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-panw border border-panw-gray-100 p-6">
        {title && <Skeleton className="h-5 w-40 mb-4" />}
        <div style={{ height }}>
          <Skeleton className="w-full h-full" />
        </div>
      </div>
    );
  }

  const hasData = data.length > 0;

  return (
    <div className="bg-white rounded-lg shadow-panw border border-panw-gray-100 p-6">
      {title && (
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
          {title}
        </h3>
      )}
      {!hasData ? (
        <div
          className="flex items-center justify-center text-sm text-gray-400"
          style={{ height }}
        >
          No data available
        </div>
      ) : (
        <div style={{ height }} aria-label={title ?? 'Bar chart'}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout={horizontal ? 'vertical' : 'horizontal'}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              {horizontal ? (
                <>
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis
                    dataKey={xKey}
                    type="category"
                    tick={{ fontSize: 12 }}
                    width={100}
                  />
                </>
              ) : (
                <>
                  <XAxis
                    dataKey={xKey}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                </>
              )}
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatTooltip ? formatTooltip(value) : value.toLocaleString(),
                  name,
                ]}
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  fontSize: '13px',
                }}
              />
              {bars.length > 1 && (
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span className="text-xs text-gray-600">{value}</span>
                  )}
                />
              )}
              {bars.map((bar, idx) => (
                <Bar
                  key={bar.dataKey}
                  dataKey={bar.dataKey}
                  name={bar.label}
                  fill={bar.color ?? CHART_COLORS[idx % CHART_COLORS.length]}
                  stackId={stacked ? 'stack' : bar.stackId}
                  radius={stacked ? undefined : [4, 4, 0, 0]}
                  maxBarSize={48}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
