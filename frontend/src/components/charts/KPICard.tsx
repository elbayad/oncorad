import React from 'react';
import { LucideIcon } from 'lucide-react';

interface KPICardProps {
    label: string;
    value: string | number;
    unit?: string;
    secondaryValue?: string | number;
    secondaryLabel?: string;
    icon: LucideIcon;
    variant?: 'blue' | 'gray' | 'emerald' | 'amber' | 'red';
    trend?: number; // percentage
}

export default function KPICard({
    label,
    value,
    unit,
    secondaryValue,
    secondaryLabel,
    icon: Icon,
    variant = 'gray',
    trend
}: KPICardProps) {

    const getVariantStyles = () => {
        switch (variant) {
            case 'blue': return {
                bg: 'bg-white dark:bg-gray-800',
                border: 'border-blue-100 dark:border-blue-900',
                text: 'text-blue-600 dark:text-blue-400',
                iconBg: 'bg-blue-50 dark:bg-blue-900/20',
                iconColor: 'text-blue-500'
            };
            case 'emerald': return {
                bg: 'bg-emerald-50 dark:bg-emerald-900/10',
                border: 'border-emerald-200 dark:border-emerald-800',
                text: 'text-emerald-700 dark:text-emerald-400',
                iconBg: 'bg-emerald-100 dark:bg-emerald-800',
                iconColor: 'text-emerald-600 dark:text-emerald-100'
            };
            case 'amber': return {
                bg: 'bg-amber-50 dark:bg-amber-900/10',
                border: 'border-amber-200 dark:border-amber-800',
                text: 'text-amber-700 dark:text-amber-400',
                iconBg: 'bg-amber-100 dark:bg-amber-800',
                iconColor: 'text-amber-600 dark:text-amber-100'
            };
            case 'red': return {
                bg: 'bg-red-50 dark:bg-red-900/10',
                border: 'border-red-200 dark:border-red-800',
                text: 'text-red-700 dark:text-red-400',
                iconBg: 'bg-red-100 dark:bg-red-800',
                iconColor: 'text-red-600 dark:text-red-100'
            };
            default: return { // gray
                bg: 'bg-white dark:bg-gray-800',
                border: 'border-gray-200 dark:border-gray-700',
                text: 'text-gray-700 dark:text-gray-300',
                iconBg: 'bg-gray-50 dark:bg-gray-700',
                iconColor: 'text-gray-500 dark:text-gray-400'
            };
        }
    };

    const styles = getVariantStyles();

    return (
        <div className={`${styles.bg} rounded-xl shadow-sm p-4 border ${styles.border}`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
                    <div className="flex items-baseline gap-1 mt-1">
                        <p className={`text-3xl font-bold ${styles.text}`}>
                            {value}
                        </p>
                        {unit && <span className="text-sm font-medium text-gray-400">{unit}</span>}
                    </div>

                    {/* Optional Trend or Secondary Info */}
                    {(trend !== undefined || secondaryValue !== undefined) && (
                        <div className="mt-2 text-xs flex items-center gap-2">
                            {trend !== undefined && (
                                <span className={`${trend >= 0 ? 'text-emerald-500' : 'text-red-500'} font-medium`}>
                                    {trend > 0 ? '+' : ''}{trend}%
                                </span>
                            )}
                            {secondaryValue !== undefined && (
                                <span className="text-gray-400">
                                    {secondaryLabel ? `${secondaryLabel}: ` : ''}{secondaryValue}
                                </span>
                            )}
                        </div>
                    )}
                </div>
                <div className={`p-3 rounded-lg ${styles.iconBg}`}>
                    <Icon className={`h-6 w-6 ${styles.iconColor}`} />
                </div>
            </div>
        </div>
    );
}
