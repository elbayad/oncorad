import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Zap,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Building,
  Lightbulb,
  MapPin,
  Monitor,
  Clock,
  FileText,
  Calendar,
  X,
  Loader2
} from 'lucide-react';
import TimeseriesChart from '../../components/charts/TimeseriesChart';
import EnergyReportingSection from './components/EnergyReportingSection';

interface EnergyStats {
  id: string | number;
  label: string;
  type: 'floor' | 'zone' | 'device';
  consumption: number; // kW
  peak: number;
  count: number; // devices count
  lastUpdate: string;

  // Advanced KPIs
  kwhDaily: number;
  kwhWeekly: number;
  kwhMonthly: number;
  kwhYearly: number;
  pf: number;
  imbalance: number;
  minutesSinceLast: number;
  currentStatus: 'OK' | 'A_SURVEILLER' | 'CRITIQUE';

  // Device specific details
  deviceCode?: string;
  channel?: string;
  cable?: string;
}

interface Equipment {
  id: string;
  name: string;
  device: string;
  channel: string;
  cable: string;
  ctcurrent: number;
  floor_id: number;
  zone: string;
  is_active: boolean;
  consumption_kw?: number;
  kwh_today?: number;
  kwh_week?: number;
  kwh_month?: number;
  kwh_year?: number;
  pf?: number;
  frequency?: number;
  minutes_since_last?: number;
  current_status?: 'OK' | 'A_SURVEILLER' | 'CRITIQUE';
  reading_time?: string;
  voltage_a?: number;
  voltage_b?: number;
  voltage_c?: number;
}

interface HistoryPoint {
  time: string;
  total_kw: number;
}

