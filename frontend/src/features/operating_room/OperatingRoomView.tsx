import { useState, useEffect } from 'react';
import { Shield, FileText, Activity, MapPin, Stethoscope, AlertOctagon, CheckCircle, X, AlertTriangle, Heart, Thermometer, Zap, Droplets } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Mock Data Types
interface Vitals {
    hr: number;
    bp_sys: number;
    bp_dia: number;
    spo2: number;
    temp?: number;
    gcs?: number;
    last_updated: string;
}

interface EpisodeData {
    id: string;
    context: 'admission' | 'ambulance' | 'mixed';
    status: 'active' | 'closed';
    rtls_status: 'connected' | 'lost';
    patient: {
        id_patient?: string;
        nom?: string;
        prenom?: string;
        sexe: 'M' | 'F';
        age: number;
        dob?: string;
        is_identified: boolean;
    };
    alerts: {
        level: 'critical' | 'warning' | 'safe';
        list: string[];
    };
    clinical: {
        reason: string;
        vitals: Vitals;
        allergies: string[];
        medications: string[];
        procedures: string[];
        risks: string[];
    };
    admission?: {
        room: string;
        floor: string;
        doctor: string;
    };
    realtime?: {
        room: string | null;
        floor: string | null;
    } | null;
    intervention?: {
        title: string;
        time: string; // ISO string
        protocol_available: boolean;
        dicom_available: boolean;
        consent: boolean;
    };
}



