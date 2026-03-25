import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Zap,
    TrendingUp,
    BarChart3,
    Table as TableIcon,
    Info
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    LineChart,
    Line
} from 'recharts';
import KPICard from '../../../components/charts/KPICard';
import { calculateDailyStats, EnergyHistoryPoint } from '../utils/energyUtils';

interface EnergyReportingSectionProps {
    history: EnergyHistoryPoint[];
    title?: string;
    subtitle?: string;
}

export default function EnergyReportingSection({ history, title, subtitle }: EnergyReportingSectionProps) {
    const { t } = useTranslation();

    const dailyStats = useMemo(() => calculateDailyStats(history), [history]);

    const aggregateKPIs = useMemo(() => {
        if (dailyStats.length === 0) return { partCreuse: 0, expoPointe: 0, loadFactor: 0 };

        const totalKwh = dailyStats.reduce((acc, d) => acc + d.total, 0);
        const totalCreuses = dailyStats.reduce((acc, d) => acc + d.creuses, 0);
        const totalPointe = dailyStats.reduce((acc, d) => acc + d.pointe, 0);
        const avgLoadFactor = dailyStats.reduce((acc, d) => acc + d.loadFactor, 0) / dailyStats.length;

        return {
            partCreuse: totalKwh > 0 ? (totalCreuses / totalKwh) * 100 : 0,
            expoPointe: totalKwh > 0 ? (totalPointe / totalKwh) * 100 : 0,
            loadFactor: avgLoadFactor
        };
    }, [dailyStats]);

    // Formatter for dates in charts
    const formatDate = (dateStr: string) => {
        const [, m, d] = dateStr.split('-');
        return `${d}/${m}`;
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="border-l-4 border-[#0096D6] pl-4">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <Zap className="h-6 w-6 text-[#0096D6]" />
                    {title || t('reporting.energyTitle')}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    {subtitle || t('reporting.energySubtitle')}
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <KPICard
                    label={t('reporting.partCreuse')}
                    value={aggregateKPIs.partCreuse.toFixed(1)}
                    unit="%"
                    icon={TrendingUp}
                    variant={aggregateKPIs.partCreuse > 50 ? 'emerald' : aggregateKPIs.partCreuse > 30 ? 'blue' : 'amber'}
                />
                <KPICard
                    label={t('reporting.expoPointe')}
                    value={aggregateKPIs.expoPointe.toFixed(1)}
                    unit="%"
                    icon={BarChart3}
                    variant={aggregateKPIs.expoPointe < 20 ? 'emerald' : aggregateKPIs.expoPointe < 35 ? 'blue' : 'red'}
                />
                <KPICard
                    label={t('reporting.loadFactor')}
                    value={aggregateKPIs.loadFactor.toFixed(1)}
                    unit="%"
                    icon={Info}
                    variant={aggregateKPIs.loadFactor > 50 ? 'emerald' : 'amber'}
                />
            </div>

            {/* Main Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Stacked Bar Chart */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-gray-900 dark:text-white">
                        <BarChart3 className="h-5 w-5 text-blue-500" />
                        {t('reporting.dailyConsumption')} (kWh)
                    </h3>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[...dailyStats].reverse()} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="date" tickFormatter={formatDate} stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E5E7EB' }}
                                    formatter={(value: any) => typeof value === 'number' ? value.toFixed(2) : value}
                                />
                                <Legend />
                                <Bar dataKey="creuses" name={t('reporting.creuses')} stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="pleines" name={t('reporting.pleines')} stackId="a" fill="#f97316" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="pointe" name={t('reporting.pointe')} stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* KPI Trend Lines */}
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-gray-900 dark:text-white">
                        <TrendingUp className="h-5 w-5 text-emerald-500" />
                        {t('reporting.kpiTrends')}
                    </h3>
                    <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={[...dailyStats].reverse()}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                <XAxis dataKey="date" tickFormatter={formatDate} stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} unit="%" />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E5E7EB' }} 
                                    formatter={(value: any) => typeof value === 'number' ? `${value.toFixed(2)}%` : value}
                                />
                                <Legend />
                                <Line type="monotone" dataKey="partCreuse" name={t('reporting.partCreuse')} stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="expoPointe" name={t('reporting.expoPointe')} stroke="#f97316" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="loadFactor" name={t('reporting.loadFactor')} stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Daily Table */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                <div className="p-6 border-b dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex items-center justify-between">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-gray-900 dark:text-white">
                        <TableIcon className="h-5 w-5 text-gray-500" />
                        {t('reporting.dailyTable')}
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wider text-[10px]">
                            <tr>
                                <th className="px-6 py-4">{t('reporting.date')}</th>
                                <th className="px-6 py-4">{t('reporting.creuses')} (kWh)</th>
                                <th className="px-6 py-4">{t('reporting.pleines')} (kWh)</th>
                                <th className="px-6 py-4">{t('reporting.pointe')} (kWh)</th>
                                <th className="px-6 py-4 font-bold text-gray-900 dark:text-white">{t('reporting.total')} (kWh)</th>
                                <th className="px-6 py-4">{t('reporting.partCreuse')}</th>
                                <th className="px-6 py-4">{t('reporting.expoPointe')}</th>
                                <th className="px-6 py-4">{t('reporting.loadFactor')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y dark:divide-gray-700">
                            {dailyStats.map((day) => (
                                <tr key={day.date} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{formatDate(day.date)}</td>
                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{day.creuses.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{day.pleines.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-gray-600 dark:text-gray-300">{day.pointe.toFixed(2)}</td>
                                    <td className="px-6 py-4 font-bold text-[#0096D6]">{day.total.toFixed(2)}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${day.partCreuse > 50 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {day.partCreuse.toFixed(1)}%
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${day.expoPointe > 35 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {day.expoPointe.toFixed(1)}%
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500">{day.loadFactor.toFixed(1)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
