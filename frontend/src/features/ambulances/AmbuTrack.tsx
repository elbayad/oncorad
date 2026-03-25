import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import {
  Ambulance,
  MapPin,
  Phone,
  Clock,
  Users,
  Route,
  AlertTriangle,
  CheckCircle,
  Navigation,
  Activity,
  UserPlus
} from 'lucide-react';
import InterventionForm from './InterventionForm';
import PatientDrawer from './PatientDrawer';

interface Ambulance {
  id: string;
  callSign: string;
  status: 'available' | 'en-route' | 'on-scene' | 'transport' | 'maintenance';
  crew: string[];
  currentLocation: {
    lat: number;
    lng: number;
    address: string;
  };
  mission?: {
    id: string;
    type: 'emergency' | 'transfer' | 'routine';
    priority: 'high' | 'medium' | 'low';
    destination: string;
    eta: string;
    patient: string;
  };
  // Champs pour l'API
  last_latitude?: number;
  last_longitude?: number;
  imei_tablette?: string;
  last_updated?: string;
}

export default function AmbuTrack() {
  const { t, i18n } = useTranslation();
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);
  const [selectedAmbulance, setSelectedAmbulance] = useState<string | null>(null);
  const [fullMap, setFullMap] = useState<boolean>(false);
  const [isInterventionFormOpen, setIsInterventionFormOpen] = useState(false);
  const [selectedAmbulanceForIntervention, setSelectedAmbulanceForIntervention] = useState<Ambulance | null>(null);
  const [loading, setLoading] = useState(true);
  const [navigateToAmbulance, setNavigateToAmbulance] = useState<string | null>(null);

  // Patient Drawer State
  const [isPatientDrawerOpen, setIsPatientDrawerOpen] = useState(false);
  const [selectedAmbulanceForAssign, setSelectedAmbulanceForAssign] = useState<string | null>(null);

  // Charger les ambulances depuis l'API
  useEffect(() => {
    const fetchAmbulances = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/ambulances');
        if (response.data.success) {
          // Debug: vérifier la première ambulance pour voir tous les champs disponibles
          if (response.data.data && response.data.data.length > 0) {
          }

          // Debug: vérifier le nombre d'ambulances reçues

          if (!response.data.data || response.data.data.length === 0) {
            setAmbulances([]);
            return;
          }

          // Mapper les données de l'API vers le format attendu
          const mappedAmbulances: Ambulance[] = response.data.data.map((amb: any) => {
            const lat = amb.last_latitude || amb.current_lat;
            const lng = amb.last_longitude || amb.current_lng;

            // Removed debug code

            return {
              id: amb.id,
              callSign: amb.call_sign || amb.id,
              status: amb.status,
              crew: amb.crew?.map((c: any) => c.name).filter(Boolean) || [],
              currentLocation: {
                lat: lat ? Number(lat) : 32.290209,
                lng: lng ? Number(lng) : -9.2269851,
                address: amb.current_address || t('ambulances.notAvailable')
              },
              last_latitude: lat ? Number(lat) : undefined,
              last_longitude: lng ? Number(lng) : undefined,
              imei_tablette: amb.imei_tablette || null,
              last_updated: amb.updated_at || amb.last_datetime || new Date().toISOString()
            };
          });

          setAmbulances(mappedAmbulances);
        }
      } catch (error: any) {
        // Error handling code removed


        // Afficher l'erreur complète dans la console
        if (error.response?.data?.error) {
        }
        if (error.response?.data?.stack) {
        }

        // Afficher une erreur à l'utilisateur au lieu d'utiliser des données de démo
        if (error.response?.status === 500) {
        }

        // Ne pas utiliser de données de démo - garder le tableau vide pour voir l'erreur
        setAmbulances([]);

        // Optionnel: Vous pouvez décommenter ceci pour utiliser des données de démo temporairement
        // setAmbulances([...]);
      } finally {
        setLoading(false);
      }
    };

    fetchAmbulances();
  }, []);

  const statusConfig = {
    'available': { color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/20', label: t('ambulances.status.available') },
    'en-route': { color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/20', label: t('ambulances.status.enRoute') },
    'on-scene': { color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/20', label: t('ambulances.status.onScene') },
    'transport': { color: 'text-purple-700 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/20', label: t('ambulances.status.transport') },
    'maintenance': { color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/20', label: t('ambulances.status.maintenance') },
    'offline': { color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800', label: t('common.offline') }
  };

  const priorityConfig = {
    'high': { color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/20', label: t('ambulances.priorityHigh') },
    'medium': { color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/20', label: t('ambulances.priorityMedium') },
    'low': { color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/20', label: t('ambulances.priorityLow') }
  };

  // Fix des icônes Leaflet sous Vite (utilise CDN images)
  const icon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [0, -28],
    shadowSize: [41, 41]
  });

  // Centrage demandé: Madinat Siha Safi - Oncorad Group
  const clinicCenter: [number, number] = [32.290209, -9.2269851];

  function MapAutoFix() {
    const map = useMap();
    useEffect(() => {
      setTimeout(() => map.invalidateSize(), 200);
    }, [map]);
    return null;
  }

  // Composant pour naviguer vers une ambulance avec zoom 20
  function MapNavigator({ ambulanceId, ambulances, onNavigated }: { ambulanceId: string | null; ambulances: Ambulance[]; onNavigated?: () => void }) {
    const map = useMap();

    useEffect(() => {
      if (ambulanceId) {
        const ambulance = ambulances.find(a => a.id === ambulanceId);
        if (ambulance && ambulance.currentLocation) {
          const { lat, lng } = ambulance.currentLocation;
          map.setView([lat, lng], 20, {
            animate: true,
            duration: 1.0
          });
          // Notifier que la navigation est terminée pour permettre de renaviguer vers la même ambulance
          if (onNavigated) {
            setTimeout(() => onNavigated(), 1000);
          }
        }
      }
    }, [ambulanceId, ambulances, map, onNavigated]);

    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with live stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('ambulances.available')}</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {ambulances.filter(a => a.status === 'available').length}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('ambulances.onMission')}</p>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {ambulances.filter(a => ['en-route', 'on-scene', 'transport'].includes(a.status)).length}
              </p>
            </div>
            <Navigation className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('ambulances.emergencies')}</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {ambulances.filter(a => a.mission?.priority === 'high').length}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('ambulances.personnel')}</p>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {ambulances.reduce((acc, a) => acc + a.crew.length, 0)}
              </p>
            </div>
            <Users className="h-8 w-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ambulances list */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('ambulances.fleet')}
            {ambulances.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                ({ambulances.length} {ambulances.length === 1 ? 'ambulance' : 'ambulances'})
              </span>
            )}
          </h2>

          {ambulances.length === 0 && !loading && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-yellow-800 dark:text-yellow-200">
                ⚠️ {t('ambulances.noAmbulancesFound')}
              </p>
            </div>
          )}

          {ambulances.map((ambulance) => (
            <div
              key={ambulance.id}
              className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border transition-all duration-200 cursor-pointer hover:shadow-lg ${selectedAmbulance === ambulance.id
                ? 'border-blue-500 dark:border-blue-400'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              onClick={() => setSelectedAmbulance(selectedAmbulance === ambulance.id ? null : ambulance.id)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`p-3 rounded-lg ${statusConfig[ambulance.status].bg}`}>
                    <Ambulance className={`h-6 w-6 ${statusConfig[ambulance.status].color}`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {ambulance.id} - {ambulance.callSign}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {t('ambulances.crew')}: {ambulance.crew.length > 0 ? ambulance.crew.join(' & ') : t('ambulances.unassigned')}
                    </p>
                    {ambulance.last_updated && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {t('ambulances.lastUpdate')}: {new Date(ambulance.last_updated).toLocaleTimeString(i18n.language === 'ar' ? 'ar-MA' : i18n.language === 'en' ? 'en-GB' : 'fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                      </p>
                    )}
                  </div>
                </div>

                <span className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${statusConfig[ambulance.status].bg} ${statusConfig[ambulance.status].color}`}>
                  {statusConfig[ambulance.status].label}
                </span>
              </div>

              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 mb-3">
                <MapPin className="h-4 w-4" />
                <span>{ambulance.currentLocation.address}</span>
              </div>

              {ambulance.mission && (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {t('ambulances.mission')} #{ambulance.mission.id}
                    </span>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${priorityConfig[ambulance.mission.priority].bg} ${priorityConfig[ambulance.mission.priority].color}`}>
                      {priorityConfig[ambulance.mission.priority].label}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center space-x-1">
                      <Route className="h-4 w-4" />
                      <span>{ambulance.mission.destination}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="h-4 w-4" />
                      <span>ETA: {ambulance.mission.eta}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    Patient: {ambulance.mission.patient}
                  </p>
                </div>
              )}

              {selectedAmbulance === ambulance.id && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      onClick={() => {
                        setSelectedAmbulanceForIntervention(ambulance);
                        setIsInterventionFormOpen(true);
                      }}
                      className="flex items-center justify-center space-x-2 bg-[#0096D6] hover:bg-[#007BB5] text-white px-4 py-2 rounded-lg transition-colors duration-200"
                    >
                      <Phone className="h-4 w-4" />
                      <span>{t('ambulances.contact')}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Empêcher la propagation vers le onClick du parent
                        setNavigateToAmbulance(ambulance.id);
                      }}
                      className="flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
                    >
                      <Navigation className="h-4 w-4" />
                      <span>{t('ambulances.navigate')}</span>
                    </button>
                    <button className="flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors duration-200">
                      <Activity className="h-4 w-4" />
                      <span>{t('ambulances.history')}</span>
                    </button>

                    {!ambulance.mission && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAmbulanceForAssign(ambulance.id);
                          setIsPatientDrawerOpen(true);
                        }}
                        className="flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 sm:col-span-3 lg:col-span-3 xl:col-span-1"
                      >
                        <UserPlus className="h-4 w-4" />
                        <span>{t('ambulances.assignPatient')}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Map placeholder and dispatch */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('ambulances.realtimeMap')}
              </h3>
              <button
                onClick={() => setFullMap(true)}
                className="px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {t('ambulances.fullscreen')}
              </button>
            </div>
            <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              <MapContainer center={clinicCenter} zoom={17} style={{ height: 420, width: '100%' }} scrollWheelZoom={true}>
                <MapAutoFix />
                <MapNavigator ambulanceId={navigateToAmbulance} ambulances={ambulances} onNavigated={() => setNavigateToAmbulance(null)} />
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {/* Marqueur Clinique */}
                <Marker position={clinicCenter} icon={icon}>
                  <Popup>
                    <div className="space-y-1">
                      <div className="font-semibold">{t('ambulances.clinicName')}</div>
                      <div className="text-xs">{t('ambulances.groupName')}</div>
                    </div>
                  </Popup>
                </Marker>
                {ambulances.map(a => (
                  <Marker key={a.id} position={[a.currentLocation.lat, a.currentLocation.lng]} icon={icon}>
                    <Popup>
                      <div className="space-y-1">
                        <div className="font-semibold">{a.id} - {a.callSign}</div>
                        <div className="text-xs">{a.currentLocation.address}</div>
                        {a.mission && (
                          <div className="text-xs">{t('ambulances.mission')} {a.mission.id} · ETA {a.mission.eta}</div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('ambulances.quickDispatch')}
            </h3>
            <div className="space-y-3">
              <button className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2">
                <AlertTriangle className="h-5 w-5" />
                <span>{t('ambulances.vitalEmergency')}</span>
              </button>
              <button className="w-full bg-orange-600 hover:bg-orange-700 text-white px-4 py-3 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>{t('ambulances.scheduledTransport')}</span>
              </button>
              <button title={t('ambulances.intraHospitalDesc')} className="w-full bg-[#0096D6] hover:bg-[#007BB5] text-white px-4 py-3 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2">
                <Route className="h-5 w-5" />
                <span>{t('ambulances.intraHospitalTransfer')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Overlay carte plein écran */}
      {fullMap && (
        <div className="fixed inset-0 z-50 bg-black/60">
          <div className="absolute inset-4 md:inset-8 bg-white dark:bg-gray-900 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="absolute top-3 right-3 z-[1000] flex gap-2">
              <button
                onClick={() => setFullMap(false)}
                className="px-3 py-1.5 text-sm rounded-md bg-gray-900/80 text-white hover:bg-gray-900"
              >
                {t('common.close')}
              </button>
            </div>
            <MapContainer center={clinicCenter} zoom={17} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
              <MapAutoFix />
              <MapNavigator ambulanceId={navigateToAmbulance} ambulances={ambulances} onNavigated={() => setNavigateToAmbulance(null)} />
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <Marker position={clinicCenter} icon={icon}>
                <Popup>
                  <div className="space-y-1">
                    <div className="font-semibold">{t('ambulances.clinicName')}</div>
                    <div className="text-xs">{t('ambulances.groupName')}</div>
                  </div>
                </Popup>
              </Marker>
              {ambulances.map(a => (
                <Marker key={a.id} position={[a.currentLocation.lat, a.currentLocation.lng]} icon={icon}>
                  <Popup>
                    <div className="space-y-1">
                      <div className="font-semibold">{a.id} - {a.callSign}</div>
                      <div className="text-xs">{a.currentLocation.address}</div>
                      {a.mission && (
                        <div className="text-xs">{t('ambulances.mission')} {a.mission.id} · ETA {a.mission.eta}</div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      )}

      {/* Recent missions */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('ambulances.recentMissions')}
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('ambulances.mission')}
                </th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('moduleNames.ambulances')}
                </th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('common.type')}
                </th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('ambulances.duration')}
                </th>
                <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('common.status')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {[
                { id: 'MISS-001', ambulance: 'AMB-01', type: 'emergency', duration: '12 min', status: t('ambulances.inProgress'), time: '14:30' },
                { id: 'MISS-002', ambulance: 'AMB-03', type: 'transfer', duration: '25 min', status: t('ambulances.inProgress'), time: '14:15' },
                { id: 'MISS-003', ambulance: 'AMB-02', type: 'routine', duration: '18 min', status: t('ambulances.completed'), time: '13:45' }
              ].map((mission, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {mission.id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {mission.ambulance}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 capitalize">
                    {mission.type}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                    {mission.duration}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${mission.status === t('ambulances.inProgress')
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
                      : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                      }`}>
                      {mission.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Formulaire d'Intervention */}
      <InterventionForm
        isOpen={isInterventionFormOpen}
        onClose={() => {
          setIsInterventionFormOpen(false);
          setSelectedAmbulanceForIntervention(null);
        }}
        ambulance={selectedAmbulanceForIntervention}
        onMissionSent={() => {
          // Rafraîchir la liste des ambulances après l'envoi d'une mission
          const fetchAmbulances = async () => {
            try {
              const response = await axios.get('/ambulances');
              if (response.data.success && response.data.data) {
                const mappedAmbulances: Ambulance[] = response.data.data.map((amb: any) => {
                  const lat = amb.last_latitude || amb.current_lat;
                  const lng = amb.last_longitude || amb.current_lng;
                  return {
                    id: amb.id,
                    callSign: amb.call_sign || amb.id,
                    status: amb.status,
                    crew: amb.crew?.map((c: any) => c.name).filter(Boolean) || [],
                    currentLocation: {
                      lat: lat ? Number(lat) : 32.290209,
                      lng: lng ? Number(lng) : -9.2269851,
                      address: amb.current_address || t('ambulances.notAvailable')
                    },
                    last_latitude: lat ? Number(lat) : undefined,
                    last_longitude: lng ? Number(lng) : undefined,
                    imei_tablette: amb.imei_tablette || null
                  };
                });
                setAmbulances(mappedAmbulances);
              }
            } catch (error) {
            }
          };
          fetchAmbulances();
        }}
      />

      <PatientDrawer
        isOpen={isPatientDrawerOpen}
        onClose={() => {
          setIsPatientDrawerOpen(false);
          setSelectedAmbulanceForAssign(null);
        }}
        ambulanceId={selectedAmbulanceForAssign}
        onAssign={async (patientId, details) => {
          if (!selectedAmbulanceForAssign) return;

          try {
            const token = localStorage.getItem('clinicToken');

            // We need to fetch the ambulance to get its current location for the mission
            // Or we can just send what we have if the backend supports it.
            // For now let's construct a payload that matches what server expects as much as possible
            // We might need to make latitude/longitude optional in backend if we don't have them here

            const ambulance = ambulances.find(a => a.id === selectedAmbulanceForAssign);

            const payload = {
              id: `MISS-${Date.now()}`,
              ambulance_id: selectedAmbulanceForAssign,
              patient_id: patientId,
              type: 'transfer', // Default type
              priority: details.priority || 'medium',
              destination_address: details.destination || 'Clinique',
              // Use ambulance location as pickup if available
              pickup_lat: ambulance?.currentLocation?.lat,
              pickup_lng: ambulance?.currentLocation?.lng,
              pickup_address: ambulance?.currentLocation?.address,
              // We don't have destination lat/lng from the simple drawer, maybe default to 0 or null?
              destination_lat: 0,
              destination_lng: 0,
              destination_floor: null, // Default to null to avoid FK constraint error if '0' doesn't exist
              estimated_arrival: new Date(Date.now() + 30 * 60000).toISOString() // Fake ETA 30 mins
            };

            await axios.post('/ambulances/missions', payload, {
              headers: token ? { Authorization: `Bearer ${token}` } : {}
            });

            // Refresh ambulances
            // Trigger the same fetch logic as useEffect? 
            // We can expose the fetch function or just reload window (ugly).
            // Ideally refactor fetchAmbulances to be reusable.
            // For now, let's just create a quick fetch inside here or assume the parent component handles it.
            // We can duplicate the fetch logic briefly or move fetchAmbulances outside useEffect.

            // Simplistic refresh like in InterventionForm:
            const response = await axios.get('/ambulances');
            if (response.data.success && response.data.data) {
              // Re-map logic... (This is duplicated, should refactor)
              // For now, let's just accept duplication to be safe and quick
              const mappedAmbulances: Ambulance[] = response.data.data.map((amb: any) => {
                const lat = amb.last_latitude || amb.current_lat;
                const lng = amb.last_longitude || amb.current_lng;
                return {
                  id: amb.id,
                  callSign: amb.call_sign || amb.id,
                  status: amb.status,
                  crew: amb.crew?.map((c: any) => c.name).filter(Boolean) || [],
                  currentLocation: {
                    lat: lat ? Number(lat) : 32.290209,
                    lng: lng ? Number(lng) : -9.2269851,
                    address: amb.current_address || t('ambulances.notAvailable')
                  },
                  last_latitude: lat ? Number(lat) : undefined,
                  last_longitude: lng ? Number(lng) : undefined,
                  imei_tablette: amb.imei_tablette || null,
                  mission: amb.mission // Ensure missions are mapped if returned by API
                };
              });
              setAmbulances(mappedAmbulances);
            }

          } catch (err) {
            throw err;
          }
        }}
      />
    </div>
  );
}