export default function OperatingRoomView() {
    const [episode, setEpisode] = useState<EpisodeData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showDetails, setShowDetails] = useState(false);
    const { t } = useTranslation();
    const [currentTime, setCurrentTime] = useState(new Date());

    const openFullscreen = () => {
        const docEl = document.documentElement as any;
        if (docEl.requestFullscreen) {
            docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) { /* Safari */
            docEl.webkitRequestFullscreen();
        } else if (docEl.msRequestFullscreen) { /* IE11 */
            docEl.msRequestFullscreen();
        }
    };

    // Output for Demo/Kiosk
    const getInitialRoom = () => {
        const urlRoom = new URLSearchParams(window.location.search).get('room');
        if (urlRoom) {
            localStorage.setItem('room_choice', urlRoom);
            return urlRoom;
        }
        return localStorage.getItem('room_choice');
    };
    const roomMode = getInitialRoom();

    // Fetch Data
    useEffect(() => {
        let pollInterval: NodeJS.Timeout;

        const fetchEpisode = async () => {
            const params = new URLSearchParams(window.location.search);
            const id = params.get('episodeId');
            let room = params.get('room');

            if (!room) {
                room = localStorage.getItem('room_choice');
            }

            // MODE 1: Fixed Episode ID (Manual)
            if (id) {
                try {
                    const token = localStorage.getItem('clinicToken');
                    const res = await fetch(`/api/episodes/${id}/context`, {
                        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                    });
                    const json = await res.json();
                    if (json.success) {
                        setEpisode(json.data);
                        setLoading(false);
                    } else {
                        setError(json.message);
                        setLoading(false);
                    }
                } catch (err) {
                    console.error(err);
                    setError(t('common.loadingError'));
                    setLoading(false);
                }
                return;
            }

            // MODE 2: Kiosk Mode (Room Based)
            if (room) {
                try {
                    const token = localStorage.getItem('clinicToken');
                    const res = await fetch(`/api/episodes/current/room/${room}`, {
                        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                    });
                    const json = await res.json();

                    if (json.success && json.data?.episodeId) {
                        // Found a patient! Now fetch context
                        // Optimization: We could have the context in the first call, 
                        // but reusing logic is safer for now.
                        if (episode?.id !== json.data.episodeId) {
                            const ctxRes = await fetch(`/api/episodes/${json.data.episodeId}/context`, {
                                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                            });
                            const ctxJson = await ctxRes.json();
                            if (ctxJson.success) {
                                setEpisode(ctxJson.data);
                            }
                        }
                    } else {
                        // No patient in room
                        setEpisode(null);
                    }
                } catch (err) {
                    console.error(err);
                } finally {
                    setLoading(false);
                }
                return;
            }

            // Default: No params -> Show No Episode Selected
            setEpisode(null);
            setLoading(false);
        };

        fetchEpisode();

        // Start Polling if in Room Mode
        const activeRoom = new URLSearchParams(window.location.search).get('room') || localStorage.getItem('room_choice');
        if (activeRoom) {
            pollInterval = setInterval(fetchEpisode, 5000); // Poll every 5s
        }

        return () => {
            if (pollInterval) clearInterval(pollInterval);
        };
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        // Optionnel : Tenter le plein écran au chargement (souvent bloqué par les navigateurs sans interaction)
        const handleFirstInteraction = () => {
            openFullscreen();
            document.removeEventListener('click', handleFirstInteraction);
        };
        document.addEventListener('click', handleFirstInteraction);
        return () => document.removeEventListener('click', handleFirstInteraction);
    }, []);

    if (loading) return <div className="h-screen flex items-center justify-center bg-gray-900 text-white animate-pulse">{t('common.loading')}...</div>;
    if (error) return <div className="h-screen flex items-center justify-center bg-gray-900 text-red-500 font-bold">{error}</div>;

    // Standby Screen for Kiosk Mode
    if (!episode && roomMode) return (
        <div className="h-screen flex flex-col items-center justify-center bg-gray-900 text-white">
            <Activity className="h-24 w-24 text-blue-600 mb-6 animate-pulse" />
            <h1 className="text-4xl font-bold mb-2">{t('operatingRoom.titles.main')}</h1>
            <div className="bg-blue-900 px-6 py-2 rounded-full text-xl font-mono mb-8">{roomMode}</div>
            <p className="text-xl text-gray-400 animate-pulse">{t('operatingRoom.waitingForDetection')}</p>
        </div>
    );

    if (!episode) return (
        <div className="h-screen flex flex-col items-center justify-center bg-gray-900 text-white gap-4">
            <Activity className="h-16 w-16 text-gray-700" />
            <h1 className="text-2xl font-bold">{t('operatingRoom.noEpisodeSelected')}</h1>
            <p className="text-gray-400">{t('operatingRoom.scanPatientSnippet')}</p>
        </div>
    );

    // Safety Color Logic
    const getSafetyColor = (level: string) => {
        switch (level) {
            case 'critical': return 'bg-red-600 text-white animate-pulse';
            case 'warning': return 'bg-orange-500 text-white';
            case 'safe': return 'bg-green-600 text-white';
            default: return 'bg-gray-600 text-white';
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans">

            {/* 1. HEADER FIXE - SÉCURITÉ */}
            <header className="sticky top-0 z-50 bg-white dark:bg-gray-800 shadow-lg border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-stretch h-20">

                    {/* Room Badge */}
                    <div className="w-24 bg-blue-900 text-white flex flex-col items-center justify-center font-bold cursor-pointer hover:bg-blue-800 transition-colors"
                        onClick={() => {
                            const newRoom = prompt(t('rtls.selectFloor'), roomMode || 'Bloc1');
                            if (newRoom) {
                                localStorage.setItem('room_choice', newRoom);
                                window.location.search = `?room=${newRoom}`;
                            }
                        }}
                        title={t('common.change')}
                    >
                        <span className="text-xs opacity-70">{t('common.operatingRoomShort')}</span>
                        <span className="text-xl uppercase break-all px-1 text-center">
                            {episode?.realtime?.room || episode?.admission?.room || roomMode || '--'}
                        </span>
                        <div className="text-[10px] opacity-40 font-light mt-1 uppercase">{t('common.change')}</div>
                    </div>

                    {/* Episode Info */}
                    <div className="flex-1 flex items-center px-6 justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold ${episode?.rtls_status === 'connected' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                <Activity className={`h-4 w-4 ${episode?.rtls_status === 'connected' ? 'animate-pulse' : ''}`} />
                                {episode?.rtls_status === 'connected' ? t('rtls.status.connected') : t('rtls.status.lost')}
                            </div>
                            {episode && <span className="text-gray-400 font-mono text-sm">{t('common.episode')}: {episode.id}</span>}
                        </div>
                        <div className="text-xl font-bold text-gray-700 dark:text-gray-300 flex items-center gap-4">
                            {currentTime.toLocaleTimeString()}
                            <button
                                onClick={openFullscreen}
                                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors border border-gray-200 dark:border-gray-600"
                                title="Plein écran"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Safety Band */}
                    <div className={`w-1/3 flex items-center justify-center px-6 gap-3 ${getSafetyColor(episode.alerts.level)} transition-colors duration-500`}>
                        {episode.alerts.level === 'critical' ? <AlertOctagon className="h-8 w-8" /> : <Shield className="h-8 w-8" />}
                        <span className="text-xl font-black uppercase tracking-wider text-center">
                            {episode.alerts.list[0] || t('operatingRoom.safetyConfirmed')}
                        </span>
                        {episode.alerts.list.length > 1 && (
                            <span className="bg-white/20 px-2 py-0.5 rounded text-xs">+{episode.alerts.list.length - 1}</span>
                        )}
                    </div>
                </div>
            </header>

            <main className="p-6 grid grid-cols-12 gap-6 max-w-[1920px] mx-auto h-[calc(100vh-5rem)]">

                {/* MAIN CONTENT AREA */}
                <div className="col-span-12 flex flex-col gap-6">
                    <div className="grid grid-cols-12 gap-6">
                        {/* LEFT: IDENTITY (5 Cols) */}
                        <div className="col-span-5 flex flex-col gap-6">
                            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl p-8 border-t-8 border-blue-600 relative overflow-hidden flex flex-col justify-center min-h-[400px]">
                                {!episode.patient.is_identified && (
                                    <div className="absolute top-0 right-0 bg-red-600 text-white text-sm px-4 py-2 font-bold rounded-bl-2xl">
                                        {t('common.unidentified')}
                                    </div>
                                )}

                                <div className="flex flex-col items-center text-center gap-6 py-4">
                                    <div className="h-40 w-40 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-6xl font-black text-blue-600 border-4 border-white dark:border-gray-700 shadow-inner">
                                        {episode.patient.is_identified ? episode.patient.nom?.[0] : '?'}
                                    </div>
                                    <div>
                                        <h2 className="text-4xl font-black text-gray-900 dark:text-white leading-tight mb-2">
                                            {episode.patient.is_identified ? (
                                                <>{episode.patient.nom} <span className="font-light">{episode.patient.prenom}</span></>
                                            ) : t('common.patientUnknown')}
                                        </h2>
                                        <div className="text-xl text-gray-500 dark:text-gray-400 flex items-center justify-center gap-4">
                                            <span className="font-bold text-blue-600 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-lg">{episode.patient.sexe}</span>
                                            <span>{episode.patient.age} {t('common.years')}</span>
                                            <span className="opacity-30">|</span>
                                            <span>{episode.patient.dob ? new Date(episode.patient.dob).toLocaleDateString('fr-FR') : '--/--/----'}</span>
                                        </div>
                                    </div>
                                </div>

                                {episode.patient.id_patient && (
                                    <div className="mt-8 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl font-mono text-lg text-gray-600 dark:text-gray-400 flex justify-between border border-gray-100 dark:border-gray-700">
                                        <span className="flex items-center gap-2"><FileText className="h-5 w-5 opacity-50" /> IPP: {episode.patient.id_patient}</span>
                                        <span className="text-blue-600 font-bold uppercase">{t(`common.contexts.${episode.context}`)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* RIGHT: PROVENANCE (7 Cols) */}
                        <div className="col-span-7 flex flex-col gap-6">
                            {episode.admission && (
                                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg p-8 border border-gray-100 dark:border-gray-700 flex-1 flex flex-col justify-center">
                                    <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-10 flex items-center gap-3">
                                        <MapPin className="h-6 w-6 text-blue-500" /> {t('common.provenance')}
                                    </h3>
                                    <div className="grid grid-cols-2 gap-12">
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-tighter">{t('common.location')}</label>
                                            <div className="text-3xl font-black text-blue-600 dark:text-blue-400 flex flex-col">
                                                <span>{episode.realtime?.floor || episode.admission.floor} - {episode.realtime?.room || episode.admission.room}</span>
                                                {episode.realtime?.room && episode.realtime.room !== episode.admission.room && (
                                                    <span className="text-sm font-medium text-amber-500 mt-1 italic">
                                                        (Admission: {episode.admission.room})
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-xs font-bold text-gray-400 uppercase tracking-tighter">{t('common.attendingDoctor')}</label>
                                            <div className="flex items-center gap-3 text-2xl font-bold text-gray-800 dark:text-gray-200">
                                                <Stethoscope className="h-8 w-8 text-blue-500" />
                                                {episode.admission.doctor}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* LARGE ACTIONS BOTTOM */}
                    <div className="grid grid-cols-12 gap-6 pt-4">
                        <button
                            onClick={() => setShowDetails(true)}
                            className="col-span-12 group py-8 bg-gray-900 dark:bg-black hover:bg-black text-white rounded-3xl font-black text-3xl shadow-2xl transition-all transform active:scale-[0.98] flex items-center justify-center gap-6 border-b-8 border-gray-700"
                        >
                            <FileText className="h-10 w-10 text-blue-500 transform group-hover:rotate-6 transition-transform" />
                            {t('operatingRoom.openFullFile')}
                        </button>

                    </div>
                </div>

            </main>

            {/* FULL DOSSIER MODAL */}
            {showDetails && episode && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-10">
                    <div className="bg-white dark:bg-gray-800 rounded-[40px] shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col border border-white/10">
                        {/* Modal Header */}
                        <div className="p-8 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50">
                            <div className="flex items-center gap-4">
                                <div className="h-14 w-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white">
                                    <FileText className="h-8 w-8" />
                                </div>
                                <div>
                                    <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase">
                                        {t('operatingRoom.openFullFile')}
                                    </h2>
                                    <p className="text-gray-500 font-medium">
                                        Patient: {episode.patient.nom} {episode.patient.prenom} • IPP: {episode.patient.id_patient}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowDetails(false)}
                                className="p-4 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 rounded-2xl transition-all"
                            >
                                <X className="h-10 w-10" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                            <div className="grid grid-cols-12 gap-8">

                                {/* 1. VITALS GRID */}
                                <div className="col-span-12">
                                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Activity className="h-4 w-4" /> {t('common.vitals')}
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                        <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-3xl border border-red-100 dark:border-red-900/20 flex flex-col items-center gap-2">
                                            <Heart className="h-8 w-8 text-red-500" />
                                            <span className="text-xs font-bold text-red-400 uppercase">FC (BPM)</span>
                                            <span className="text-4xl font-black text-red-600">{episode.clinical.vitals.hr}</span>
                                        </div>
                                        <div className="bg-blue-50 dark:bg-blue-900/10 p-6 rounded-3xl border border-blue-100 dark:border-blue-900/20 flex flex-col items-center gap-2">
                                            <Droplets className="h-8 w-8 text-blue-500" />
                                            <span className="text-xs font-bold text-blue-400 uppercase">SpO2 (%)</span>
                                            <span className="text-4xl font-black text-blue-600">{episode.clinical.vitals.spo2}</span>
                                        </div>
                                        <div className="bg-purple-50 dark:bg-purple-900/10 p-6 rounded-3xl border border-purple-100 dark:border-purple-900/20 flex flex-col items-center gap-2">
                                            <Zap className="h-8 w-8 text-purple-500" />
                                            <span className="text-xs font-bold text-purple-400 uppercase">PA (SYS/DIA)</span>
                                            <span className="text-3xl font-black text-purple-600">{episode.clinical.vitals.bp_sys}/{episode.clinical.vitals.bp_dia}</span>
                                        </div>
                                        <div className="bg-orange-50 dark:bg-orange-900/10 p-6 rounded-3xl border border-orange-100 dark:border-orange-900/20 flex flex-col items-center gap-2">
                                            <Thermometer className="h-8 w-8 text-orange-500" />
                                            <span className="text-xs font-bold text-orange-400 uppercase">TEMP (°C)</span>
                                            <span className="text-4xl font-black text-orange-600">{episode.clinical.vitals.temp || '--'}</span>
                                        </div>
                                        <div className="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-900/20 flex flex-col items-center gap-2">
                                            <Activity className="h-8 w-8 text-emerald-500" />
                                            <span className="text-xs font-bold text-emerald-400 uppercase">GCS</span>
                                            <span className="text-4xl font-black text-emerald-600">{episode.clinical.vitals.gcs || '--'}</span>
                                        </div>
                                        <div className="bg-gray-50 dark:bg-gray-900/30 p-6 rounded-3xl border border-gray-100 dark:border-gray-700 flex items-center justify-center text-center">
                                            <div className="text-[10px] text-gray-400 font-mono">
                                                MAJ: {new Date(episode.clinical.vitals.last_updated).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. ALERTS & RISKS (Full Width) */}
                                {episode.alerts.list.length > 0 && (
                                    <div className="col-span-12">
                                        <div className="bg-red-600 text-white p-6 rounded-3xl shadow-xl flex items-start gap-4">
                                            <AlertOctagon className="h-10 w-10 shrink-0" />
                                            <div>
                                                <h4 className="text-lg font-black uppercase tracking-wider mb-2">{t('operatingRoom.modal.criticalAlerts')}</h4>
                                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                                                    {episode.alerts.list.map((alert, i) => (
                                                        <li key={i} className="flex items-center gap-2 font-bold bg-white/10 px-3 py-1 rounded-lg">
                                                            <AlertTriangle className="h-4 w-4" /> {alert}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 3. CLINICAL DETAILS */}
                                <div className="col-span-12 md:col-span-6 space-y-6">
                                    <div className="bg-gray-50 dark:bg-gray-900/50 p-8 rounded-[32px] border border-gray-100 dark:border-gray-700 h-full">
                                        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                            <Shield className="h-5 w-5 text-red-500" /> {t('operatingRoom.modal.allergiesTitle')}
                                        </h3>
                                        <div className="flex flex-wrap gap-3">
                                            {episode.clinical.allergies.length > 0 ? (
                                                episode.clinical.allergies.map((a, i) => (
                                                    <span key={i} className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-4 py-2 rounded-xl font-bold text-lg border border-red-200 dark:border-red-900/50">
                                                        {a}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-emerald-500 font-bold italic">{t('operatingRoom.modal.noAllergies')}</span>
                                            )}
                                        </div>

                                        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mt-10 mb-6 flex items-center gap-2">
                                            <Droplets className="h-5 w-5 text-blue-500" /> {t('operatingRoom.modal.treatmentsTitle')}
                                        </h3>
                                        <ul className="space-y-3">
                                            {episode.clinical.medications.map((m, i) => (
                                                <li key={i} className="flex items-center gap-3 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                                                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                                                    <span className="font-semibold">{m}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>

                                <div className="col-span-12 md:col-span-6 space-y-6">
                                    <div className="bg-gray-50 dark:bg-gray-900/50 p-8 rounded-[32px] border border-gray-100 dark:border-gray-700 h-full">
                                        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                            <CheckCircle className="h-5 w-5 text-emerald-500" /> {t('operatingRoom.modal.proceduresTitle')}
                                        </h3>
                                        <ul className="space-y-3">
                                            {episode.clinical.procedures.map((p, i) => (
                                                <li key={i} className="flex items-center gap-3 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                                                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                                    <span className="font-semibold text-gray-700 dark:text-gray-300">{p}</span>
                                                </li>
                                            ))}
                                        </ul>

                                        <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mt-10 mb-6 flex items-center gap-2">
                                            <Stethoscope className="h-5 w-5 text-purple-500" /> {t('operatingRoom.modal.reasonTitle')}
                                        </h3>
                                        <p className="text-xl font-bold text-gray-800 dark:text-gray-200 leading-relaxed bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                            {episode.clinical.reason}
                                        </p>
                                    </div>
                                </div>

                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-8 bg-gray-50 dark:bg-gray-900/50 flex justify-end gap-4 border-t border-gray-100 dark:border-gray-700">
                            <button
                                onClick={() => setShowDetails(false)}
                                className="px-10 py-4 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-100 rounded-2xl font-black uppercase text-sm transition-all shadow-sm"
                            >
                                {t('operatingRoom.modal.close')}
                            </button>
                            <button className="px-10 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase text-sm transition-all shadow-lg shadow-blue-900/20 active:scale-95">
                                {t('operatingRoom.modal.print')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
