import { useState, useMemo, useEffect } from 'react';
import { X, Play, Clock, MapPin, Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface ZoneMovement {
    zone: string;
    entry_time: string;
    exit_time: string;
    coordinates?: { x: number; y: number };
}

interface HistoryDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    assetName: string;
    onTimeRangeChange: (start: Date, end: Date) => void;
    initialRange?: { start: Date; end: Date } | null;
    zoneHistory?: ZoneMovement[];
}

export default function HistoryDrawer({
    isOpen,
    onClose,
    assetName,
    onTimeRangeChange,
    initialRange,
    zoneHistory = []
}: HistoryDrawerProps) {
    const { t, i18n } = useTranslation();
    const [activeRange, setActiveRange] = useState<'2h' | 'today' | 'custom'>('2h');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');

    // Synchronize inputs when drawer opens or initialRange changes
    useEffect(() => {
        if (isOpen && initialRange) {
            setCustomStart(formatDateForInput(initialRange.start));
            setCustomEnd(formatDateForInput(initialRange.end));
        }
    }, [isOpen, initialRange]);

    // Format date for value in datetime-local input
    const formatDateForInput = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    // Handle range selection (Auto-fill)
    const handleRangeSelect = (range: '2h' | 'today') => {
        setActiveRange(range);
        const end = new Date();
        const start = new Date();

        if (range === '2h') {
            start.setHours(end.getHours() - 2);
        } else if (range === 'today') {
            start.setHours(0, 0, 0, 0);
        }

        setCustomStart(formatDateForInput(start));
        setCustomEnd(formatDateForInput(end));
    };

    const handleCustomApply = () => {
        if (customStart && customEnd) {
            setActiveRange('custom');
            onTimeRangeChange(new Date(customStart), new Date(customEnd));
        }
    };

    // Group history by day
    const groupedHistory = useMemo((): [string, ZoneMovement[]][] => {
        const groups: Record<string, ZoneMovement[]> = {};

        // 1. Filter out movements < 2 minutes
        const filtered = zoneHistory.filter(move => {
            const entry = new Date(move.entry_time);
            const exit = new Date(move.exit_time);
            return (exit.getTime() - entry.getTime()) >= 120000; // 2 minutes in ms
        });

        // 2. Group existing movements by date
        filtered.forEach(move => {
            const date = move.entry_time.split('T')[0];
            if (!groups[date]) groups[date] = [];
            groups[date].push(move);
        });

        // 3. Ensure all days in the range are mentioned (if range is active)
        if (customStart && customEnd) {
            try {
                const sDateStr = customStart.split('T')[0];
                const eDateStr = customEnd.split('T')[0];

                // Use local date parts to avoid UTC shifts
                const [sY, sM, sD] = sDateStr.split('-').map(Number);
                const [eY, eM, eD] = eDateStr.split('-').map(Number);

                const current = new Date(sY, sM - 1, sD);
                const endDay = new Date(eY, eM - 1, eD);

                let iter = 0;
                while (current <= endDay && iter < 100) {
                    const y = current.getFullYear();
                    const m = String(current.getMonth() + 1).padStart(2, '0');
                    const d = String(current.getDate()).padStart(2, '0');
                    const dateStr = `${y}-${m}-${d}`;

                    if (!groups[dateStr]) groups[dateStr] = [];
                    current.setDate(current.getDate() + 1);
                    iter++;
                }
            } catch (e) {
                console.error("Error generating dates", e);
            }
        }

        // 4. Return dates sorted DESC
        return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
    }, [zoneHistory, customStart, customEnd]);

    return (
        <>
            {/* Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[2000] lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Drawer */}
            <div className={`fixed inset-y-0 ltr:right-0 rtl:left-0 w-full lg:w-96 bg-white dark:bg-gray-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-[2001] border-l border-gray-200 dark:border-gray-700 flex flex-col ${isOpen ? 'translate-x-0' : 'ltr:translate-x-full rtl:-translate-x-full'}`}>

                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Clock className="h-5 w-5 text-blue-600" />
                            {t('rtls.history')}
                        </h2>
                        <p className="text-sm font-black text-[#0096D6] dark:text-blue-400 mt-1">
                            {assetName}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors"
                    >
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">

                    {/* Period Selector */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                            {t('rtls.period')}
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => handleRangeSelect('2h')}
                                className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${activeRange === '2h'
                                    ? 'bg-[#0096D6] border-blue-600 text-white shadow-md'
                                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50'
                                    }`}
                            >
                                {t('rtls.last2h')}
                            </button>
                            <button
                                onClick={() => handleRangeSelect('today')}
                                className={`px-3 py-2 text-sm font-medium rounded-lg border transition-all ${activeRange === 'today'
                                    ? 'bg-[#0096D6] border-blue-600 text-white shadow-md'
                                    : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50'
                                    }`}
                            >
                                {t('common.today')}
                            </button>
                        </div>

                        {/* Custom Range */}
                        <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                            <div className="grid grid-cols-1 gap-2 mb-2">
                                <input
                                    type="datetime-local"
                                    className="w-full text-xs p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    value={customStart}
                                    onChange={(e) => setCustomStart(e.target.value)}
                                />
                                <input
                                    type="datetime-local"
                                    className="w-full text-xs p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                    value={customEnd}
                                    onChange={(e) => setCustomEnd(e.target.value)}
                                />
                            </div>
                            <button
                                onClick={handleCustomApply}
                                className="w-full py-1.5 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100"
                            >
                                {t('common.apply')}
                            </button>
                        </div>
                    </div>

                    {/* Zone Movements */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                {t('rtls.zoneMovements', 'Mouvements par Zone')}
                            </h3>
                            <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full text-gray-500">
                                {zoneHistory.length}
                            </span>
                        </div>

                        <div className="space-y-6">
                            {groupedHistory.length === 0 ? (
                                <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                                    <Activity className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                                    <p className="text-xs text-gray-500">{t('rtls.noMovements', 'Aucun mouvement détecté')}</p>
                                </div>
                            ) : (
                                groupedHistory.map(([date, moves]) => (
                                    <div key={date} className="space-y-4">
                                        <div className="sticky top-0 z-10 py-2 bg-white dark:bg-gray-800">
                                            <div className="flex items-center gap-3 bg-blue-50/50 dark:bg-blue-900/20 px-4 py-2 rounded-xl border border-blue-100/50 dark:border-blue-800/50 shadow-sm transition-all hover:bg-blue-50 dark:hover:bg-blue-900/40">
                                                <div className="p-2 bg-blue-600 rounded-lg shadow-md">
                                                    <Clock className="h-4 w-4 text-white" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-black text-blue-900 dark:text-blue-100 uppercase tracking-tighter">
                                                        {new Date(date).toLocaleDateString(i18n.language, { weekday: 'long' })}
                                                    </span>
                                                    <span className="text-[10px] font-bold text-blue-600/70 dark:text-blue-400/70">
                                                        {new Date(date).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' })}
                                                    </span>
                                                </div>
                                                <div className="ml-auto">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${moves.length > 0
                                                        ? 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200'
                                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-400'}`}>
                                                        {moves.length} {t('rtls.movements', 'mouv.')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-3 px-1">
                                            {moves.length === 0 ? (
                                                <div className="py-4 text-center border-2 border-dashed border-gray-100 dark:border-gray-700/50 rounded-xl">
                                                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest italic font-mono">
                                                        {t('rtls.noDailyMovement', 'Aucun mouvement ce jour')}
                                                    </p>
                                                </div>
                                            ) : (
                                                (moves as any[]).map((move, idx) => {
                                                    const entry = new Date(move.entry_time);
                                                    const exit = new Date(move.exit_time);
                                                    const durationMs = exit.getTime() - entry.getTime();
                                                    const durationMin = Math.round(durationMs / 60000);

                                                    return (
                                                        <div
                                                            key={idx}
                                                            className="group bg-white dark:bg-gray-700 p-3 rounded-xl border border-gray-100 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all"
                                                        >
                                                            <div className="flex items-start justify-between mb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                                                                        <MapPin className="h-3.5 w-3.5 text-blue-600" />
                                                                    </div>
                                                                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                                                                        {move.zone}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[10px] font-medium px-2 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-300 rounded-full">
                                                                    {durationMin} min
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                                                                <div className="flex items-center gap-1">
                                                                    <Play className="h-3 w-3 text-emerald-500 fill-current" />
                                                                    {entry.toLocaleTimeString()}
                                                                </div>
                                                                <div className="h-px flex-1 bg-gray-100 dark:bg-gray-600 mx-2" />
                                                                <div className="flex items-center gap-1">
                                                                    {exit.toLocaleTimeString()}
                                                                    <X className="h-3 w-3 text-red-500" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

            </div >
        </>
    );
}
