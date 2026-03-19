import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { Skeleton } from '../shared/LoadingSkeleton';
import { CHART_COLORS } from './chartColors';

interface DonutChartProps {
  data: Array<{ name: string; value: number }>;
  colors?: string[];
  centerLabel?: string;
  centerValue?: string;
  loading?: boolean;
  height?: number;
  title?: string;
}

export function DonutChart({
  data,
  colors = CHART_COLORS,
  centerLabel,
  centerValue,
  loading = false,
  height = 280,
  title,
}: DonutChartProps) {
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

  const hasData = data.some((d) => d.value > 0);

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
        <div style={{ height }} aria-label={title ?? 'Donut chart'}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius="55%"
                outerRadius="80%"
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={colors[index % colors.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => value.toLocaleString()}
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid #e5e7eb',
                  fontSize: '13px',
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span className="text-xs text-gray-600">{value}</span>
                )}
              />
              {centerLabel && (
                <text
                  x="50%"
                  y="45%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-2xl font-bold fill-gray-900"
                >
                  {centerValue}
                </text>
              )}
              {centerLabel && (
                <text
                  x="50%"
                  y="55%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-xs fill-gray-500"
                >
                  {centerLabel}
                </text>
              )}
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
