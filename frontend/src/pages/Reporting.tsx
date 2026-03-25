import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Zap,
    Activity,
    Download,
    Wifi,
    Timer,
    Loader2,
    X
} from 'lucide-react';
import KPICard from '../components/charts/KPICard';
import TimeseriesChart from '../components/charts/TimeseriesChart';
import EnergyReportingSection from '../features/energy/components/EnergyReportingSection';

export default function Reporting() {
    const { t } = useTranslation();
    const [period, setPeriod] = useState('today');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        sensors: [] as any[], // Changed to array for detailed stats
        energy: { total_kwh: 0 },
        oxygen: { valve1_ticks: 0, valve2_ticks: 0, avg_pressure1: 0, avg_pressure2: 0 },
        avgAqi: 0
    });
    const [history, setHistory] = useState({ energy: [], oxygen: [] });
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedType, setSelectedType] = useState('');
    const [offlineList, setOfflineList] = useState<any[]>([]);

    useEffect(() => {
        fetchReportData();
    }, [period]);

    const fetchReportData = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('clinicToken');
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`/api/reporting/global?timeframe=${period}`, { headers });
            const result = await res.json();

            if (result.success) {
                setStats(result.data);
                // Transform history for charts
                setHistory({
                    energy: result.data.energy.history || [],
                    oxygen: result.data.oxygen.history || []
                });
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSensorClick = async (type: string) => {
        try {
            setSelectedType(type);
            setModalOpen(true);
            setOfflineList([]); // Clear previous list while loading

            const token = localStorage.getItem('clinicToken');
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            // Use encodeURIComponent for types with spaces like 'Gateway RTLS'
            const res = await fetch(`/api/reporting/offline/${encodeURIComponent(type)}`, { headers });
            const result = await res.json();

            if (result.success) {
                setOfflineList(result.data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Helper: Convert "ticks" to duration based on 10s sampling rate
    const formatDuration = (ticks: number) => {
        if (!ticks) return '0 min';
        const seconds = ticks * 10;
        const minutes = seconds / 60;

        if (minutes > 60) return `${(minutes / 60).toFixed(1)} h`;
        return `${minutes.toFixed(0)} min`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                        <Activity className="h-8 w-8 text-blue-600" />
                        {t('reporting.title')}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        {t('reporting.subtitle')}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setPeriod('today')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${period === 'today' ? 'bg-[#0096D6] text-white' : 'bg-white text-gray-700 border'}`}
                    >
                        {t('reporting.today')}
                    </button>
                    <button
                        onClick={() => setPeriod('week')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${period === 'week' ? 'bg-[#0096D6] text-white' : 'bg-white text-gray-700 border'}`}
                    >
                        {t('reporting.week')}
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300">
                        <Download className="h-4 w-4" />
                        {t('reporting.exportPdf')}
                    </button>
                </div>
            </div>

            {/* Section 1: IoT Fleet Status */}
            <div className="mb-8">
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 border-b pb-2 dark:border-gray-700">
                    {t('reporting.iotFleetStatus')}
                </h3>
                {/* Detailed Sensor Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm col-span-3">
                        <h4 className="font-semibold mb-4 text-gray-800 dark:text-white flex items-center gap-2">
                            <Wifi className="h-5 w-5 text-blue-500" /> {t('reporting.connectedDevices')}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            {Array.isArray(stats.sensors) ? stats.sensors.map((s: any, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => handleSensorClick(s.label)}
                                    className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                >
                                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">{s.label}</div>
                                    <div className="flex items-end justify-between mb-2">
                                        <span className="text-xl font-bold text-gray-900 dark:text-white">{s.active}</span>
                                        <span className="text-xs text-gray-400">/ {s.total}</span>
                                    </div>
                                    {/* Progress Bar */}
                                    <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-600">
                                        <div
                                            className={`h-1.5 rounded-full transition-all duration-500 ${s.percentage > 90 ? 'bg-emerald-500' :
                                                s.percentage > 50 ? 'bg-yellow-500' : 'bg-red-500'
                                                }`}
                                            style={{ width: `${s.percentage}%` }}
                                        ></div>
                                    </div>
                                    <div className="text-right text-xs mt-1 font-medium text-gray-600 dark:text-gray-300">
                                        {s.percentage}%
                                    </div>
                                </div>
                            )) : (
                                <div className="col-span-5 text-center py-4 text-gray-500">{t('reporting.loadingSensorData')}</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Section 2: Consumption & Environment */}
            <div>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 border-b pb-2 dark:border-gray-700">
                    {t('reporting.consumptionEnvironment')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <KPICard
                        label={t('reporting.totalEnergy')}
                        value={(stats.energy.total_kwh || 0).toFixed(1)}
                        unit="kWh"
                        icon={Zap}
                        variant="gray"
                    />
                    <KPICard
                        label={t('reporting.valveOpenTime')}
                        value={formatDuration(stats.oxygen.valve1_ticks + stats.oxygen.valve2_ticks)}
                        unit=""
                        icon={Timer}
                        variant="blue"
                        secondaryValue={`${t('reporting.avgPressure')}: ${(stats.oxygen.avg_pressure1 || 0).toFixed(1)} Bar`}
                    />
                </div>
            </div>

            {/* Section 3: Comparative Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                        <Zap className="h-5 w-5 text-yellow-500" />
                        {t('reporting.electricLoadCurve')}
                    </h3>
                    <div className="h-[300px] w-full min-h-[300px]">
                        <TimeseriesChart
                            data={history.energy}
                            dataKey="total_kw"
                            color="#eab308"
                            unit="kW"
                            height={300}
                            xAxisKey="time"
                        />
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
                        <Activity className="h-5 w-5 text-blue-500" />
                        {t('reporting.oxygenPressureEvolution')}
                    </h3>
                    <div className="h-[300px] w-full min-h-[300px]">
                        <TimeseriesChart
                            data={history.oxygen}
                            unit="Bar"
                            height={300}
                            xAxisKey="time"
                            series={[
                                { key: 'pressure1', color: '#3b82f6', name: 'Citerne 1' },
                                { key: 'pressure2', color: '#10b981', name: 'Citerne 2' }
                            ]}
                            scrollable={true}
                        />
                    </div>
                </div>
            </div>

            {/* Section 4: Advanced Energy Monitoring (MACHWATT) */}
            <div className="pt-8 border-t dark:border-gray-700">
                <EnergyReportingSection history={history.energy} />
            </div>

            {/* Offline Devices Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                {selectedType} - {t('reporting.offlineEquipmentFor')}
                            </h3>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            {offlineList.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">{t('reporting.noOfflineEquipment')}</p>
                            ) : (
                                <table className="w-full text-start">
                                    <thead>
                                        <tr className="border-b dark:border-gray-700 text-sm font-medium text-gray-500">
                                            <th className="pb-3 ps-2">{t('reporting.equipmentName')}</th>
                                            <th className="pb-3">{t('reporting.lastSeen')}</th>
                                            <th className="pb-3 text-end">{t('reporting.action')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y dark:divide-gray-700">
                                        {offlineList.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="py-3 ps-2 font-medium text-gray-900 dark:text-white">
                                                    {item.name || item.id}
                                                    <div className="text-xs text-gray-400 font-normal">{item.id}</div>
                                                </td>
                                                <td className="py-3 text-sm text-gray-600 dark:text-gray-300">
                                                    {item.last_seen ? new Date(item.last_seen).toLocaleString() : t('reporting.neverSeen')}
                                                </td>
                                                <td className="py-3 text-end">
                                                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                                        {t('common.offline')}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
