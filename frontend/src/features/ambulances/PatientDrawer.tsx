import React, { useState, useEffect } from 'react';
import { X, Search, User, Activity, AlertCircle, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

interface Patient {
    id: string | number;
    identifiant_patient: string;
    age: number;
    sexe: string;
    symptomes_principaux?: string;
    pression_arterielle?: string;
    frequence_cardiaque?: number;
    observations_libres?: string;
}

interface PatientDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    ambulanceId: string | null;
    onAssign: (patientId: string | number, missionDetails?: any) => Promise<void>;
}

export default function PatientDrawer({ isOpen, onClose, ambulanceId, onAssign }: PatientDrawerProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [assigning, setAssigning] = useState(false);
    const { t } = useTranslation();

    // Mission details
    const [priority, setPriority] = useState('medium');
    const [destination, setDestination] = useState('');

    useEffect(() => {
        if (isOpen) {
            // Load initial patients or reset
            fetchPatients();
        } else {
            setSearchQuery('');
            setSelectedPatient(null);
            setPriority('medium');
            setDestination('');
        }
    }, [isOpen]);

    const fetchPatients = async (query = '') => {
        try {
            setLoading(true);
            const token = localStorage.getItem('clinicToken');
            // Use existing search endpoint or list
            // Assuming GET /api/dossiers returns list, and we can filter client-side or add search param if backend supports it
            const url = query
                ? `/dossiers?identifiant_patient=${encodeURIComponent(query)}&limit=10`
                : `/dossiers?limit=10`;

            const res = await axios.get(url, {
                headers: token ? { Authorization: `Bearer ${token}` } : {}
            });

            if (res.data.success) {
                setPatients(res.data.data);
            }
        } catch (err) {
        } finally {
            setLoading(false);
        }
    };

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (isOpen) fetchPatients(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, isOpen]);

    const handleAssign = async () => {
        if (!selectedPatient || !ambulanceId) return;

        setAssigning(true);
        try {
            await onAssign(selectedPatient.id, {
                patient_id: selectedPatient.id, // Ensure patient_id is passed
                priority,
                destination,
                patient_name: `Patient ${selectedPatient.identifiant_patient}` // Fallback name
            });
            onClose();
        } catch (error) {
            alert(t('ambulance.patientDrawer.errors.assignError'));
        } finally {
            setAssigning(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-full md:w-[480px] bg-white dark:bg-gray-800 shadow-2xl z-[2000] transform transition-transform duration-300 ease-in-out border-l border-gray-200 dark:border-gray-700 flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {t('ambulance.patientDrawer.title')}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        {t('common.ambulance')}: <span className="font-medium text-blue-600 dark:text-blue-400">{ambulanceId}</span>
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                    <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder={t('ambulance.patientDrawer.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                </div>

                {/* Patient List */}
                {!selectedPatient ? (
                    <div className="space-y-3">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {searchQuery ? t('common.results') : t('ambulance.patientDrawer.recentPatients')}
                        </h3>

                        {loading ? (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            </div>
                        ) : patients.length > 0 ? (
                            patients.map(patient => (
                                <div
                                    key={patient.id}
                                    onClick={() => setSelectedPatient(patient)}
                                    className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600 hover:border-blue-500 hover:shadow-md cursor-pointer transition-all group"
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-start space-x-3">
                                            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                                                <User className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-gray-900 dark:text-white">
                                                    {t('common.patient')} {patient.identifiant_patient}
                                                </h4>
                                                <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 mt-1">
                                                    <span>{patient.age ? `${patient.age} ${t('common.years')}` : t('common.ageUnknown')}</span>
                                                    <span>•</span>
                                                    <span>{patient.sexe || t('common.sexUnknown')}</span>
                                                </div>
                                                {patient.symptomes_principaux && (
                                                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">
                                                        {patient.symptomes_principaux}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                {t('ambulance.patientDrawer.noPatientFound')}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Selected Patient Details */}
                        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-4 border border-blue-100 dark:border-blue-800">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center space-x-3">
                                    <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-200 font-bold text-lg">
                                        {patientInitials(patientInitials(selectedPatient.identifiant_patient))}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                                            {t('common.patient')} {selectedPatient.identifiant_patient}
                                        </h3>
                                        <p className="text-blue-600 dark:text-blue-400 text-sm">
                                            {t('ambulance.patientDrawer.selectedForTransport')}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedPatient(null)}
                                    className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 underline"
                                >
                                    {t('common.change')}
                                </button>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-4">
                                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                                    <span className="text-xs text-gray-500 uppercase">{t('common.vitals')}</span>
                                    <div className="flex items-center mt-1 space-x-2">
                                        <Activity className="h-4 w-4 text-green-500" />
                                        <span className="font-medium">{selectedPatient.frequence_cardiaque || '-'} bpm</span>
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                                    <span className="text-xs text-gray-500 uppercase">{t('common.alerts')}</span>
                                    <div className="flex items-center mt-1 space-x-2">
                                        <AlertCircle className="h-4 w-4 text-orange-500" />
                                        <span className="font-medium text-sm">{t('common.none')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Mission Config */}
                        <div className="space-y-4">
                            <h4 className="font-medium text-gray-900 dark:text-white">{t('ambulance.patientDrawer.missionConfig')}</h4>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('common.priority')}
                                </label>
                                <div className="grid grid-cols-3 gap-3">
                                    {['low', 'medium', 'high'].map((p) => (
                                        <button
                                            key={p}
                                            onClick={() => setPriority(p)}
                                            className={`py-2 px-4 rounded-lg text-sm font-medium capitalize border transition-all ${priority === p
                                                ? p === 'high' ? 'bg-red-50 border-red-500 text-red-700'
                                                    : p === 'medium' ? 'bg-orange-50 border-orange-500 text-orange-700'
                                                        : 'bg-green-50 border-green-500 text-green-700'
                                                : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300'
                                                }`}
                                        >
                                            {p === 'high' ? t('common.urgent') : p === 'medium' ? t('common.normal') : t('common.routine')}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    {t('ambulance.form.destination')}
                                </label>
                                <input
                                    type="text"
                                    value={destination}
                                    onChange={(e) => setDestination(e.target.value)}
                                    placeholder={t('ambulance.patientDrawer.destinationPlaceholder')}
                                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                <button
                    onClick={handleAssign}
                    disabled={!selectedPatient || assigning}
                    className="w-full bg-[#0096D6] hover:bg-[#007BB5] text-white font-medium py-3 rounded-xl flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {assigning ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    ) : (
                        <>
                            <Check className="h-5 w-5" />
                            <span>{t('ambulance.patientDrawer.confirmAssign')}</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}

function patientInitials(name: string) {
    return name ? name.substring(0, 2).toUpperCase() : 'PT';
}
