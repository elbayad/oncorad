export type TariffSlot = 'creuses' | 'pleines' | 'pointe';

export interface EnergyHistoryPoint {
    time: string;
    total_kw: number;
}

export interface DayStats {
    date: string;
    creuses: number; // kWh
    pleines: number; // kWh
    pointe: number; // kWh
    total: number; // kWh
    partCreuse: number; // %
    expoPointe: number; // %
    loadFactor: number; // %
}

/**
 * Determines the tariff slot for a given date and time.
 * Hiver (Oct-Mar):
 * - Creuses: 00h-07h, 22h-00h
 * - Pleines: 07h-17h
 * - Pointe: 17h-22h
 * Été (Avr-Sep):
 * - Creuses: 00h-07h, 23h-00h
 * - Pleines: 07h-18h
 * - Pointe: 18h-23h
 */
export const getTariffSlot = (date: Date): TariffSlot => {
    const month = date.getMonth(); // 0-indexed (0 = Jan)
    const hour = date.getHours();
    const isHiver = month >= 9 || month <= 2; // Oct (9) to Mar (2)

    if (isHiver) {
        if (hour < 7 || hour >= 22) return 'creuses';
        if (hour < 17) return 'pleines';
        return 'pointe';
    } else {
        if (hour < 7 || hour >= 23) return 'creuses';
        if (hour < 18) return 'pleines';
        return 'pointe';
    }
};

/**
 * Calculates daily statistics from history points.
 * Assumes total_kw is average power for the period.
 * We'll compute the time delta between points to get kWh.
 */
export const calculateDailyStats = (history: EnergyHistoryPoint[]): DayStats[] => {
    if (history.length === 0) return [];

    const dailyData: Record<string, { creuses: number; pleines: number; pointe: number; maxKw: number; points: number }> = {};

    // Sort history by time
    const sorted = [...history].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    for (let i = 0; i < sorted.length; i++) {
        const current = sorted[i];
        const prev = i > 0 ? sorted[i - 1] : null;
        const dateStr = current.time.split('T')[0];
        const date = new Date(current.time);
        const slot = getTariffSlot(date);

        if (!dailyData[dateStr]) {
            dailyData[dateStr] = { creuses: 0, pleines: 0, pointe: 0, maxKw: 0, points: 0 };
        }

        const currentKw = current.total_kw || 0;
        dailyData[dateStr].maxKw = Math.max(dailyData[dateStr].maxKw, currentKw);
        dailyData[dateStr].points += 1;

        // Estimate kWh: (Power in kW) * (Time in hours)
        // If we have a previous point, we take the interval. 
        // Otherwise, we take a default interval (e.g., 10 minutes from Reporting sampling or 1 hour for aggregation)
        let intervalHours = 0.166; // Default to 10 minutes (0.166 hours)
        if (prev) {
            const diffMs = new Date(current.time).getTime() - new Date(prev.time).getTime();
            const diffHours = diffMs / (1000 * 60 * 60);
            // Avoid huge gaps if tracking started late
            if (diffHours < 4) {
                intervalHours = diffHours;
            }
        }

        const kwh = currentKw * intervalHours;
        dailyData[dateStr][slot] += kwh;
    }

    return Object.entries(dailyData).map(([date, data]) => {
        const total = data.creuses + data.pleines + data.pointe;
        const avgKw = total / 24; // Simple daily avg for load factor

        return {
            date,
            creuses: data.creuses,
            pleines: data.pleines,
            pointe: data.pointe,
            total,
            partCreuse: total > 0 ? (data.creuses / total) * 100 : 0,
            expoPointe: total > 0 ? (data.pointe / total) * 100 : 0,
            loadFactor: data.maxKw > 0 ? (avgKw / data.maxKw) * 100 : 0
        };
    }).sort((a, b) => b.date.localeCompare(a.date));
};
