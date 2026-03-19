import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Skeleton } from '../shared/LoadingSkeleton';
import { CHART_COLORS } from './chartColors';

interface LineDef {
  dataKey: string;
  color?: string;
  label: string;
}

interface LineChartWidgetProps {
  data: Array<Record<string, unknown>>;
  xKey: string;
  lines: LineDef[];
  loading?: boolean;
  height?: number;
  title?: string;
  formatTooltip?: (value: number) => string;
}

export function LineChartWidget({
  data,
  xKey,
  lines,
  loading = false,
  height = 300,
  title,
  formatTooltip,
}: LineChartWidgetProps) {
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
        <div style={{ height }} aria-label={title ?? 'Line chart'}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: 12 }}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 12 }} />
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
              {lines.length > 1 && (
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => (
                    <span className="text-xs text-gray-600">{value}</span>
                  )}
                />
              )}
              {lines.map((line, idx) => (
                <Line
                  key={line.dataKey}
                  type="monotone"
                  dataKey={line.dataKey}
                  name={line.label}
                  stroke={line.color ?? CHART_COLORS[idx % CHART_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
