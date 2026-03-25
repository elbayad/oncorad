
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPlus, Save, Calendar, User, Hash, Stethoscope, CircuitBoard, Search, Edit, Trash2, Plus, ChevronLeft, ChevronRight, Loader2, ArrowLeft, FileText, Layers, Scan, X, Wifi, WifiOff } from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';
import io from 'socket.io-client';


interface AdmissionForm {
    id?: string;
    numero_dossier: string;
    nom: string;
    prenom: string;
    sexe: string;
    date_admission: string;
    numero_chambre: string;
    medecin_traitant: string;
    mac_rtls: string;
    etage: string;
    date_naissance: string;
}



export default function Admission() {
    const { t, i18n } = useTranslation();
    const [view, setView] = useState<'list' | 'form'>('list');
    const [admissions, setAdmissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [total, setTotal] = useState(0);

    // Pagination & Search
    const [limit] = useState(10);
    const [offset, setOffset] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');

    const [selectedFloor, setSelectedFloor] = useState<string>('');
    const [showScanner, setShowScanner] = useState(false);
    const [showNfcScanner, setShowNfcScanner] = useState(false);
    const [nfcStatus, setNfcStatus] = useState<'disconnected' | 'connected' | 'reading'>('disconnected');
    const [nfcReaderName, setNfcReaderName] = useState<string | null>(null);
    const [nfcScanData, setNfcScanData] = useState<{ uid: string, atr: string, standard: string, record1: string } | null>(null);
    const [form, setForm] = useState<AdmissionForm>({
        numero_dossier: '',
        nom: '',
        prenom: '',
        sexe: 'M',
        date_admission: new Date().toISOString().slice(0, 16),
        numero_chambre: '',
        medecin_traitant: '',
        mac_rtls: '',
        etage: '',
        date_naissance: ''
    });


    // Dynamic Data
    const [doctors, setDoctors] = useState<any[]>([]);
    const [floors, setFloors] = useState<any[]>([]);
    const [rooms, setRooms] = useState<any[]>([]);

    useEffect(() => {
        fetchDoctors();
        fetchFloors();
    }, []);

    // Fetch rooms when floor is selected
    useEffect(() => {
        if (selectedFloor) {
            fetchRooms(selectedFloor);
        } else {
            setRooms([]);
        }
    }, [selectedFloor]);

    const fetchFloors = async () => {
        try {
            const token = localStorage.getItem('clinicToken');
            const res = await fetch('/api/floors', {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const json = await res.json();
            if (json.success) {
                setFloors(json.data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const fetchRooms = async (floorId: string) => {
        try {
            const token = localStorage.getItem('clinicToken');
            const res = await fetch(`/api/rooms?floorId=${floorId}`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const json = await res.json();
            if (json.success) {
                setRooms(json.data);
            } else {
                setRooms([]);
            }
        } catch (err) {
            console.error(err);
            setRooms([]);
        }
    };

    useEffect(() => {
        if (view === 'list') {
            fetchAdmissions();
        }
    }, [view, offset]);

    const fetchAdmissions = async (query = searchQuery) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('clinicToken');
            const url = `/api/admissions?limit=${limit}&offset=${offset}${query ? `&search=${encodeURIComponent(query)}` : ''}`;
            const res = await fetch(url, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const json = await res.json();
            if (json.success) {
                setAdmissions(json.data);
                setTotal(json.total || 0);
            } else {
                setMessage(t('admission.messages.loadError'));
            }
        } catch (err) {
            setMessage(t('admission.messages.connectionError'));
        } finally {
            setLoading(false);
        }
    };

    const fetchDoctors = async () => {
        try {
            const token = localStorage.getItem('clinicToken');
            const res = await fetch('/api/assets?typeId=medecin', {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const json = await res.json();
            if (json.success) {
                setDoctors(json.data);
            }
        } catch (err) {
        }
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setOffset(0);
        fetchAdmissions(searchQuery);
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm(t('admission.messages.deleteConfirm'))) return;
        try {
            const token = localStorage.getItem('clinicToken');
            const res = await fetch(`/api/admissions/${id}`, {
                method: 'DELETE',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (res.ok) {
                setMessage(t('admission.messages.deleted'));
                fetchAdmissions();
            } else {
                setMessage(t('admission.messages.deleteError'));
            }
        } catch (err) {
            setMessage(t('admission.messages.deleteErrorFull'));
        }
    };

    const handleAddNew = () => {
        setForm({
            numero_dossier: '',
            nom: '',
            prenom: '',
            sexe: 'M',
            date_admission: new Date().toISOString().slice(0, 16),
            numero_chambre: '',
            medecin_traitant: '',
            mac_rtls: '',
            etage: '',
            date_naissance: ''
        });
        setSelectedFloor('');
        setRooms([]);
        setMessage(null);
        setView('form');
    };

    const handleEdit = (admission: any) => {
        setForm({
            id: admission.id,
            numero_dossier: admission.numero_dossier || '',
            nom: admission.nom,
            prenom: admission.prenom,
            sexe: admission.sexe,
            date_admission: admission.date_admission ? new Date(admission.date_admission).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
            numero_chambre: admission.numero_chambre || '',
            medecin_traitant: admission.medecin_traitant || '',
            mac_rtls: admission.mac_rtls || '',
            etage: admission.etage || '',
            date_naissance: admission.date_naissance ? new Date(admission.date_naissance).toISOString().slice(0, 10) : ''
        });
        setSelectedFloor(admission.etage || '');
        setMessage(null);
        setView('form');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        // Include selected floor in form data
        const payload = { ...form, etage: selectedFloor };

        try {
            const token = localStorage.getItem('clinicToken');
            const url = form.id ? `/api/admissions/${form.id}` : '/api/admissions';
            const method = form.id ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(payload)
            });

            const json = await res.json();
            if (json.success) {
                setMessage(form.id ? t('admission.messages.savedEdit') : t('admission.messages.savedNew'));
                if (!form.id) {
                    setTimeout(() => setView('list'), 1000);
                } else {
                    setTimeout(() => setView('list'), 1000);
                }
            } else {
                setMessage(json.message || t('admission.messages.saveError'));
            }
        } catch (error) {
            setMessage(t('admission.messages.saveError'));
        } finally {
            setLoading(false);
        }
    };

    const update = (field: keyof AdmissionForm, value: string) => {
        setForm(prev => ({ ...prev, [field]: value }));
    };

    const handleScan = (result: any) => {
        if (result) {
            const text = result[0]?.rawValue || result?.text || result;
            if (text) {
                update('mac_rtls', text.toLowerCase());
                setShowScanner(false);
            }
        }
    };

    // NFC Logic
    useEffect(() => {
        let socket: any;
        if (showNfcScanner) {
            socket = io('http://localhost:4000');
            
            socket.on('connect', () => {
                setNfcStatus('connected');
            });

            socket.on('disconnect', () => {
                setNfcStatus('disconnected');
            });

            socket.on('reader-status', (readers: string[]) => {
                if (readers.length > 0) {
                    setNfcReaderName(readers[0]);
                } else {
                    setNfcReaderName(null);
                }
            });

            socket.on('tag-read', (data: any) => {
                const scanResult = typeof data === 'string' ? { uid: data, atr: 'N/A', standard: 'N/A', record1: data } : data;
                setNfcScanData(scanResult);
                
                // Priorité au record1 pour l'adresse MAC
                const finalMac = (scanResult.record1 || scanResult.uid).toLowerCase();
                update('mac_rtls', finalMac);
                
                setNfcStatus('reading');
                // On garde la modale ouverte un peu pour voir les infos
                setTimeout(() => {
                    setShowNfcScanner(false);
                    setNfcScanData(null);
                    setNfcStatus('connected');
                }, 4000); // 4 secondes pour lire les infos de la carte
            });

            socket.on('tag-error', (err: string) => {
                console.error('NFC Error:', err);
            });
        }

        return () => {
            if (socket) socket.disconnect();
        };
    }, [showNfcScanner]);

    const handleError = (error: any) => {
        console.error(error);
    };

    // Get locale string for date formatting
    const getDateLocale = () => {
        const lang = i18n.language;
        if (lang === 'ar') return 'ar-MA';
        if (lang === 'en') return 'en-GB';
        return 'fr-FR';
    };

    if (view === 'list') {
        return (
            <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                            <UserPlus className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('admission.title')}</h1>
                            <p className="text-gray-500 dark:text-gray-400">{t('admission.subtitle')}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleAddNew}
                        className="flex items-center space-x-2 bg-[#0096D6] hover:bg-[#007BB5] text-white px-4 py-2 rounded-lg transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        <span>{t('admission.newAdmission')}</span>
                    </button>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <form onSubmit={handleSearchSubmit} className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder={t('admission.searchPlaceholder')}
                                    className="w-full ps-10 pe-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <button type="submit" className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                                {t('common.search')}
                            </button>
                        </form>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                            <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                    <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('admission.table.patient')}</th>
                                    <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('admission.table.room')}</th>
                                    <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('admission.table.admissionDate')}</th>
                                    <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('admission.table.doctor')}</th>
                                    <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('admission.table.statusRtls')}</th>
                                    <th className="px-6 py-3 text-end text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('admission.table.actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                                            <div className="flex justify-center items-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}
                                            </div>
                                        </td>
                                    </tr>
                                ) : admissions.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-4 text-center text-gray-500">{t('admission.noResults')}</td>
                                    </tr>
                                ) : (
                                    admissions.map((adm) => (
                                        <tr key={adm.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs me-3">
                                                        {adm.nom ? adm.nom.substring(0, 2).toUpperCase() : 'PT'}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-gray-900 dark:text-white">{adm.nom} {adm.prenom}</div>
                                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                                            {adm.sexe} {adm.date_naissance ? `• ${new Date(adm.date_naissance).toLocaleDateString('fr-FR')}` : ''}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900 dark:text-white font-medium">{adm.numero_chambre || '-'}</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">{t('admission.floorLabel')} {adm.etage || '-'}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                                {adm.date_admission ? new Date(adm.date_admission).toLocaleString(getDateLocale(), {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                }) : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                {adm.medecin_traitant || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                {(() => {
                                                    const isRecent = adm.rtls_last_seen && (new Date().getTime() - new Date(adm.rtls_last_seen).getTime() < 5 * 60 * 1000);
                                                    return adm.mac_rtls && isRecent ? (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                                            <span className="w-2 h-2 me-1 bg-green-500 rounded-full animate-pulse"></span>
                                                            {t('common.active')}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                                                            {t('common.inactive')}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-end text-sm font-medium">
                                                <div className="flex items-center justify-end space-x-2">
                                                    <button onClick={() => handleEdit(adm)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-1">
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                    <button onClick={() => handleDelete(adm.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-900/50 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6">
                        <div className="flex-1 flex justify-between sm:hidden">
                            <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))} className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
                                {t('common.pagination.previous')}
                            </button>
                            <button disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)} className="ms-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
                                {t('common.pagination.next')}
                            </button>
                        </div>
                        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm text-gray-700 dark:text-gray-300">
                                    {t('common.pagination.showing')} <span className="font-medium">{Math.min(offset + 1, total)}</span> {t('common.pagination.to')} <span className="font-medium">{Math.min(offset + limit, total)}</span> {t('common.pagination.of')} <span className="font-medium">{total}</span> {t('common.pagination.results')}
                                </p>
                            </div>
                            <div>
                                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                    <button
                                        onClick={() => setOffset(Math.max(0, offset - limit))}
                                        disabled={offset === 0}
                                        className="relative inline-flex items-center px-2 py-2 rounded-s-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                                    >
                                        <span className="sr-only">{t('common.pagination.previous')}</span>
                                        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                                    </button>
                                    <button
                                        onClick={() => setOffset(offset + limit)}
                                        disabled={offset + limit >= total}
                                        className="relative inline-flex items-center px-2 py-2 rounded-e-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                                    >
                                        <span className="sr-only">{t('common.pagination.next')}</span>
                                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                                    </button>
                                </nav>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6">
            <div className="flex items-center gap-3 mb-6">
                <button
                    onClick={() => {
                        setView('list');
                        fetchAdmissions();
                    }}
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                    <ArrowLeft className="h-6 w-6 text-gray-600 dark:text-gray-300" />
                </button>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                    <UserPlus className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('admission.formTitle')}</h1>
                    <p className="text-gray-500 dark:text-gray-400">{form.id ? t('admission.editFormSubtitle') : t('admission.newFormSubtitle')}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Identité */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-gray-700">
                            {t('admission.identity')}
                        </h3>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('admission.fields.dossierNumber')} <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <FileText className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    required
                                    className="w-full ps-10 px-4 py-2 rounded-lg border border-red-300 dark:border-red-900 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all placeholder-red-300"
                                    placeholder={t('admission.fields.dossierPlaceholder')}
                                    value={form.numero_dossier}
                                    onChange={(e) => update('numero_dossier', e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('admission.fields.lastName')} <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <User className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    required
                                    className="w-full ps-10 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    placeholder={t('admission.fields.lastNamePlaceholder')}
                                    value={form.nom}
                                    onChange={(e) => update('nom', e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('admission.fields.firstName')} <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <User className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    required
                                    className="w-full ps-10 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    placeholder={t('admission.fields.firstNamePlaceholder')}
                                    value={form.prenom}
                                    onChange={(e) => update('prenom', e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('admission.fields.sex')} <span className="text-red-500">*</span>
                            </label>
                            <select
                                required
                                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                value={form.sexe}
                                onChange={(e) => update('sexe', e.target.value)}
                            >
                                <option value="M">{t('admission.sex.male')}</option>
                                <option value="F">{t('admission.sex.female')}</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('admission.fields.dateOfBirth')}
                            </label>
                            <div className="relative">
                                <Calendar className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="date"
                                    className="w-full ps-10 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    value={form.date_naissance}
                                    onChange={(e) => update('date_naissance', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Hospitalisation */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white border-b pb-2 border-gray-100 dark:border-gray-700">
                            {t('admission.hospitalization')}
                        </h3>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('admission.fields.admissionDate')} <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <Calendar className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="datetime-local"
                                    required
                                    className="w-full ps-10 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    value={form.date_admission}
                                    onChange={(e) => update('date_admission', e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('admission.fields.floor')}
                            </label>
                            <div className="relative mb-3">
                                <Layers className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <select
                                    className="w-full ps-10 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    value={selectedFloor}
                                    onChange={(e) => {
                                        setSelectedFloor(e.target.value);
                                        update('numero_chambre', '');
                                    }}
                                >
                                    <option value="">{t('admission.selectFloor')}</option>
                                    {floors.map(floor => (
                                        <option key={floor.id} value={floor.id}>
                                            {floor.name} {floor.description ? `- ${floor.description}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('admission.fields.roomNumber')}
                            </label>
                            <div className="relative">
                                <Hash className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <select
                                    disabled={!selectedFloor}
                                    className="w-full ps-10 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    value={form.numero_chambre}
                                    onChange={(e) => update('numero_chambre', e.target.value)}
                                >
                                    <option value="">{t('admission.selectRoom')}</option>
                                    {rooms.map(room => (
                                        <option key={room.id} value={room.room_number}>{room.room_number}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('admission.fields.doctor')}
                            </label>
                            <div className="relative">
                                <Stethoscope className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <select
                                    className="w-full ps-10 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    value={form.medecin_traitant}
                                    onChange={(e) => update('medecin_traitant', e.target.value)}
                                >
                                    <option value="">{t('admission.selectDoctor')}</option>
                                    {doctors.map((doc: any) => (
                                        <option key={doc.id} value={doc.name}>{doc.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                {t('admission.fields.macRtls')}
                            </label>
                            <div className="relative flex gap-2">
                                <div className="relative flex-1">
                                    <CircuitBoard className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="text"
                                        className="w-full ps-10 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                        placeholder="AA:BB:CC:DD:EE:FF"
                                        value={form.mac_rtls}
                                        onChange={(e) => update('mac_rtls', e.target.value)}
                                    />
                                </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowScanner(true)}
                                        className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors flex items-center justify-center"
                                        title={t('admission.scanQr')}
                                    >
                                        <Scan className="h-5 w-5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowNfcScanner(true)}
                                        className="px-3 py-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 rounded-lg transition-colors flex items-center justify-center border border-blue-200 dark:border-blue-800"
                                        title={t('admission.nfc.title')}
                                    >
                                        <Wifi className="h-5 w-5" />
                                    </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 flex items-center justify-end gap-3">
                    {message && (
                        <span className={`text-sm ${message === t('admission.messages.savedEdit') || message === t('admission.messages.savedNew') ? 'text-green-600' : 'text-red-600'}`}>
                            {message}
                        </span>
                    )}
                    <button
                        type="button"
                        className="px-4 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        onClick={() => setView('list')}
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex items-center gap-2 px-6 py-2 bg-[#0096D6] hover:bg-[#007BB5] text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <Save className="h-5 w-5" />
                        )}
                        {t('common.save')}
                    </button>
                </div>
            </form>

            {/* QR Scanner Modal */}
            {showScanner && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admission.scanQrTitle')}</h3>
                            <button
                                onClick={() => setShowScanner(false)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                            >
                                <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="aspect-square relative rounded-xl overflow-hidden bg-black">
                                <Scanner
                                    onScan={handleScan}
                                    onError={handleError}
                                    components={{
                                        finder: true
                                    }}
                                    styles={{
                                        container: { width: '100%', height: '100%' }
                                    }}
                                />
                            </div>
                            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
                                {t('admission.scanQrInstruction')}
                            </p>
                        </div>
                    </div>
                </div>
            )}
            {/* NFC Scanner Modal */}
            {showNfcScanner && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('admission.nfc.title')}</h3>
                            <button
                                onClick={() => setShowNfcScanner(false)}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                            >
                                <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                            </button>
                        </div>
                        <div className="p-8 text-center">
                            <div className="mb-6 flex justify-center">
                                <div className={`p-6 rounded-full ${nfcStatus === 'connected' ? 'bg-blue-100 dark:bg-blue-900/30' : nfcStatus === 'reading' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'} animate-pulse`}>
                                    {nfcStatus === 'disconnected' ? (
                                        <WifiOff className="h-12 w-12 text-red-600" />
                                    ) : (
                                        <Wifi className="h-12 w-12 text-blue-600" />
                                    )}
                                </div>
                            </div>
                            
                            <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                                {nfcStatus === 'disconnected' ? t('admission.nfc.connectionError') : nfcStatus === 'reading' ? t('admission.nfc.tagReadSuccess') : t('admission.nfc.instruction')}
                            </h4>
                            
                            {nfcScanData && (
                                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600 text-start space-y-3 animate-fadeIn">
                                    <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-600">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tag Info Card</span>
                                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-bold">SUCCESS</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-gray-400 uppercase">UID</span>
                                            <span className="text-sm font-mono font-bold text-gray-700 dark:text-gray-200">{nfcScanData.uid}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-gray-400 uppercase">ATR</span>
                                            <span className="text-sm font-mono text-gray-600 dark:text-gray-400 truncate">{nfcScanData.atr}</span>
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-gray-400 uppercase">Standard</span>
                                            <span className="text-sm text-gray-600 dark:text-gray-400">{nfcScanData.standard}</span>
                                        </div>
                                        <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                            <div className="flex items-center gap-2 mb-1">
                                                <CircuitBoard className="h-4 w-4 text-blue-600" />
                                                <span className="text-[10px] text-blue-600 font-bold uppercase">Record 1 (Extracted MAC)</span>
                                            </div>
                                            <span className="text-lg font-mono font-bold text-blue-700 dark:text-blue-300">{nfcScanData.record1}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!nfcScanData && (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {nfcReaderName ? `${t('admission.nfc.readerReady')} : ${nfcReaderName}` : t('admission.nfc.readerMissing')}
                                </p>
                            )}

                            {nfcStatus === 'disconnected' && (
                                <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 rounded-lg text-xs text-start">
                                    {t('admission.nfc.connectionHelp') || "Assurez-vous que le serveur NFC est lancé sur votre machine locale (port 4000)."}
                                </div>
                            )}
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-end">
                            <button
                                onClick={() => setShowNfcScanner(false)}
                                className="px-4 py-2 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
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
