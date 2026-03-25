
import React from 'react';
import { Activity, Clock, AlertCircle, AlertTriangle } from 'lucide-react';

interface OxygenTankCardProps {
    tank: {
        id: string;
        mac: string;
        name: string;
        location: string;
        last_seen: string;
        pression_max?: number;
        latest_reading?: {
            pressure1: number;
            stat1: boolean;
            pressure2: number;
            stat2: boolean;
            reading_time: string;
        };
    };
    onClick?: () => void;
}

const OxygenTankCard: React.FC<OxygenTankCardProps> = ({ tank, onClick }) => {
    const { name, location, latest_reading, pression_max = 10 } = tank;


    // Determine which circuit to use based on tank name
    // Principale (or default) -> Circuit 1
    // Secondaire or " 2" -> Circuit 2
    const isCircuit2 = name.toLowerCase().includes('secondaire') || name.includes(' 2');

    const pressure = isCircuit2 ? latest_reading?.pressure2 : latest_reading?.pressure1;
    const stat = isCircuit2 ? latest_reading?.stat2 : latest_reading?.stat1;

    // Default to 0/false if undefined
    const currentPressure = Number(pressure ?? 0);
    const currentStat = stat ?? false;

    // Visual Status Calculation
    let visualStatus = 'normal';
    // Logic: Warning if < 60% of max, Critical if < 30% of max
    const warningThreshold = pression_max * 0.6;
    const criticalThreshold = pression_max * 0.3;

    if (currentPressure < criticalThreshold) visualStatus = 'critical';
    else if (currentPressure < warningThreshold) visualStatus = 'warning';

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'critical':
                return {
                    bg: 'bg-red-50 dark:bg-red-900/10',
                    border: 'border-red-200 dark:border-red-800',
                    text: 'text-red-700 dark:text-red-400',
                    accent: 'from-red-500/20 to-red-500/5',
                    bar: 'bg-red-600',
                    icon: 'text-red-600'
                };
            case 'warning':
                return {
                    bg: 'bg-amber-50 dark:bg-amber-900/10',
                    border: 'border-amber-200 dark:border-amber-800',
                    text: 'text-amber-700 dark:text-amber-400',
                    accent: 'from-amber-500/20 to-amber-500/5',
                    bar: 'bg-amber-500',
                    icon: 'text-amber-600'
                };
            default: // normal
                return {
                    bg: 'bg-white dark:bg-gray-800',
                    border: 'border-emerald-100 dark:border-gray-700',
                    text: 'text-emerald-700 dark:text-emerald-400',
                    accent: 'from-emerald-500/10 to-emerald-500/5',
                    bar: 'bg-emerald-500',
                    icon: 'text-emerald-600'
                };
        }
    };

    const styles = getStatusStyles(visualStatus);

    return (
        <div 
            onClick={onClick}
            className={`
            relative rounded-2xl p-6 shadow-sm border transition-all duration-300 group hover:shadow-lg cursor-pointer
            ${styles.bg} ${styles.border}
        `}>
            {/* Decorative background accent */}
            <div className={`absolute top-0 right-0 w-48 h-48 bg-gradient-to-br ${styles.accent} rounded-bl-[100px] opacity-50 -mr-8 -mt-8 transition-colors`}></div>

            <div className="relative z-10">
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Activity className={`w-5 h-5 ${styles.icon}`} />
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{name}</h3>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            {location}
                        </p>
                    </div>
                    <div className={`px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wide border
                        ${currentStat ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'}
                    `}>
                        {currentStat ? 'ACTIF' : 'INACTIF'}
                    </div>
                </div>

                {!latest_reading ? (
                    <div className="text-center py-12 text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                        <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <span>Aucune donnée</span>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Main Reading */}
                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Pression Actuelle</span>
                            </div>

                            <div className="flex items-baseline gap-2">
                                <span className={`text-6xl font-black tracking-tight ${styles.text}`}>
                                    {currentPressure.toFixed(1)}
                                </span>
                                <span className="text-xl font-medium text-gray-400">Bars</span>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full h-3 bg-gray-100 dark:bg-gray-700 rounded-full mt-4 overflow-hidden shadow-inner">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ${styles.bar}`}
                                    style={{ width: `${Math.min((currentPressure / (pression_max || 10)) * 100, 100)}%` }}
                                ></div>
                            </div>

                            {/* Threshold Indicators (Dynamic scaling) */}
                            <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1 font-medium">
                                <span>0</span>
                                <span>{criticalThreshold.toFixed(1)} (Crit)</span>
                                <span>{warningThreshold.toFixed(1)} (Warn)</span>
                                <span>{pression_max} Bars</span>
                            </div>
                        </div>

                        {/* Footer Info */}
                        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-700/50">
                            <div className="flex items-center text-xs text-gray-500 font-medium">
                                <Clock className="w-3.5 h-3.5 mr-1.5" />
                                <span>MAJ: {new Date(latest_reading.reading_time).toLocaleTimeString()}</span>
                            </div>
                            <div className={`text-xs font-bold px-2 py-0.5 rounded ${visualStatus === 'normal' ? 'hidden' : 'bg-white/50'}`}>
                                {visualStatus === 'critical' && <span className="text-red-600 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> CRITIQUE</span>}
                                {visualStatus === 'warning' && <span className="text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> ATTENTION</span>}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OxygenTankCard;
