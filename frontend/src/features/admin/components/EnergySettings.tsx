import { useState, useEffect } from 'react';
import {
    Snowflake,
    Sun,
    Clock,
    Save,
    Loader2
} from 'lucide-react';

interface SettingsData {
    winter_creuses_start: number;
    winter_creuses_end: number;
    winter_pleines_start: number;
    winter_pleines_end: number;
    winter_pointe_start: number;
    winter_pointe_end: number;
    winter_creuses_start2: number;
    winter_creuses_end2: number;
    summer_creuses_start: number;
    summer_creuses_end: number;
    summer_pleines_start: number;
    summer_pleines_end: number;
    summer_pointe_start: number;
    summer_pointe_end: number;
    summer_creuses_start2: number;
    summer_creuses_end2: number;
    winter_creuses_price: number;
    winter_pleines_price: number;
    winter_pointe_price: number;
    summer_creuses_price: number;
    summer_pleines_price: number;
    summer_pointe_price: number;
}

export default function EnergySettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [settings, setSettings] = useState<SettingsData | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('clinicToken');
            const res = await fetch('/api/energy/settings', {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const json = await res.json();
            if (json.success) {
                setSettings(json.data);
            }
        } catch (error) {
            console.error('Error fetching energy settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        setMessage(null);
        try {
            const token = localStorage.getItem('clinicToken');
            const res = await fetch('/api/energy/settings', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify(settings)
            });
            const json = await res.json();
            if (json.success) {
                setMessage({ type: 'success', text: 'Paramètres enregistrés avec succès' });
                setTimeout(() => setMessage(null), 3000);
            } else {
                setMessage({ type: 'error', text: 'Erreur lors de l\'enregistrement' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: 'Erreur réseau' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 text-[#0096D6] animate-spin" />
            </div>
        );
    }

    if (!settings) return null;

    const SlotCard = ({
        title,
        id,
        startKey,
        endKey,
        priceKey,
        textColor,
        bgColor
    }: {
        title: string;
        id: string;
        startKey: keyof SettingsData;
        endKey: keyof SettingsData;
        priceKey: keyof SettingsData;
        textColor: string;
        bgColor: string;
    }) => (
        <div className={`p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm space-y-4`}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs ${bgColor} ${textColor}`}>
                        {id}
                    </div>
                    <h4 className="font-bold text-gray-900 dark:text-white text-sm">{title}</h4>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Début</label>
                    <input
                        type="number"
                        value={settings[startKey]}
                        onChange={(e) => setSettings({ ...settings, [startKey]: parseFloat(e.target.value) })}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0096D6] outline-none"
                    />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-gray-400">Fin</label>
                    <input
                        type="number"
                        value={settings[endKey]}
                        onChange={(e) => setSettings({ ...settings, [endKey]: parseFloat(e.target.value) })}
                        className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0096D6] outline-none"
                    />
                </div>
            </div>

            <div className="flex items-center justify-center py-1">
                <span className="text-[10px] font-medium text-gray-500 flex items-center gap-2">
                    Plage horaire: <span className="font-bold text-gray-900 dark:text-white">{settings[startKey].toString().padStart(2, '0')}:00 - {settings[endKey].toString().padStart(2, '0')}:00</span>
                </span>
            </div>

            <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500">
                    <span className="font-bold text-sm">$</span>
                </div>
                <input
                    type="number"
                    step="0.00001"
                    value={settings[priceKey]}
                    onChange={(e) => setSettings({ ...settings, [priceKey]: parseFloat(e.target.value) })}
                    className="w-full pl-8 pr-16 bg-gray-100/50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-lg py-2 text-sm font-bold text-gray-900 dark:text-white outline-none"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">
                    dhs/kWh
                </div>
            </div>
        </div>
    );

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Page Header */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-start gap-4">
                <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-[#0096D6]">
                    <Clock className="h-6 w-6" />
                </div>
                <div>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Configuration des Tranches Tarifaires</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
                        Configurez les heures de début et de fin pour chaque tranche tarifaire (Creuses, Pleines, Pointe) et les prix unitaires (dhs/kWh) pour les périodes hiver et été.
                    </p>
                </div>
            </div>

            {/* Winter Period */}
            <div className="space-y-6">
                <div className="flex items-center gap-3 border-l-4 border-blue-400 pl-4">
                    <Snowflake className="h-6 w-6 text-blue-400" />
                    <div>
                        <h3 className="text-lg font-black text-gray-900 dark:text-white">Période Hiver</h3>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Octobre - Mars</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <SlotCard
                        title="Creuses (1ère période)"
                        id="C1"
                        startKey="winter_creuses_start"
                        endKey="winter_creuses_end"
                        priceKey="winter_creuses_price"
                        textColor="text-blue-600"
                        bgColor="bg-blue-100"
                    />
                    <SlotCard
                        title="Pleines"
                        id="P"
                        startKey="winter_pleines_start"
                        endKey="winter_pleines_end"
                        priceKey="winter_pleines_price"
                        textColor="text-orange-600"
                        bgColor="bg-orange-100"
                    />
                    <SlotCard
                        title="Pointe"
                        id="PT"
                        startKey="winter_pointe_start"
                        endKey="winter_pointe_end"
                        priceKey="winter_pointe_price"
                        textColor="text-red-600"
                        bgColor="bg-red-100"
                    />
                    <SlotCard
                        title="Creuses (2ème période)"
                        id="C2"
                        startKey="winter_creuses_start2"
                        endKey="winter_creuses_end2"
                        priceKey="winter_creuses_price" // Shared with C1 for price
                        textColor="text-blue-600"
                        bgColor="bg-blue-100"
                    />
                </div>
            </div>

            {/* Summer Period */}
            <div className="space-y-6">
                <div className="flex items-center gap-3 border-l-4 border-orange-400 pl-4">
                    <Sun className="h-6 w-6 text-orange-400" />
                    <div>
                        <h3 className="text-lg font-black text-gray-900 dark:text-white">Période Été</h3>
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Avril - Septembre</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <SlotCard
                        title="Creuses (1ère période)"
                        id="C1"
                        startKey="summer_creuses_start"
                        endKey="summer_creuses_end"
                        priceKey="summer_creuses_price"
                        textColor="text-blue-600"
                        bgColor="bg-blue-100"
                    />
                    <SlotCard
                        title="Pleines"
                        id="P"
                        startKey="summer_pleines_start"
                        endKey="summer_pleines_end"
                        priceKey="summer_pleines_price"
                        textColor="text-orange-600"
                        bgColor="bg-orange-100"
                    />
                    <SlotCard
                        title="Pointe"
                        id="PT"
                        startKey="summer_pointe_start"
                        endKey="summer_pointe_end"
                        priceKey="summer_pointe_price"
                        textColor="text-red-600"
                        bgColor="bg-red-100"
                    />
                    <SlotCard
                        title="Creuses (2ème période)"
                        id="C2"
                        startKey="summer_creuses_start2"
                        endKey="summer_creuses_end2"
                        priceKey="summer_creuses_price" // Shared price
                        textColor="text-blue-600"
                        bgColor="bg-blue-100"
                    />
                </div>
            </div>

            {/* Save Button & Messages */}
            <div className="flex items-center justify-between bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-lg">
                <div>
                    {message && (
                        <div className={`px-4 py-2 rounded-lg text-sm font-bold animate-in slide-in-from-left duration-300 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
                            }`}>
                            {message.text}
                        </div>
                    )}
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-3 bg-[#0096D6] hover:bg-[#007BB5] disabled:bg-gray-400 text-white px-8 py-3 rounded-xl font-bold transition-all duration-200 shadow-md hover:shadow-lg active:scale-95"
                >
                    {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                    <span>Enregistrer les paramètres</span>
                </button>
            </div>

            <div className="flex items-center justify-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest pt-4">
                <span>MACHWATT</span>
                <div className="h-1 w-1 rounded-full bg-gray-300" />
                <span>Gestion des tranches v1.0</span>
            </div>
        </div>
    );
}
