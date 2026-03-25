import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Activity, AlertTriangle, Droplet, Gauge, Filter, Search, LayoutGrid, Clock, X, Calendar } from 'lucide-react';
import { 
    AreaChart, 
    Area, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip as RechartsTooltip, 
    ResponsiveContainer
} from 'recharts';

// Interfaces
interface FilterState {
    floor: string;
    zone: string;
    search: string;
    status: string;
}

interface TankReading {
    pressure1: number;
    stat1: boolean;
    pressure2: number;
    stat2: boolean;
    reading_time: string;
}

interface OxygenTank {
    id: string;
    mac: string;
    name: string;
    location: string;
    last_seen: string;
    pression_max?: number;
    latest_reading?: TankReading;
}

interface OxygenPoint {
    id: string;
    name: string;
    location: string;
    floor_id: number;
    floor_name: string;
    zone: string;
    point_type: string;
    current_status: boolean;
    leak_detected?: boolean;
    pressure_bar?: number;
    flow_lpm?: number;
    reading_time?: string;
    has_patient?: boolean;
}

interface Floor {
    id: number;
    name: string;
}

import OxygenTankCard from '../components/OxygenTankCard';

export default function OxygenPage() {
    const { t } = useTranslation();

    // Core State
    const [tanks, setTanks] = useState<OxygenTank[]>([]);
    const [points, setPoints] = useState<OxygenPoint[]>([]);
    const [floors, setFloors] = useState<Floor[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(new Date());

    const [filters, setFilters] = useState<FilterState>({
        floor: 'all',
        zone: 'all',
        search: '',
        status: 'all'
    });

    // History Modal State
    const [selectedPoint, setSelectedPoint] = useState<OxygenPoint | null>(null);
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [dateRange, setDateRange] = useState({
        start: new Date(new Date().setHours(0, 0, 0, 0)).toISOString().slice(0, 16),
        end: new Date(new Date().setHours(23, 0, 0, 0)).toISOString().slice(0, 16)
    });
    // Tank History Modal State
    const [selectedTank, setSelectedTank] = useState<OxygenTank | null>(null);
    const [tankHistoryData, setTankHistoryData] = useState<any[]>([]);
    const [tankHistoryLoading, setTankHistoryLoading] = useState(false);
    const [tankDateRange, setTankDateRange] = useState({
        start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
        end: new Date().toISOString().slice(0, 16)
    });

    // Effects
    useEffect(() => {
        fetchAllData();
        const interval = setInterval(fetchAllData, 30000); // 30s Poll
        return () => clearInterval(interval);
    }, []);

    // Fetch logic
    const fetchAllData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('clinicToken');
            const headers = { Authorization: `Bearer ${token}` };

            const [tanksRes, pointsRes, floorsRes] = await Promise.all([
                fetch('/api/oxygen-tanks', { headers }),
                fetch('/api/oxygen', { headers }),
                fetch('/api/floors', { headers })
            ]);

            const tanksData = await tanksRes.json();
            const pointsData = await pointsRes.json();
            const floorsData = await floorsRes.json();

            if (Array.isArray(tanksData)) setTanks(tanksData);
            if (pointsData.success) setPoints(pointsData.data);
            if (floorsData.success) setFloors(floorsData.data);

            setLastUpdate(new Date());
        } catch {
            // Ignore errors
        } finally {
            setLoading(false);
        }
    };

    const fetchHistory = async (pointId: string, start: string, end: string) => {
        setHistoryLoading(true);
        try {
            const token = localStorage.getItem('clinicToken');
            const res = await fetch(`/api/oxygen/${pointId}/history?start=${start}&end=${end}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const json = await res.json();
            if (json.success) setHistoryData(json.data);
        } catch (err) {
            console.error(err);
        } finally {
            setHistoryLoading(false);
        }
    };

    const fetchTankHistory = async (tankId: string, start: string, end: string) => {
        setTankHistoryLoading(true);
        try {
            const token = localStorage.getItem('clinicToken');
            const res = await fetch(`/api/oxygen-tanks/${tankId}/history?start=${start}&end=${end}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const json = await res.json();
            if (json.success) {
                // Determine circuit to use
                const isCircuit2 = selectedTank?.name.toLowerCase().includes('secondaire') || selectedTank?.name.includes(' 2');
                const processed = json.data.map((d: any) => ({
                    time: d.reading_time,
                    pressure: Number(isCircuit2 ? d.pressure2 : d.pressure1)
                }));
                setTankHistoryData(processed);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setTankHistoryLoading(false);
        }
    };

    const zones = Array.from(new Set(points.map(p => p.zone).filter(Boolean))).sort();

    const filteredPoints = points.filter(point => {
        if (filters.floor !== 'all' && point.floor_id?.toString() !== filters.floor) return false;
        if (filters.zone !== 'all' && point.zone !== filters.zone) return false;
        if (filters.status === 'open' && !point.current_status) return false;
        if (filters.status === 'closed' && point.current_status) return false;
        if (filters.search && !point.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
        return true;
    });

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.round(seconds % 60);
        return `${h}h ${m}m ${s}s`;
    };

    const totalSeconds = historyData.reduce((acc, curr) => acc + curr.totalSeconds, 0);

    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900 p-4 sm:p-6 space-y-8 font-sans text-gray-900 dark:text-gray-100">

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white flex items-center gap-3 uppercase tracking-tight">
                        <Activity className="text-emerald-600 w-8 h-8" />
                        {t('oxygen.centralizedTitle')}
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm font-medium">{t('oxygen.centralizedSubtitle')}</p>
                </div>
                <div className="flex items-center gap-3 sm:gap-4 bg-white dark:bg-gray-800 px-4 py-2 rounded-full shadow-sm border border-gray-100 dark:border-gray-700">
                    <span className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-emerald-600 uppercase tracking-widest whitespace-nowrap">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        {t('oxygen.liveConnect')}
                    </span>
                    <span className="text-gray-300">|</span>
                    <span className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase whitespace-nowrap">{t('oxygen.update')}: {lastUpdate.toLocaleTimeString()}</span>
                </div>
            </div>

            {/* SECTION 1: TANKS */}
            <section>
                <div className="flex items-center gap-2 mb-4 text-gray-700 dark:text-gray-300 font-black uppercase tracking-widest text-[10px] sm:text-xs">
                    <Gauge className="w-4 h-4" />
                    <h2>{t('oxygen.mainTanks')}</h2>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {tanks.length === 0 && !loading && [1, 2].map(i => (
                        <div key={i} className="h-48 bg-gray-100 dark:bg-gray-800 rounded-3xl animate-pulse"></div>
                    ))}
                    {tanks.map(tank => (
                        <OxygenTankCard 
                            key={tank.id} 
                            tank={tank} 
                            onClick={() => {
                                setSelectedTank(tank);
                                setTankHistoryData([]);
                                fetchTankHistory(tank.id, tankDateRange.start, tankDateRange.end);
                            }}
                        />
                    ))}
                </div>
            </section>

            {/* SECTION 2: FILTERS & VALVES */}
            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-gray-900 dark:text-gray-100 font-black uppercase tracking-widest text-[10px] sm:text-xs">
                        <LayoutGrid className="w-4 h-4" />
                        <h2>{t('oxygen.distributionValves')}</h2>
                        <span className="bg-emerald-600 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black">{filteredPoints.length}</span>
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="bg-white dark:bg-gray-800 p-2 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-wrap gap-2 items-center">
                    <div className="hidden sm:flex items-center px-3 gap-2 text-gray-400 border-e border-gray-100 dark:border-gray-700 me-2">
                        <Filter className="w-4 h-4" />
                    </div>

                    <select
                        value={filters.floor}
                        onChange={e => setFilters({ ...filters, floor: e.target.value, zone: 'all' })}
                        className="flex-1 sm:flex-none bg-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50 text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 px-3 py-2 rounded-xl outline-none cursor-pointer transition-all tracking-widest"
                    >
                        <option value="all">{t('oxygen.allFloors')}</option>
                        {floors.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>

                    <select
                        value={filters.zone}
                        onChange={e => setFilters({ ...filters, zone: e.target.value })}
                        className="flex-1 sm:flex-none bg-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50 text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 px-3 py-2 rounded-xl outline-none cursor-pointer transition-all tracking-widest"
                    >
                        <option value="all">{t('oxygen.allZones')}</option>
                        {zones.map(z => <option key={z} value={z}>{z}</option>)}
                    </select>

                    <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl overflow-x-auto max-w-full">
                        <button
                            onClick={() => setFilters({ ...filters, status: 'all' })}
                            className={`px-3 sm:px-4 py-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${filters.status === 'all' ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'}`}
                        >
                            {t('oxygen.allStatus')}
                        </button>
                        <button
                            onClick={() => setFilters({ ...filters, status: 'open' })}
                            className={`px-3 sm:px-4 py-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${filters.status === 'open' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 hover:text-emerald-600'}`}
                        >
                            {t('oxygen.open')}
                        </button>
                        <button
                            onClick={() => setFilters({ ...filters, status: 'closed' })}
                            className={`px-3 sm:px-4 py-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${filters.status === 'closed' ? 'bg-red-600 text-white shadow-sm' : 'text-gray-500 hover:text-red-600'}`}
                        >
                            {t('oxygen.closed')}
                        </button>
                    </div>

                    <div className="ms-auto flex items-center bg-gray-50 dark:bg-gray-900/50 rounded-xl px-4 py-2 w-full md:w-64 border border-transparent focus-within:border-emerald-500 transition-all mt-2 sm:mt-0">
                        <Search className="w-4 h-4 text-gray-400 me-2 flex-shrink-0" />
                        <input
                            type="text"
                            placeholder={t('oxygen.searchValve')}
                            value={filters.search}
                            onChange={e => setFilters({ ...filters, search: e.target.value })}
                            className="bg-transparent border-none outline-none text-[10px] font-bold w-full placeholder-gray-400 text-gray-700 dark:text-gray-200"
                        />
                    </div>
                </div>

                {/* Valve Grid */}
                <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-6">
                    {filteredPoints.map(point => (
                        <div
                            key={point.id}
                            onClick={() => {
                                setSelectedPoint(point);
                                setHistoryData([]);
                                fetchHistory(point.id, dateRange.start, dateRange.end);
                            }}
                            className={`
                                group relative rounded-3xl p-4 sm:p-6 border-2 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl cursor-pointer flex flex-col justify-between h-full bg-white dark:bg-gray-800
                                ${!point.current_status
                                    ? 'border-gray-100 dark:border-gray-700 bg-gray-50/30'
                                    : point.has_patient
                                        ? 'border-emerald-50 dark:border-emerald-900/30'
                                        : 'border-red-50 dark:border-red-900/30 bg-red-50/30 dark:bg-red-900/10'}
                            `}
                        >
                            <div className="flex justify-between items-center mb-6">
                                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                                    {t('common.floor')} {point.floor_name}
                                </span>
                                {point.leak_detected && (
                                    <div className="bg-red-500 text-white p-1.5 rounded-lg animate-bounce">
                                        <AlertTriangle className="w-3 h-3" />
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col items-center text-center space-y-4 mb-4">
                                <div className={`
                                    w-16 h-16 sm:w-20 sm:h-20 rounded-[1.5rem] sm:rounded-[2rem] flex items-center justify-center mb-1 sm:mb-2 shadow-inner transition-transform group-hover:scale-110
                                    ${!point.current_status
                                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                                        : point.has_patient
                                            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600'
                                            : 'bg-red-100 dark:bg-red-900/50 text-red-600 animate-pulse'}`}>
                                    {!point.current_status
                                        ? <Droplet className="w-8 h-8 sm:w-10 sm:h-10 opacity-30" strokeWidth={2.5} />
                                        : point.has_patient
                                            ? <Droplet className="w-8 h-8 sm:w-10 sm:h-10" strokeWidth={2.5} />
                                            : <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10" strokeWidth={2.5} />
                                    }
                                </div>

                                <h3 className="font-black text-gray-900 dark:text-white text-base sm:text-lg uppercase tracking-tighter">
                                    {point.name}
                                </h3>

                                <div className={`
                                    px-4 py-1.5 sm:px-5 sm:py-2 rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest border-2
                                    ${!point.current_status
                                        ? 'bg-gray-100 text-gray-500 border-gray-200 dark:bg-gray-700 dark:border-gray-600'
                                        : point.has_patient
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/40 dark:border-emerald-800'
                                            : 'bg-red-600 text-white border-red-700 shadow-lg shadow-red-200'}
                                `}>
                                    {point.current_status ? t('oxygen.open') : t('oxygen.closed')}
                                </div>
                            </div>

                            <div className="mt-auto w-full">


                                <div className="flex items-center justify-center text-[9px] sm:text-[10px] text-gray-400 font-black uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50 py-2 rounded-xl border border-gray-100 dark:border-gray-800">
                                    <Clock className="w-3 h-3 me-2 opacity-70" />
                                    <span>{point.reading_time ? new Date(point.reading_time).toLocaleTimeString() : '--:--'}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* History Modal */}
            {selectedPoint && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-md transition-all overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-2xl my-auto overflow-hidden border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in slide-in-from-bottom-8 duration-300 flex flex-col max-h-[95vh]">
                        {/* Header Modal */}
                        <div className="px-6 py-6 sm:px-10 sm:py-8 bg-emerald-600 text-white flex justify-between items-center relative overflow-hidden flex-shrink-0">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                            <div className="relative z-10 text-left">
                                <h2 className="text-xl sm:text-3xl font-black uppercase tracking-tighter flex items-center gap-3 sm:gap-4">
                                    <Clock className="w-6 h-6 sm:w-8 sm:h-8" />
                                    {selectedPoint.name}
                                </h2>
                                <p className="text-emerald-100 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] mt-1 sm:mt-2 opacity-80">Consultation des temps d'ouverture</p>
                            </div>
                            <button
                                onClick={() => setSelectedPoint(null)}
                                className="relative z-10 p-2 sm:p-3 hover:bg-emerald-500 rounded-2xl transition-all hover:rotate-90"
                            >
                                <X className="w-5 h-5 sm:w-6 sm:h-6" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 sm:p-10 space-y-6 sm:space-y-10 overflow-y-auto custom-scrollbar flex-grow">
                            {/* Date Selectors */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                                <div className="space-y-2 sm:space-y-3">
                                    <label className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Début de période</label>
                                    <input
                                        type="datetime-local"
                                        value={dateRange.start}
                                        onChange={e => {
                                            const newRange = { ...dateRange, start: e.target.value };
                                            setDateRange(newRange);
                                            fetchHistory(selectedPoint.id, newRange.start, newRange.end);
                                        }}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl px-4 py-3 sm:px-5 sm:py-4 text-[10px] sm:text-sm font-black text-gray-800 dark:text-gray-100 outline-none focus:border-emerald-500 transition-all shadow-inner"
                                    />
                                </div>
                                <div className="space-y-2 sm:space-y-3">
                                    <label className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Fin de période</label>
                                    <input
                                        type="datetime-local"
                                        value={dateRange.end}
                                        onChange={e => {
                                            const newRange = { ...dateRange, end: e.target.value };
                                            setDateRange(newRange);
                                            fetchHistory(selectedPoint.id, newRange.start, newRange.end);
                                        }}
                                        className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl px-4 py-3 sm:px-5 sm:py-4 text-[10px] sm:text-sm font-black text-gray-800 dark:text-gray-100 outline-none focus:border-emerald-500 transition-all shadow-inner"
                                    />
                                </div>
                            </div>

                            {/* Results Panel */}
                            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-8 border border-gray-100 dark:border-gray-800 shadow-inner">
                                {historyLoading ? (
                                    <div className="flex flex-col items-center justify-center py-10 sm:py-16 gap-4 sm:gap-6">
                                        <div className="w-12 h-12 sm:w-16 sm:h-16 border-[4px] sm:border-[6px] border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                                        <p className="text-[8px] sm:text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] font-sans">Extraction des données...</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-6 sm:mb-10 pb-6 sm:pb-8 border-b-2 border-dashed border-gray-200 dark:border-gray-700 gap-4">
                                            <div className="text-left">
                                                <h3 className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-[0.1em] sm:tracking-[0.2em] mb-1 sm:mb-2">Total Ouverture Cumulé</h3>
                                                <p className="text-3xl sm:text-5xl font-black text-emerald-600 tracking-tighter">
                                                    {formatDuration(totalSeconds)}
                                                </p>
                                            </div>
                                            <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-4 py-2 sm:px-6 sm:py-3 rounded-[1rem] sm:rounded-2xl text-[8px] sm:text-[10px] font-black uppercase tracking-widest border border-emerald-200 dark:border-emerald-800">
                                                {historyData.length} Jour(s) d'analyse
                                            </div>
                                        </div>

                                        <div className="space-y-3 sm:space-y-4 max-h-[250px] sm:max-h-[320px] overflow-y-auto pr-2 sm:pr-4 custom-scrollbar">
                                            {historyData.length === 0 ? (
                                                <div className="text-center py-8 sm:py-12 bg-white dark:bg-gray-800 rounded-[1.5rem] sm:rounded-3xl border-2 border-dashed border-gray-50 dark:border-gray-700">
                                                    <Activity className="w-10 h-10 sm:w-12 sm:h-12 text-gray-200 mx-auto mb-3 sm:mb-4" />
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Aucun événement d'ouverture</p>
                                                </div>
                                            ) : (
                                                historyData.map((row, i) => (
                                                    <div key={i} className="flex items-center justify-between p-4 sm:p-6 bg-white dark:bg-gray-800 rounded-2xl sm:rounded-3xl border border-gray-100 dark:border-gray-700 shadow-sm hover:border-emerald-400 transition-all group/item">
                                                        <div className="flex items-center gap-3 sm:gap-5">
                                                            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex flex-col items-center justify-center border border-emerald-50 dark:border-emerald-800 group-hover/item:bg-emerald-600 group-hover/item:text-white transition-colors">
                                                                <span className="text-sm sm:text-lg font-black leading-none">{new Date(row.day).getDate()}</span>
                                                                <span className="text-[7px] sm:text-[8px] font-black uppercase opacity-60">
                                                                    {new Date(row.day).toLocaleDateString(undefined, { month: 'short' })}
                                                                </span>
                                                            </div>
                                                            <div className="text-left">
                                                                <p className="text-xs sm:text-sm font-black text-gray-800 dark:text-gray-100 uppercase tracking-tight">
                                                                    {new Date(row.day).toLocaleDateString(undefined, { weekday: 'long' })}
                                                                </p>
                                                                <p className="text-[7px] sm:text-[9px] text-gray-400 font-black uppercase tracking-widest mt-0.5 sm:mt-1">Usage détecté</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-base sm:text-xl font-black text-gray-900 dark:text-white tracking-tighter group-hover/item:text-emerald-600 transition-colors">
                                                                {formatDuration(row.totalSeconds)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 sm:p-10 bg-gray-50/80 dark:bg-gray-900/80 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row justify-between items-center gap-4 flex-shrink-0">
                            <p className="text-[8px] sm:text-[9px] font-black text-gray-400 uppercase tracking-widest max-w-full sm:max-w-[200px] text-center sm:text-left">Données basées sur les impulsions capteur temps réel.</p>
                            <button
                                onClick={() => setSelectedPoint(null)}
                                className="w-full sm:w-auto px-8 sm:px-10 py-4 sm:py-5 bg-gray-900 dark:bg-emerald-600 text-white rounded-[1rem] sm:rounded-[1.25rem] text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-xl"
                            >
                                Fermer le rapport
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tank History Modal */}
            {selectedTank && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-md transition-all overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-5xl my-auto overflow-hidden border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in slide-in-from-bottom-8 duration-300 flex flex-col max-h-[95vh]">
                        {/* Header Modal */}
                        <div className="px-6 py-6 sm:px-10 sm:py-8 bg-blue-600 text-white flex justify-between items-center relative overflow-hidden flex-shrink-0">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                            <div className="relative z-10 text-left">
                                <h2 className="text-xl sm:text-3xl font-black uppercase tracking-tighter flex items-center gap-3 sm:gap-4">
                                    <Activity className="w-6 h-6 sm:w-8 sm:h-8" />
                                    {selectedTank.name}
                                </h2>
                                <p className="text-blue-100 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] mt-1 sm:mt-2 opacity-80">Historique des pressions (Bars)</p>
                            </div>
                            <button
                                onClick={() => setSelectedTank(null)}
                                className="relative z-10 p-2 sm:p-3 hover:bg-blue-500 rounded-2xl transition-all hover:rotate-90"
                            >
                                <X className="w-5 h-5 sm:w-6 sm:h-6" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 sm:p-10 space-y-6 sm:space-y-10 overflow-y-auto custom-scrollbar flex-grow">
                            {/* Date Selectors */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8">
                                <div className="space-y-2 sm:space-y-3">
                                    <label className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Début de période</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                        <input
                                            type="datetime-local"
                                            value={tankDateRange.start}
                                            onChange={e => {
                                                const newRange = { ...tankDateRange, start: e.target.value };
                                                setTankDateRange(newRange);
                                                if (selectedTank) fetchTankHistory(selectedTank.id, newRange.start, newRange.end);
                                            }}
                                            className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl pl-12 pr-5 py-3 sm:py-4 text-[10px] sm:text-sm font-black text-gray-800 dark:text-gray-100 outline-none focus:border-blue-500 transition-all shadow-inner"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2 sm:space-y-3">
                                    <label className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Fin de période</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                        <input
                                            type="datetime-local"
                                            value={tankDateRange.end}
                                            onChange={e => {
                                                const newRange = { ...tankDateRange, end: e.target.value };
                                                setTankDateRange(newRange);
                                                if (selectedTank) fetchTankHistory(selectedTank.id, newRange.start, newRange.end);
                                            }}
                                            className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-700 rounded-2xl pl-12 pr-5 py-3 sm:py-4 text-[10px] sm:text-sm font-black text-gray-800 dark:text-gray-100 outline-none focus:border-blue-500 transition-all shadow-inner"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Chart Panel */}
                            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-[1.5rem] sm:rounded-[2rem] p-6 sm:p-8 border border-gray-100 dark:border-gray-800 shadow-inner min-h-[400px]">
                                {tankHistoryLoading ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-6 h-full">
                                        <div className="w-16 h-16 border-[6px] border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">Extraction des données...</p>
                                    </div>
                                ) : tankHistoryData.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-30 h-full">
                                        <Activity className="w-16 h-16" />
                                        <p className="text-xs font-black uppercase tracking-widest">Aucune donnée sur cette période</p>
                                    </div>
                                ) : (
                                    <div className="h-[350px] w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={tankHistoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                <defs>
                                                    <linearGradient id="colorPressure" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                                                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                <XAxis 
                                                    dataKey="time" 
                                                    tick={false}
                                                    axisLine={false}
                                                />
                                                <YAxis 
                                                    stroke="#9CA3AF" 
                                                    fontSize={10} 
                                                    fontWeight="bold"
                                                    tickLine={false} 
                                                    axisLine={false}
                                                    domain={[0, 'auto']}
                                                />
                                                <RechartsTooltip 
                                                    contentStyle={{ backgroundColor: '#fff', border: 'none', borderRadius: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                    labelFormatter={(label) => new Date(label).toLocaleString()}
                                                    formatter={(value: any) => [`${Number(value).toFixed(2)} Bars`, 'Pression']}
                                                />
                                                <Area 
                                                    type="monotone" 
                                                    dataKey="pressure" 
                                                    stroke="#2563eb" 
                                                    strokeWidth={4}
                                                    fillOpacity={1} 
                                                    fill="url(#colorPressure)" 
                                                    animationDuration={1500}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-6 sm:p-10 bg-gray-50/80 dark:bg-gray-900/80 border-t border-gray-100 dark:border-gray-800 flex justify-end flex-shrink-0">
                            <button
                                onClick={() => setSelectedTank(null)}
                                className="px-10 py-5 bg-gray-900 dark:bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:scale-105 transition-all shadow-xl"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
