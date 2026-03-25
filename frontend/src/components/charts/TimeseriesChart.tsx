import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface TimeseriesChartProps {
    data: any[];
    dataKey?: string; // Legacy support
    color?: string;   // Legacy support
    unit?: string;
    height?: number;
    xAxisKey?: string;
    series?: { key: string; color: string; name: string }[]; // New multi-series support
    scrollable?: boolean; // Enable horizontal scrolling
    timeframe?: string; // timeframe hint for formatting (today, week, month, year)
}

export default function TimeseriesChart({
    data,
    dataKey,
    color = "#3b82f6",
    unit = "",
    height = 300,
    xAxisKey = "time",
    series,
    scrollable = false,
    timeframe = 'today'
}: TimeseriesChartProps) {

    // Helper: Convert legacy props to series array if not provided
    const chartSeries = series || (dataKey ? [{ key: dataKey, color: color, name: unit }] : []);

    // Generate unique ID for gradients to prevent conflicts
    const chartId = React.useMemo(() => `chart-${Math.random().toString(36).substr(2, 9)}`, []);

    const formatXAxis = (tickItemValue: any) => {
        if (!tickItemValue) return '';
        try {
            const date = new Date(tickItemValue);
            // Check if invalid date
            if (isNaN(date.getTime())) return tickItemValue;

            switch (timeframe) {
                case 'year':
                    return date.toLocaleDateString('fr-FR', { month: 'short' });
                case 'week':
                case 'month':
                    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
                case 'today':
                default:
                    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            }
        } catch (e) {
            return tickItemValue;
        }
    };

    if (!data || data.length === 0) {
        return (
            <div style={{ height: height, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg text-gray-400">
                Pas de données disponibles
            </div>
        );
    }

    // Dynamic width calculation for scrolling
    // 6px per point provides decent resolution for minutes in a day (1440 * 6 = ~8640px)
    // For smaller datasets, it defaults to 100% via CSS layout if calculated width is small
    const calculatedWidth = scrollable ? Math.max(data.length * 10, 800) : '100%';

    return (
        <div style={{
            height: height,
            width: '100%',
            minHeight: height,
            overflowX: scrollable ? 'auto' : 'hidden',
            overflowY: 'hidden'
        }} className={scrollable ? "scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600" : ""}>
            <div style={{ width: calculatedWidth, height: '100%', minWidth: '100%' }}>
                <ResponsiveContainer width="100%" height="100%" debounce={300}>
                    <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            {chartSeries.map((s) => (
                                <linearGradient key={s.key} id={`grad-${chartId}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={s.color} stopOpacity={0.1} />
                                    <stop offset="95%" stopColor={s.color} stopOpacity={0} />
                                </linearGradient>
                            ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                        <XAxis
                            dataKey={xAxisKey}
                            tickFormatter={formatXAxis}
                            stroke="#9CA3AF"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={30}
                        />
                        <YAxis
                            stroke="#9CA3AF"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `${value}`}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#fff', border: '1px solid #E5E7EB', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                            labelFormatter={(label) => {
                                try {
                                    return new Date(label).toLocaleString('fr-FR');
                                } catch { return label; }
                            }}
                            formatter={(value: any, name: any) => {
                                const num = Number(value);
                                const precision = num > 0 && num < 1 ? 3 : 2;
                                return [`${num.toFixed(precision)} ${unit}`, name];
                            }}
                        />
                        {series && <Legend wrapperStyle={{ paddingTop: '10px' }} />}

                        {chartSeries.map((s) => (
                            <Area
                                key={s.key}
                                type="monotone"
                                dataKey={s.key}
                                name={s.name}
                                stroke={s.color}
                                strokeWidth={2}
                                fillOpacity={1}
                                fill={`url(#grad-${chartId}-${s.key})`}
                            />
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