export default function EnergyPulse() {
  const { t, i18n } = useTranslation();
  const [viewMode, setViewMode] = useState<'floor' | 'zone' | 'device'>('floor');
  const [selectedTimeframe, setSelectedTimeframe] = useState('today');
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [historyData, setHistoryData] = useState<HistoryPoint[]>([]);


  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [consumptionModalOpen, setConsumptionModalOpen] = useState(false);
  const [selectedItemForConsumption, setSelectedItemForConsumption] = useState<EnergyStats | null>(null);
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [rangeHistory, setRangeHistory] = useState<HistoryPoint[]>([]);

  useEffect(() => {
    fetchEnergyData();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchEnergyData, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [selectedTimeframe]);

  const calculateImbalance = (vA?: number, vB?: number, vC?: number) => {
    const a = Number(vA) || 0;
    const b = Number(vB) || 0;
    const c = Number(vC) || 0;
    if (a === 0 && b === 0 && c === 0) return 0;
    const avg = (a + b + c) / 3;
    const maxDev = Math.max(Math.abs(a - avg), Math.abs(b - avg), Math.abs(c - avg));
    return (maxDev / avg) * 100;
  };

  // NATURE OF ALERT LOGIC
  const getAlertNature = (eq: Equipment) => {
    const reasons: string[] = [];
    const minutes = Number(eq.minutes_since_last) || 0;
    const imbalance = calculateImbalance(eq.voltage_a, eq.voltage_b, eq.voltage_c);
    const freq = Number(eq.frequency) || 50;

    if (minutes > 10) reasons.push(t('energy.offlineReason'));
    if (imbalance > 5) reasons.push(`${t('energy.lowPF')} (${imbalance.toFixed(1)}%)`);
    if (freq < 49.5 || freq > 50.5) reasons.push(`${t('energy.freqOutOfRange')} (${freq.toFixed(1)}Hz)`);
    if (eq.current_status === 'CRITIQUE' && minutes <= 10) reasons.push(t('energy.overloadAnomaly'));

    return reasons.length > 0 ? reasons.join(", ") : t('energy.unknown');
  };

  const alertDevices = useMemo(() => {
    return equipmentList.filter(eq =>
      eq.current_status === 'CRITIQUE' || eq.current_status === 'A_SURVEILLER'
    );
  }, [equipmentList]);

  const fetchEnergyData = async () => {
    try {
      const token = localStorage.getItem('clinicToken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/energy', { headers });
      const result = await response.json();
      if (result.success) {
        setEquipmentList(result.data);
      }
    } catch (error) {
    }
  };

  const fetchDetailedReport = async () => {
    if (!selectedItemForConsumption) return;
    try {
      setRangeLoading(true);
      setRangeError(null);
      setRangeHistory([]);
      const token = localStorage.getItem('clinicToken');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const params = new URLSearchParams({
        type: selectedItemForConsumption.type,
        id: selectedItemForConsumption.id.toString(),
        startDate,
        endDate
      });

      const response = await fetch(`/api/energy/history-range?${params.toString()}`, { headers });
      const result = await response.json();
      if (result.success) {
        setRangeHistory(result.data);
      } else {
        setRangeError(result.message || 'Error');
      }
    } catch (error: any) {
      console.error('Error fetching detailed report:', error);
      setRangeError(error.message || 'Error');
    } finally {
      setRangeLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const token = localStorage.getItem('clinicToken');
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/energy/history?timeframe=${selectedTimeframe}`, { headers });
      const result = await response.json();
      if (result.success) {
        setHistoryData(result.data);
      }
    } catch (error) {
    }
  };

  const handleDownloadReport = async () => {
    try {
      const token = localStorage.getItem('clinicToken');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/energy/report/pdf', { headers });
      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rapport_Energie_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading report:', error);
      alert(t('energy.downloadError'));
    }
  };

  const displayData = useMemo(() => {
    const now = new Date();

    if (viewMode === 'floor') {
      const map = new Map<number, EnergyStats>();
      equipmentList.forEach(eq => {
        const floorId = eq.floor_id || 0;
        if (!map.has(floorId)) {
          map.set(floorId, {
            id: floorId,
            label: `${t('common.floor')} ${floorId}`,
            type: 'floor',
            consumption: 0,
            peak: 0,
            count: 0,
            lastUpdate: now.toLocaleTimeString(),
            kwhDaily: 0,
            kwhWeekly: 0,
            kwhMonthly: 0,
            kwhYearly: 0,
            pf: 0,
            imbalance: 0,
            minutesSinceLast: 0,
            currentStatus: 'OK'
          });
        }
        const stats = map.get(floorId)!;
        stats.consumption += Number(eq.consumption_kw) || 0;
        stats.kwhDaily += Number(eq.kwh_today) || 0;
        stats.kwhWeekly += Number(eq.kwh_week) || 0;
        stats.kwhMonthly += Number(eq.kwh_month) || 0;
        stats.kwhYearly += Number(eq.kwh_year) || 0;
        stats.count += 1;
      });
      return Array.from(map.values()).sort((a, b) => Number(a.id) - Number(b.id));
    }
    else if (viewMode === 'zone') {
      const map = new Map<string, EnergyStats>();
      equipmentList.forEach(eq => {
        const zone = eq.zone || 'Unknown';
        if (!map.has(zone)) {
          map.set(zone, {
            id: zone,
            label: `Zone ${zone}`,
            type: 'zone',
            consumption: 0,
            peak: 0,
            count: 0,
            lastUpdate: now.toLocaleTimeString(),
            kwhDaily: 0,
            kwhWeekly: 0,
            kwhMonthly: 0,
            kwhYearly: 0,
            pf: 0,
            imbalance: 0,
            minutesSinceLast: 0,
            currentStatus: 'OK'
          });
        }
        const stats = map.get(zone)!;
        stats.consumption += Number(eq.consumption_kw) || 0;
        stats.kwhDaily += Number(eq.kwh_today) || 0;
        stats.kwhWeekly += Number(eq.kwh_week) || 0;
        stats.kwhMonthly += Number(eq.kwh_month) || 0;
        stats.kwhYearly += Number(eq.kwh_year) || 0;
        stats.count += 1;
      });
      return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
    }
    else { // device
      return equipmentList.map(eq => ({
        id: eq.id,
        label: eq.name,
        type: 'device' as const,
        consumption: Number(eq.consumption_kw) || 0,
        peak: 0,
        count: 1,
        lastUpdate: eq.reading_time ? new Date(eq.reading_time).toLocaleTimeString(i18n.language === 'ar' ? 'ar-MA' : i18n.language === 'en' ? 'en-GB' : 'fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-',
        kwhDaily: Number(eq.kwh_today) || 0,
        kwhWeekly: Number(eq.kwh_week) || 0,
        kwhMonthly: Number(eq.kwh_month) || 0,
        kwhYearly: Number(eq.kwh_year) || 0,
        pf: Number(eq.pf) || 0,
        imbalance: calculateImbalance(eq.voltage_a, eq.voltage_b, eq.voltage_c),
        minutesSinceLast: Number(eq.minutes_since_last) || 0,
        currentStatus: eq.current_status || 'OK',
        deviceCode: eq.device,
        channel: eq.channel,
        cable: eq.cable
      }));
    }
  }, [equipmentList, viewMode]);

  const totalConsumption = equipmentList.reduce((acc, eq) => acc + (Number(eq.consumption_kw) || 0), 0);

  const activeAlerts = equipmentList.filter(eq => {
    const status = eq.current_status || 'OK';
    return status === 'CRITIQUE' || status === 'A_SURVEILLER';
  }).length;

  const uniqueFloors = new Set(equipmentList.map(eq => eq.floor_id)).size;
  const averagePerFloor = uniqueFloors > 0 ? totalConsumption / uniqueFloors : 0;

  const getStatusDetails = (status: string) => {
    switch (status) {
      case 'CRITIQUE':
        return {
          color: 'text-red-700 dark:text-red-100',
          bg: 'bg-red-100 dark:bg-red-900/40',
          border: 'border-red-200 dark:border-red-800',
          cardBg: 'bg-red-50 dark:bg-red-900/20',
          label: 'CRITIQUE'
        };
      case 'A_SURVEILLER':
        return {
          color: 'text-amber-700 dark:text-amber-100',
          bg: 'bg-amber-100 dark:bg-amber-900/40',
          border: 'border-amber-200 dark:border-amber-800',
          cardBg: 'bg-amber-50 dark:bg-amber-900/20',
          label: 'ATTENTION'
        };
      default:
        return {
          color: 'text-emerald-700 dark:text-emerald-100',
          bg: 'bg-emerald-100 dark:bg-emerald-900/40',
          border: 'border-emerald-200 dark:border-emerald-800',
          cardBg: 'bg-white dark:bg-gray-800',
          label: 'NORMAL'
        };
    }
  };

  const getDynamicKwh = (item: EnergyStats) => {
    switch (selectedTimeframe) {
      case 'week': return item.kwhWeekly;
      case 'month': return item.kwhMonthly;
      case 'year': return item.kwhYearly;
      default: return item.kwhDaily;
    }
  };

  const getDynamicLabel = () => {
    switch (selectedTimeframe) {
      case 'week': return t('energy.kwhWeek');
      case 'month': return t('energy.kwhMonth');
      case 'year': return t('energy.kwhYear');
      default: return t('energy.kwhDay');
    }
  }

  return (
    <div className="space-y-6">
      {/* Overview stats - ISO Standardized Colors */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Consumption - Neutral Blue */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-blue-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('energy.totalConsumption')}</p>
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {totalConsumption.toFixed(2)} <span className="text-sm font-medium text-gray-400">kW</span>
              </p>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <Zap className="h-6 w-6 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Device Count - Neutral Purple */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('energy.connectedDevices')}</p>
              <p className="text-3xl font-bold text-gray-700 dark:text-gray-300 mt-1">
                {equipmentList.length}
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <Lightbulb className="h-6 w-6 text-gray-500 dark:text-gray-400" />
            </div>
          </div>
        </div>

        {/* Alerts - Safety Red/Emerald */}
        <div
          onClick={() => activeAlerts > 0 && setAlertModalOpen(true)}
          className={`rounded-xl shadow-sm p-4 border transition-all ${activeAlerts > 0 ? 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800 cursor-pointer hover:shadow-md' : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800'}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${activeAlerts > 0 ? 'text-red-600 dark:text-red-300' : 'text-emerald-600 dark:text-emerald-300'}`}>
                {t('energy.systemStatus')}
              </p>
              <p className={`text-3xl font-bold mt-1 ${activeAlerts > 0 ? 'text-red-700 dark:text-red-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                {activeAlerts > 0 ? `${activeAlerts} ${t('energy.alerts')}` : t('energy.normal')}
              </p>
            </div>
            <div className={`p-3 rounded-lg ${activeAlerts > 0 ? 'bg-red-100 dark:bg-red-800' : 'bg-emerald-100 dark:bg-emerald-800'}`}>
              <AlertTriangle className={`h-6 w-6 ${activeAlerts > 0 ? 'text-red-600 dark:text-red-100' : 'text-emerald-600 dark:text-emerald-100'}`} />
            </div>
          </div>
        </div>

        {/* Average - Neutral/Info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{t('energy.avgPerFloor')}</p>
              <p className="text-3xl font-bold text-gray-700 dark:text-gray-300 mt-1">
                {averagePerFloor.toFixed(1)} <span className="text-sm font-medium text-gray-400">kW</span>
              </p>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <BarChart3 className="h-6 w-6 text-gray-500 dark:text-gray-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode('floor')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'floor'
              ? 'bg-[#0096D6] text-white shadow-md'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
          >
            <div className="flex items-center space-x-2">
              <Building className="h-4 w-4" />
              <span>{t('energy.byFloor')}</span>
            </div>
          </button>
          <button
            onClick={() => setViewMode('zone')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'zone'
              ? 'bg-[#0096D6] text-white shadow-md'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
          >
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4" />
              <span>{t('energy.byZone')}</span>
            </div>
          </button>
          <button
            onClick={() => setViewMode('device')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === 'device'
              ? 'bg-[#0096D6] text-white shadow-md'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
          >
            <div className="flex items-center space-x-2">
              <Monitor className="h-4 w-4" />
              <span>{t('energy.byDevice')}</span>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
            {[
              { id: 'today', label: t('energy.day') },
              { id: 'week', label: t('energy.week') },
              { id: 'month', label: t('energy.month') },
              { id: 'year', label: t('energy.year') }
            ].map((period) => (
              <button
                key={period.id}
                onClick={() => setSelectedTimeframe(period.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${selectedTimeframe === period.id
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900'
                  }`}
              >
                {period.label}
              </button>
            ))}
          </div>

          <button
            onClick={handleDownloadReport}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            <FileText className="h-4 w-4" />
            <span>{t('energy.pdfReport')}</span>
          </button>
        </div>
      </div>

      {/* Main Grid - Zero Cognitive Load */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {displayData.map((item) => {
          const statusInfo = getStatusDetails(item.currentStatus);

          if (viewMode === 'device') {
            return (
              <div
                key={item.id}
                onClick={() => {
                  setSelectedItemForConsumption(item);
                  setRangeHistory([]);
                  setRangeError(null);
                  setConsumptionModalOpen(true);
                }}
                className={`relative overflow-hidden rounded-xl shadow-sm border transition-all duration-200 hover:shadow-md cursor-pointer ${statusInfo.cardBg} ${statusInfo.border}`}
              >
                {/* Status Stripe */}
                <div className={`absolute top-0 left-0 w-1.5 h-full ${statusInfo.bg.replace('bg-', 'bg-').replace('/40', '')} opacity-100`}></div>

                <div className="p-5 pl-7">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="overflow-hidden">
                      <h3 className="font-bold text-gray-900 dark:text-white text-lg truncate" title={item.label}>
                        {item.label}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-sm ${statusInfo.bg} ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {item.id}
                        </span>
                      </div>
                    </div>
                    {item.currentStatus === 'CRITIQUE' ? (
                      <AlertTriangle className="h-6 w-6 text-red-500 animate-pulse" />
                    ) : item.currentStatus === 'A_SURVEILLER' ? (
                      <AlertTriangle className="h-6 w-6 text-amber-500" />
                    ) : (
                      <Zap className="h-6 w-6 text-emerald-500/50" />
                    )}
                  </div>

                  {/* Main Value - HUGE for readability */}
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                      {item.consumption.toFixed(2)}
                    </span>
                    <span className="text-sm font-medium text-gray-500 uppercase">kW</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{t('energy.instantPower')}</p>

                  {/* Secondary Metrics */}
                  <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700/50">
                    <div>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {getDynamicKwh(item).toFixed(1)}
                      </p>
                      <p className="text-[10px] uppercase text-gray-500 tracking-wide">{getDynamicLabel()}</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {item.imbalance.toFixed(1)}%
                      </p>
                      <p className="text-[10px] uppercase text-gray-500 tracking-wide">{t('energy.powerFactor')}</p>
                    </div>
                  </div>
                </div>

                {/* Footer - Traceability */}
                <div className="bg-gray-50/50 dark:bg-gray-800/50 px-5 py-2 flex justify-between items-center text-[10px] text-gray-400 border-t border-gray-100 dark:border-gray-700/50 pl-7">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{t('ambulances.lastUpdate')}: {item.lastUpdate}</span>
                  </div>
                  <div>
                    ID: {item.deviceCode || 'N/A'}
                  </div>
                </div>
              </div>
            );
          }

          // Floor/Zone View
          return (
            <div
              key={item.id}
              onClick={() => {
                setSelectedItemForConsumption(item);
                setRangeHistory([]);
                setRangeError(null);
                setConsumptionModalOpen(true);
              }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-3 rounded-lg ${viewMode === 'floor' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' : 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400'}`}>
                  {viewMode === 'floor' ? <Building className="h-6 w-6" /> : <MapPin className="h-6 w-6" />}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">{item.label}</h3>
                  <p className="text-sm text-gray-500">{item.count} {t('energy.devices')}</p>
                </div>
              </div>

              <div className="mb-4">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                  {item.consumption.toFixed(2)}
                </span>
                <span className="text-sm text-gray-500 ml-1">kW</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm pt-4 border-t border-gray-100 dark:border-gray-700">
                <div>
                  <span className="block text-gray-500 text-xs">{t('energy.consumption')} {selectedTimeframe}</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{getDynamicKwh(item).toFixed(1)} kWh</span>
                </div>
                <div>
                  <span className="block text-gray-500 text-xs">{t('energy.globalStatus')}</span>
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Normal
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Evolution Chart - Keeping it clean but standardizing */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            {t('energy.consumptionEvolution')}
          </h3>
          <div className="text-sm text-gray-500">
            {selectedTimeframe === 'today' ? t('energy.today') :
              selectedTimeframe === 'week' ? t('energy.thisWeek') :
                selectedTimeframe === 'month' ? t('energy.thisMonth') : t('energy.thisYear')}
          </div>
        </div>

        <div className="h-[400px] w-full min-h-[400px]">
          <TimeseriesChart
            data={historyData}
            dataKey="total_kw"
            unit="kW"
            height={400}
            timeframe={selectedTimeframe}
          />
        </div>
      </div>

      {/* ALERT DETAILS MODAL */}
      {alertModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center justify-between p-6 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/30">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {t('energy.devicesInAlert')} ({alertDevices.length})
                  </h3>
                  <p className="text-sm text-red-600/80 dark:text-red-400/80">{t('energy.devicesNeedAttention')}</p>
                </div>
              </div>
              <button
                onClick={() => setAlertModalOpen(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-white/50 dark:hover:text-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <Clock className="h-6 w-6 rotate-45" /> {/* Use Clock rotated for X if no X icon imported yet or just import it */}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700">
              {alertDevices.length === 0 ? (
                <div className="text-center py-12">
                  <Zap className="h-12 w-12 text-emerald-500 mx-auto opacity-20 mb-3" />
                  <p className="text-gray-500">{t('energy.noActiveAlerts')}</p>
                </div>
              ) : (
                alertDevices.map((eq) => {
                  const statusInfo = getStatusDetails(eq.current_status || 'OK');
                  return (
                    <div
                      key={eq.id}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all ${statusInfo.border} ${statusInfo.cardBg}`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-gray-900 dark:text-white">{eq.name}</h4>
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${statusInfo.bg} ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-red-700 dark:text-red-300 mt-1">
                          {t('energy.nature')}: {getAlertNature(eq)}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {t('common.floor')} {eq.floor_id}</span>
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {t('ambulances.lastUpdate')}: {eq.reading_time ? new Date(eq.reading_time).toLocaleTimeString() : 'N/A'}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{(Number(eq.consumption_kw) || 0).toFixed(2)} kW</p>
                        <p className="text-[10px] uppercase text-gray-400">{t('energy.instantaneous')}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setAlertModalOpen(false)}
                className="px-6 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-bold hover:bg-gray-800 dark:hover:bg-white transition-colors"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* CONSUMPTION RANGE MODAL */}
      {consumptionModalOpen && selectedItemForConsumption && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Zap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {t('energy.consumptionInfo')} - {selectedItemForConsumption.label}
                </h3>
              </div>
              <button
                onClick={() => setConsumptionModalOpen(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row md:items-end gap-6">
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{selectedItemForConsumption.type === 'device' ? t('energy.device') : selectedItemForConsumption.type === 'floor' ? t('common.floor') : t('energy.zone')}</p>
                  <p className="text-2xl font-black text-gray-900 dark:text-white">{selectedItemForConsumption.label}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 flex-1">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('reporting.startDate')}</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">{t('reporting.endDate')}</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={fetchDetailedReport}
                  disabled={rangeLoading}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {rangeLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <BarChart3 className="h-5 w-5" />}
                  {t('common.calculate')}
                </button>
              </div>

              {rangeError && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                  {rangeError}
                </div>
              )}

              {rangeHistory.length > 0 && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <EnergyReportingSection
                    history={rangeHistory}
                    title={`${t('energy.consumptionInfo')} : ${selectedItemForConsumption.label}`}
                    subtitle={`Analyse détaillée pour la période du ${startDate} au ${endDate}`}
                  />
                </div>
              )}

              {rangeLoading && (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
                  <p className="text-gray-500 font-medium animate-pulse">{t('common.loading')}</p>
                </div>
              )}

              {!rangeLoading && rangeHistory.length === 0 && !rangeError && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <BarChart3 className="h-16 w-16 mb-4 opacity-20" />
                  <p className="max-w-xs text-center">{startDate && endDate ? (t('common.noData') || 'Aucune donnée pour cette période') : t('reporting.selectRangeToStart')}</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-700 flex justify-end">
              <button
                onClick={() => setConsumptionModalOpen(false)}
                className="px-8 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-xl text-sm font-bold hover:bg-gray-800 dark:hover:bg-white transition-all active:scale-95"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}