
import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Activity,
  Clock,
  Droplets,
  RefreshCw,
  Filter
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

//--- Types ---
interface OxygenPoint {
  id: string;
  name: string;
  location: string;
  floor_id: number;
  floor_name: string; // From join
  zone: string;
  point_type: string;
  mac: string;

  // Specs
  max_pressure_bar: string | number; // JSON returns string for numeric

  // Live Data (nullable)
  pressure_bar: string | number | null;
  flow_lpm: string | number | null;
  purity_percent: string | number | null;
  temperature_celsius: string | number | null;
  leak_detected: boolean | null;
  current_status: boolean | null; // boolean in DB? or string? Schema said boolean status in reading?
  // Let's check reading schema: status boolean.
  reading_time: string | null;
}

export default function OxyFlow() {
  const { t } = useTranslation();
  const [points, setPoints] = useState<OxygenPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  //--- Filters State ---
  const [selectedFloor, setSelectedFloor] = useState<string>('all');
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showIssuesOnly, setShowIssuesOnly] = useState(false);

  //--- Fetch Data ---
  const fetchData = async () => {
    setLoading(true);
    try {
      // Use stored token or fallback to a mock token for dev if enabled in backend
      const token = localStorage.getItem('token') || 'mock-token-dev';

      const res = await fetch('/api/oxygen', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        let msg = `Error ${res.status}: ${res.statusText}`;
        try {
          const errJson = await res.json();
          if (errJson.message) msg = errJson.message;
        } catch (e) { }
        throw new Error(msg);
      }

      const json = await res.json();

      if (json.success && Array.isArray(json.data)) {
        setPoints(json.data);
        setError(null);
      } else {
        throw new Error('Invalid data format received');
      }
    } catch (err: any) {
      setError(err.message || 'Unknown error');
    } finally {
      setLoading(false);
      setLastRefreshed(new Date());
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  //--- Computed Filters ---
  const uniqueFloors = useMemo(() => Array.from(new Set(points.map(p => p.floor_name || p.floor_id?.toString() || 'Unknown'))).sort(), [points]);
  const uniqueZones = useMemo(() => Array.from(new Set(points.map(p => p.zone).filter(Boolean))).sort(), [points]);
  const uniqueTypes = useMemo(() => Array.from(new Set(points.map(p => p.point_type).filter(Boolean))).sort(), [points]);



  //--- UI Helpers ---
  const getStatusInfo = (p: OxygenPoint) => {
    if (p.leak_detected) {
      return { label: t('oxygen.status.leakDetected'), color: 'text-red-800', bg: 'bg-red-100 border-red-200', icon: Droplets, priority: 0 };
    }
    if (p.current_status === true) { // ON -> OUVERT (Active/Good)
      return { label: t('oxygen.status.open'), color: 'text-white', bg: 'bg-green-500 border-green-600', icon: CheckCircle, priority: 1 };
    }
    if (p.current_status === false) { // OFF -> FERMÉ (Inactive)
      return { label: t('oxygen.status.closed'), color: 'text-gray-800', bg: 'bg-gray-100 border-gray-200', icon: CheckCircle, priority: 3 };
    }
    // Null / No Data
    return { label: t('oxygen.status.inactive'), color: 'text-gray-600', bg: 'bg-gray-100 border-gray-200', icon: Clock, priority: 2 };
  };

  const filteredPoints = useMemo(() => {
    let result = points.filter(p => {
      if (selectedFloor !== 'all' && (p.floor_name !== selectedFloor && p.floor_id?.toString() !== selectedFloor)) return false;
      if (selectedZone !== 'all' && p.zone !== selectedZone) return false;
      if (selectedType !== 'all' && p.point_type !== selectedType) return false;

      if (showIssuesOnly) {
        // Show ON (true) [OUVERT - Problematic] or Inactive (null) or Leak
        return p.current_status === true || p.current_status === null || p.leak_detected === true;
      }
      return true;
    });

    // Sorting: OFF -> INACTIVE -> ON (by priority asc)
    result.sort((a, b) => {
      const statA = getStatusInfo(a).priority;
      const statB = getStatusInfo(b).priority;
      if (statA !== statB) return statA - statB;
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [points, selectedFloor, selectedZone, selectedType, showIssuesOnly, t]);

  const [backendStats, setBackendStats] = useState<{ totalDurationMs: number } | null>(null);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token') || 'mock-token-dev';
      const res = await fetch('/api/oxygen/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setBackendStats(json.data);
        }
      }
    } catch (err) {
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000); // Poll stats every minute
    return () => clearInterval(interval);
  }, []);

  //--- Stats Calculation (Local for Open Count, Backend for Duration) ---
  const stats = useMemo(() => {
    const openCount = points.filter(p => p.current_status === true).length;
    // Use backend stats for duration, or 0 if not loaded yet
    const totalDurationMs = backendStats ? backendStats.totalDurationMs : 0;

    return { openCount, totalDurationMs };
  }, [points, backendStats]);

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  //--- Render ---
  return (
    <div className="space-y-6 p-4">
      {/* Header & Controls */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Activity className="text-blue-500" />
              {t('oxygen.title')}
            </h1>
            <p className="text-sm text-gray-500">
              {points.length} {t('oxygen.points')} • {t('common.lastUpdate')}: {lastRefreshed.toLocaleTimeString()}
            </p>
          </div>
          <button onClick={fetchData} className="p-2 hover:bg-gray-100 rounded-full transition-colors dark:hover:bg-gray-700">
            <RefreshCw className={`w-5 h-5 text-gray-600 dark:text-gray-300 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </header>

        {/* --- DASHBOARD STATS --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase text-red-600 dark:text-red-400 font-bold tracking-wider">{t('oxygen.valvesOpen')}</p>
              <p className="text-3xl font-bold text-red-700 dark:text-red-300 mt-1">{stats.openCount}</p>
            </div>
            <div className="bg-red-100 dark:bg-red-800 p-3 rounded-full text-red-600 dark:text-red-200">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase text-blue-600 dark:text-blue-400 font-bold tracking-wider">{t('oxygen.cumulativeDurationActive')}</p>
              <p className="text-3xl font-bold text-blue-700 dark:text-blue-300 mt-1">{formatDuration(stats.totalDurationMs)}</p>
            </div>
            <div className="bg-blue-100 dark:bg-blue-800 p-3 rounded-full text-blue-600 dark:text-blue-200">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </div>


        {/* Filters Bar */}
        <div className="flex flex-wrap items-end gap-4 border-t border-gray-100 dark:border-gray-700 pt-4">
          {/* Filters (Floor, Zone, Type) */}
          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{t('common.floor')}</label>
            <select
              className="px-3 py-2 rounded-lg border bg-gray-50 dark:bg-gray-700 text-sm"
              value={selectedFloor}
              onChange={e => setSelectedFloor(e.target.value)}
            >
              <option value="all">{t('common.allFloors')}</option>
              {uniqueFloors.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{t('common.zone')}</label>
            <select
              className="px-3 py-2 rounded-lg border bg-gray-50 dark:bg-gray-700 text-sm"
              value={selectedZone}
              onChange={e => setSelectedZone(e.target.value)}
            >
              <option value="all">{t('common.allZones')}</option>
              {uniqueZones.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{t('common.type')}</label>
            <select
              className="px-3 py-2 rounded-lg border bg-gray-50 dark:bg-gray-700 text-sm"
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
            >
              <option value="all">{t('common.allTypes')}</option>
              {uniqueTypes.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* Issues Toggle */}
          <div className="flex items-center gap-2 pb-2">
            <input
              type="checkbox"
              id="issues"
              checked={showIssuesOnly}
              onChange={e => setShowIssuesOnly(e.target.checked)}
              className="w-4 h-4 text-red-600 rounded focus:ring-red-500 border-gray-300"
            />
            <label htmlFor="issues" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">
              {t('oxygen.alertsOnly')}
            </label>
          </div>

          <div className="ml-auto text-sm text-gray-500">
            {filteredPoints.length} {t('common.results', { count: filteredPoints.length })}
          </div>
        </div>
      </div>

      {loading && points.length === 0 && (
        <div className="text-center py-10">{t('common.loadingData')}</div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* NEW CARD DESIGN Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredPoints.map(point => {
          const status = getStatusInfo(point);

          return (
            <div key={point.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full">

              {/* Header: Name + Large Badge */}
              <div className="p-4 flex flex-col gap-3 border-b border-gray-100 dark:border-gray-700">
                <div className="flex justify-between items-start">
                  {/* Reduced title size from text-base to text-sm */}
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wide">{point.name}</h3>
                </div>

                <div className={`py-1 px-3 rounded-lg flex items-center justify-center gap-2 font-bold text-xs border ${status.bg} ${status.color}`}>
                  <status.icon className="w-3 h-3" />
                  {status.label}
                </div>
              </div>

              {/* Body: Grid Info */}
              <div className="p-4 flex flex-col gap-3 flex-grow">
                <div className="flex items-center justify-between gap-2 border-b border-gray-50 dark:border-gray-700 pb-2">
                  <span className="text-xs uppercase text-gray-400 font-semibold">{t('common.zone')}</span>
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate max-w-[150px] text-right" title={point.zone}>
                    {point.zone}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs uppercase text-gray-400 font-semibold">{t('common.floor')}</span>
                  <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    {point.floor_name || point.floor_id}
                  </div>
                </div>
              </div>

              {/* Footer: Timestamp */}
              <div className="bg-gray-50 dark:bg-gray-750 p-3 flex items-center justify-center text-xs text-gray-500 border-t border-gray-100 dark:border-gray-700 gap-1">
                <Clock className="w-3 h-3" />
                {point.reading_time ? (
                  /* Removed "Mis à jour:" text */
                  <span>{new Date(point.reading_time).toLocaleTimeString()}</span>
                ) : (
                  <span>{t('common.noRecentData')}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {!loading && filteredPoints.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400">
          <Filter className="w-12 h-12 mb-2 opacity-20" />
          <p>Aucun point ne correspond aux critères de recherche.</p>
        </div>
      )}
    </div>
  );
}