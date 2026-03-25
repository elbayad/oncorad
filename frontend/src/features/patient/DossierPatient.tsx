import { useMemo, useState, useEffect } from 'react';
import { Search, Loader2, Plus, Edit, Trash2, ChevronLeft, ChevronRight, ArrowLeft, Scan, X } from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { format } from 'date-fns';
import { fr, enUS, ar } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';


function getAuthHeaders() {
  const token = localStorage.getItem('clinicToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

type DossierPayload = Record<string, any>;

export default function DossierPatient() {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<'list' | 'form'>('list');
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const dateLocale = i18n.language === 'ar' ? ar : i18n.language === 'en' ? enUS : fr;

  // Pagination & Search
  const [limit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [form, setForm] = useState<DossierPayload>(initialFormState());
  const [lastId, setLastId] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  // Load patients on mount and when interactions change
  useEffect(() => {
    if (view === 'list') {
      fetchPatients();
    }
  }, [view, offset]); // Add searchQuery if you want auto-search, or keep manual

  async function fetchPatients(query = searchQuery) {
    setLoading(true);
    try {
      const url = `/api/dossiers?limit=${limit}&offset=${offset}${query ? `&identifiant_patient=${encodeURIComponent(query)}` : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      const json = await res.json();
      if (res.ok) {
        setPatients(json.data || []);
      } else {
        setMessage(t('dossierPatient.errors.loadError'));
      }
    } catch (err) {
      setMessage(t('common.loadingError'));
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setOffset(0);
    fetchPatients(searchQuery);
  }

  async function handleDelete(id: string) {
    if (!window.confirm(t('dossierPatient.deleteConfirm'))) return;
    try {
      const res = await fetch(`/api/dossiers/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setMessage(t('dossierPatient.messages.deleted'));
        fetchPatients();
      } else {
        const json = await res.json();
        setMessage(json.message || t('dossierPatient.errors.deleteError'));
      }
    } catch (err) {
      setMessage(t('dossierPatient.errors.deleteError'));
    }
  }

  function handleEdit(patient: any) {
    loadDossier(patient);
    setView('form');
  }

  function handleAddNew() {
    setForm(initialFormState());
    setLastId(null);
    setMessage(null);
    setView('form');
  }

  // ... Form Logic (statusBadge, update, loadDossier, handleSubmit) ...

  // Indicateurs de statut pour une lecture rapide (Optimal/Attention/Alerte)
  function statusBadge(metric: 'hr' | 'spo2' | 'fr' | 'temp' | 'gcs', raw: any) {
    const v = raw === '' || raw === undefined || raw === null ? NaN : Number(raw);
    const base = 'px-2 py-0.5 text-xs rounded-md ';
    if (Number.isNaN(v)) return { label: '—', cls: base + 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200' };
    if (metric === 'hr') {
      if (v >= 60 && v <= 100) return { label: t('dossierPatient.badges.optimal'), cls: base + 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' };
      if ((v >= 50 && v < 60) || (v > 100 && v <= 120)) return { label: t('dossierPatient.badges.warning'), cls: base + 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300' };
      return { label: t('dossierPatient.badges.alert'), cls: base + 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300' };
    }
    if (metric === 'spo2') {
      if (v >= 95) return { label: t('dossierPatient.badges.optimal'), cls: base + 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' };
      if (v >= 90 && v < 95) return { label: t('dossierPatient.badges.warning'), cls: base + 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300' };
      return { label: t('dossierPatient.badges.alert'), cls: base + 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300' };
    }
    if (metric === 'fr') {
      if (v >= 12 && v <= 20) return { label: t('dossierPatient.badges.optimal'), cls: base + 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' };
      if ((v >= 10 && v < 12) || (v > 20 && v <= 24)) return { label: t('dossierPatient.badges.warning'), cls: base + 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300' };
      return { label: t('dossierPatient.badges.alert'), cls: base + 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300' };
    }
    if (metric === 'temp') {
      if (v >= 36.0 && v <= 37.5) return { label: t('dossierPatient.badges.optimal'), cls: base + 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' };
      if ((v >= 37.6 && v <= 38.3) || (v >= 35.5 && v < 36.0)) return { label: t('dossierPatient.badges.warning'), cls: base + 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300' };
      return { label: t('dossierPatient.badges.alert'), cls: base + 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300' };
    }
    // gcs
    if (v >= 13) return { label: t('dossierPatient.badges.optimal'), cls: base + 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' };
    if (v >= 9 && v <= 12) return { label: t('dossierPatient.badges.warning'), cls: base + 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300' };
    return { label: t('dossierPatient.badges.alert'), cls: base + 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300' };
  }

  const badges = useMemo(() => ({
    hr: statusBadge('hr', form.frequence_cardiaque),
    spo2: statusBadge('spo2', form.saturation_o2),
    fr: statusBadge('fr', form.frequence_respiratoire),
    temp: statusBadge('temp', form.temperature),
    gcs: statusBadge('gcs', form.score_gcs),
  }), [form.frequence_cardiaque, form.saturation_o2, form.frequence_respiratoire, form.temperature, form.score_gcs]);

  function update(name: string, value: any) {
    setForm((f) => ({ ...f, [name]: value }));
  }

  const handleScan = (result: any) => {
    if (result) {
      // @yudiel/react-qr-scanner returns an array of results or a single objects depending on version/config.
      // Assuming default behavior which typically returns rawValue or matches type.
      // Let's handle generic structure.
      const text = result[0]?.rawValue || result?.text || result;
      if (text) {
        update('mac_rtls', text.toLowerCase());
        setShowScanner(false);
      }
    }
  };

  const handleError = (error: any) => {
    console.error(error);
  };

  function loadDossier(dossier: any) {
    const pression = dossier.pression_arterielle || '';
    setForm({
      age: dossier.age || '',
      sexe: dossier.sexe || 'M',
      pression_arterielle: pression,
      frequence_cardiaque: dossier.frequence_cardiaque || '',
      saturation_o2: dossier.saturation_o2 || '',
      frequence_respiratoire: dossier.frequence_respiratoire || '',
      temperature: dossier.temperature || '',
      score_gcs: dossier.score_gcs || '',
      douleur: dossier.douleur || '',
      glycémie_capillaire: dossier['glycémie_capillaire'] || '',
      unite_glycemie: dossier.unite_glycemie || 'mg/dL',
      ecg_realise: dossier.ecg_realise || false,
      heure_ecg: dossier.heure_ecg || '',
      symptomes_principaux: dossier.symptomes_principaux || '',
      allergies: dossier.allergies || '',
      antecedents_majeurs: dossier.antecedents_majeurs || '',
      gestes_effectues: dossier.gestes_effectues || '',
      medicaments_administres: dossier.medicaments_administres || '',
      voie_veineuse: dossier.voie_veineuse || '',
      evolution_douleur: dossier.evolution_douleur || '',
      localisation_prise_en_charge: dossier.localisation_prise_en_charge || '',
      heure_appel: dossier.heure_appel || '',
      depart_base: dossier.depart_base || '',
      arrivee_site: dossier.arrivee_site || '',
      depart_site: dossier.depart_site || '',
      arrivee_clinique: dossier.arrivee_clinique || '',
      identifiant_patient: dossier.identifiant_patient || '',
      patient_nom: dossier.patient_nom || '',
      patient_prenom: dossier.patient_prenom || '',
      observations_libres: dossier.observations_libres || '',
      mac_rtls: dossier.mac_rtls || ''
    });
    setLastId(dossier.id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/dossiers', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Erreur lors de la création');
      setLastId(json.data?.id || null);
      setMessage(t('dossierPatient.messages.saved'));
      // Note: We stay in form view to allow PDF download or further edits
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  }

  function initialFormState() {
    return {
      age: '',
      sexe: 'M',
      pression_arterielle: '',
      frequence_cardiaque: '',
      saturation_o2: '',
      frequence_respiratoire: '',
      temperature: '',
      score_gcs: '',
      douleur: '',
      glycémie_capillaire: '',
      unite_glycemie: 'mg/dL',
      ecg_realise: false,
      heure_ecg: '',
      symptomes_principaux: '',
      allergies: '',
      antecedents_majeurs: '',
      gestes_effectues: '',
      medicaments_administres: '',
      voie_veineuse: '',
      evolution_douleur: '',
      localisation_prise_en_charge: '',
      heure_appel: '',
      depart_base: '',
      arrivee_site: '',
      depart_site: '',
      arrivee_clinique: '',
      identifiant_patient: '',
      patient_nom: '',
      patient_prenom: '',
      observations_libres: '',
      mac_rtls: ''
    };
  }

  if (view === 'list') {
    return (
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('dossierPatient.titles.main')}</h1>
            <p className="text-gray-500 dark:text-gray-400">{t('dossierPatient.titles.listSubtitle')}</p>
          </div>
          <button
            onClick={handleAddNew}
            className="flex items-center space-x-2 bg-[#0096D6] hover:bg-[#007BB5] text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>{t('dossierPatient.buttons.newDossier')}</span>
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Search Bar */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder={t('dossierPatient.placeholders.search')}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button type="submit" className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                {t('common.search')}
              </button>
            </form>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('dossierPatient.table.headers.id')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.patient')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.vitals')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.status')}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      <div className="flex justify-center items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> {t('common.loading')}
                      </div>
                    </td>
                  </tr>
                ) : patients.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">{t('dossierPatient.noData')}</td>
                  </tr>
                ) : (
                  patients.map((patient) => (
                    <tr key={patient.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-medium text-gray-900 dark:text-white">{patient.identifiant_patient || t('common.unidentified')}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white uppercase">
                          {patient.patient_nom} {patient.patient_prenom}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {patient.age} {t('common.years')} • {patient.sexe}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-wrap gap-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                            TA: {patient.pression_arterielle}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                            SpO₂: {patient.saturation_o2}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {patient.date_creation ? format(new Date(patient.date_creation), 'dd/MM/yyyy HH:mm', { locale: dateLocale }) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button onClick={() => handleEdit(patient)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 p-1">
                            <Edit className="h-4 w-4" />
                          </button>
                          <button onClick={() => handleDelete(patient.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 p-1">
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

          {/* Pagination */}
          {patients.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-900/50 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))} className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
                  {t('common.pagination.previous')}
                </button>
                <button disabled={patients.length < limit} onClick={() => setOffset(offset + limit)} className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
                  {t('common.pagination.next')}
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {t('common.pagination.showing')} <span className="font-medium">{offset + 1}</span> {t('common.pagination.to')} <span className="font-medium">{offset + patients.length}</span> {t('common.pagination.results')}
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setOffset(Math.max(0, offset - limit))}
                      disabled={offset === 0}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                    >
                      <span className="sr-only">{t('common.pagination.previous')}</span>
                      <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <button
                      onClick={() => setOffset(offset + limit)}
                      disabled={patients.length < limit}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
                    >
                      <span className="sr-only">{t('common.pagination.next')}</span>
                      <ChevronRight className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Form View (Basically what was there before, but wrapped)
  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center space-x-4 mb-4">
        <button
          onClick={() => {
            setView('list');
            fetchPatients(); // refresh list on return
          }}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft className="h-6 w-6 text-gray-600 dark:text-gray-300" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {lastId ? t('dossierPatient.titles.editDossier') : t('dossierPatient.titles.newDossier')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('dossierPatient.titles.formSubtitle')}</p>
        </div>
      </div>

      <div className="flex justify-end gap-2 mb-4">
        <button
          disabled={loading}
          className="px-3 py-2 rounded-lg bg-[#0096D6] text-white hover:bg-[#007BB5] disabled:opacity-50"
          onClick={(e) => handleSubmit(e as any)}
          type="button"
        >
          {loading ? t('common.loading') : t('common.save')}
        </button>
        <button
          type="button"
          disabled={!lastId}
          className="px-3 py-2 rounded-lg bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100 disabled:opacity-50"
          onClick={async () => {
            if (!lastId) return;
            const token = localStorage.getItem('clinicToken');
            const res = await fetch(`/api/dossiers/${lastId}/pdf?email=false`, {
              method: 'POST',
              headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'rapport_intervention.pdf';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
          }}
        >
          {t('dossierPatient.buttons.downloadPdf')}
        </button>
        <button
          type="button"
          disabled={!lastId}
          className="px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          onClick={async () => {
            if (!lastId) return;
            const token = localStorage.getItem('clinicToken');
            const res = await fetch(`/api/dossiers/${lastId}/pdf?email=true`, {
              method: 'POST',
              headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            const json = await res.json();
            setMessage(json?.message || 'PDF envoyé');
          }}
        >
          {t('dossierPatient.buttons.sendEmail')}
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${message.includes('succès') || message.includes('supprimé') ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm p-4 md:p-6">
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-1">{t('common.lastName')}</label>
            <input className="input w-full bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed" value={form.patient_nom || ''} readOnly />
          </div>
          <div>
            <label className="block text-sm mb-1">{t('common.firstName')}</label>
            <input className="input w-full bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed" value={form.patient_prenom || ''} readOnly />
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1">{t('dossierPatient.form.labels.patientId')}</label>
          <input className="input w-full bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed" value={form.identifiant_patient} readOnly />
        </div>

        <div>
          <label className="block text-sm mb-1">{t('dossierPatient.form.labels.macRtls')}</label>
          <div className="relative flex gap-2">
            <input className="input w-full bg-white dark:bg-gray-700 border-blue-500 shadow-[0_0_0_2px_rgba(59,130,246,0.1)] h-12"
              placeholder="AA:BB:CC:DD:EE:FF"
              value={form.mac_rtls}
              onChange={(e) => update('mac_rtls', e.target.value)} />
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors flex items-center justify-center border border-gray-200 dark:border-gray-600"
              title={t('dossierPatient.buttons.scanQr')}
            >
              <Scan className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm mb-1">{t('common.ageThreshold')}</label>
          <input type="number" className="input w-full bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed" value={form.age} readOnly />
        </div>

        <div>
          <label className="block text-sm mb-1">{t('common.sex')}</label>
          <input className="input w-full bg-gray-50 dark:bg-gray-900/50 cursor-not-allowed" value={form.sexe} readOnly />
        </div>
        <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-3 bg-blue-50/30 dark:bg-blue-900/10">
          <label className="block text-sm font-semibold mb-1 text-blue-700 dark:text-blue-300">{t('dossierPatient.form.labels.consultation')}</label>
          <textarea className="input w-full h-32 text-base border-blue-200 dark:border-blue-800 focus:ring-blue-500" placeholder={t('dossierPatient.form.placeholders.consultation')} value={form.observations_libres}
            onChange={(e) => update('observations_libres', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">{t('common.bloodPressure')} (sys/dia)</label>
          <input placeholder="120/75" className="input w-full" value={form.pression_arterielle}
            onChange={(e) => update('pression_arterielle', e.target.value)} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm">{t('dossierPatient.form.labels.hr')} (30–220)</label>
            <span className={badges.hr.cls}>{badges.hr.label}</span>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <input type="range" min={30} max={220} value={form.frequence_cardiaque || 30}
              onChange={(e) => update('frequence_cardiaque', Number(e.target.value))}
              className="w-full" />
            <input type="number" className="input w-24 text-center" value={form.frequence_cardiaque}
              onChange={(e) => update('frequence_cardiaque', Number(e.target.value))} />
            <span className="text-xs text-gray-500">bpm</span>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm">{t('dossierPatient.form.labels.spo2')} (50–100)</label>
            <span className={badges.spo2.cls}>{badges.spo2.label}</span>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <input type="range" min={50} max={100} value={form.saturation_o2 || 50}
              onChange={(e) => update('saturation_o2', Number(e.target.value))}
              className="w-full" />
            <input type="number" className="input w-24 text-center" value={form.saturation_o2}
              onChange={(e) => update('saturation_o2', Number(e.target.value))} />
            <span className="text-xs text-gray-500">%</span>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm">{t('dossierPatient.form.labels.fr')} (6–40)</label>
            <span className={badges.fr.cls}>{badges.fr.label}</span>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <input type="range" min={6} max={40} value={form.frequence_respiratoire || 6}
              onChange={(e) => update('frequence_respiratoire', Number(e.target.value))}
              className="w-full" />
            <input type="number" className="input w-24 text-center" value={form.frequence_respiratoire}
              onChange={(e) => update('frequence_respiratoire', Number(e.target.value))} />
            <span className="text-xs text-gray-500">/min</span>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm">{t('dossierPatient.form.labels.temperature')} (°C)</label>
            <span className={badges.temp.cls}>{badges.temp.label}</span>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <input type="range" min={32.0} max={42.0} step={0.1} value={Number(form.temperature || 36.5)}
              onChange={(e) => update('temperature', Number(e.target.value))}
              className="w-full" />
            <input type="number" step={0.1} className="input w-24 text-center" value={form.temperature}
              onChange={(e) => update('temperature', Number(e.target.value))} />
            <span className="text-xs text-gray-500">°C</span>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="block text-sm">{t('dossierPatient.form.labels.gcs')} (3–15)</label>
            <span className={badges.gcs.cls}>{badges.gcs.label}</span>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <input type="range" min={3} max={15} value={form.score_gcs || 15}
              onChange={(e) => update('score_gcs', Number(e.target.value))}
              className="w-full" />
            <input type="number" className="input w-24 text-center" value={form.score_gcs}
              onChange={(e) => update('score_gcs', Number(e.target.value))} />
            <span className="text-xs text-gray-500">/15</span>
          </div>
        </div>
        <div>
          <label className="block text-sm">{t('dossierPatient.form.labels.pain')} (0–10)</label>
          <div className="flex items-center gap-3 mt-2">
            <input type="range" min={0} max={10} value={form.douleur || 0}
              onChange={(e) => update('douleur', Number(e.target.value))}
              className="w-full" />
            <input type="number" className="input w-24 text-center" value={form.douleur}
              onChange={(e) => update('douleur', Number(e.target.value))} />
            <span className="text-xs text-gray-500">/10</span>
          </div>
        </div>
        <div className="md:col-span-2 grid grid-cols-3 gap-2 items-end">
          <div>
            <label className="block text-sm mb-1">{t('dossierPatient.form.labels.glycemia')}</label>
            <input type="number" step="0.1" className="input w-full" value={form['glycémie_capillaire']}
              onChange={(e) => update('glycémie_capillaire', e.target.value ? Number(e.target.value) : '')} />
          </div>
          <div>
            <label className="block text-sm mb-1">{t('dossierPatient.form.labels.unit')}</label>
            <select className="input w-full" value={form.unite_glycemie}
              onChange={(e) => update('unite_glycemie', e.target.value)}>
              <option>mg/dL</option>
              <option>mmol/L</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">{t('dossierPatient.form.labels.ecgDone')}</label>
            <select className="input w-full" value={form.ecg_realise ? 'true' : 'false'}
              onChange={(e) => update('ecg_realise', e.target.value === 'true')}>
              <option value="false">{t('common.no')}</option>
              <option value="true">{t('common.yes')}</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm mb-1">{t('dossierPatient.form.labels.ecgTime')} (hh:mm)</label>
          <input type="time" className="input w-full" value={form.heure_ecg}
            onChange={(e) => update('heure_ecg', e.target.value)} />
        </div>
        <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-3">
          <label className="block text-sm mb-1">{t('dossierPatient.form.labels.symptoms')}</label>
          <input className="input w-full h-12 text-base" placeholder={t('dossierPatient.form.placeholders.symptoms')} value={form.symptomes_principaux}
            onChange={(e) => update('symptomes_principaux', e.target.value)} />
        </div>
        <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-3">
          <label className="block text-sm mb-1">{t('dossierPatient.form.labels.allergies')}</label>
          <input className="input w-full h-12 text-base" placeholder={t('dossierPatient.form.placeholders.allergies')} value={form.allergies}
            onChange={(e) => update('allergies', e.target.value)} />
        </div>
        <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-3">
          <label className="block text-sm mb-1">{t('dossierPatient.form.labels.history')}</label>
          <input className="input w-full h-12 text-base" placeholder={t('dossierPatient.form.placeholders.history')} value={form.antecedents_majeurs}
            onChange={(e) => update('antecedents_majeurs', e.target.value)} />
        </div>
        <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-3">
          <label className="block text-sm mb-1">{t('dossierPatient.form.labels.procedures')}</label>
          <input className="input w-full h-12 text-base" placeholder={t('dossierPatient.form.placeholders.procedures')} value={form.gestes_effectues}
            onChange={(e) => update('gestes_effectues', e.target.value)} />
        </div>
        <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-3">
          <label className="block text-sm mb-1">{t('dossierPatient.form.labels.medications')}</label>
          <input className="input w-full h-12 text-base" placeholder={t('dossierPatient.form.placeholders.medications')} value={form.medicaments_administres}
            onChange={(e) => update('medicaments_administres', e.target.value)} />
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-3">
          <label className="block text-sm mb-1">{t('dossierPatient.form.labels.venousAccess')}</label>
          <input className="input w-full h-12 text-base" placeholder={t('dossierPatient.form.placeholders.venousAccess')} value={form.voie_veineuse}
            onChange={(e) => update('voie_veineuse', e.target.value)} />
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-3">
          <label className="block text-sm mb-1">{t('dossierPatient.form.labels.painEvolution')}</label>
          <input className="input w-full h-12 text-base" placeholder={t('dossierPatient.form.placeholders.painEvolution')} value={form.evolution_douleur}
            onChange={(e) => update('evolution_douleur', e.target.value)} />
        </div>
        <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-3">
          <label className="block text-sm mb-1">{t('dossierPatient.form.labels.careLocation')}</label>
          <input className="input w-full h-12 text-base" placeholder={t('dossierPatient.form.placeholders.careLocation')} value={form.localisation_prise_en_charge}
            onChange={(e) => update('localisation_prise_en_charge', e.target.value)} />
        </div>
      </form>

      {/* QR Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('dossierPatient.scanner.title')}</h3>
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
                {t('dossierPatient.scanner.snippet')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
