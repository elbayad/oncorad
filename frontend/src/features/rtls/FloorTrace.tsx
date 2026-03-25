
import { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, GeoJSON, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import { DivIcon } from 'leaflet';
import {
  Building,
  History,
  Search,
  Maximize2,
  Minimize2,
  Users,
  Eye,
  Syringe,
  Pill,
  Thermometer,
  Microscope,
  Dna,
  Brain,
  FlaskConical,
  Radiation,
  Baby,
  Bone,
  HeartPulse,
  Droplets,
  ClipboardList,
  Ambulance,
  Box,
  User,
  UserCheck,
  Bed,
  Stethoscope,
  Clock,
  RefreshCw,
  Activity,
  ChevronDown,
  ChevronUp,
  Info,
  MapPin
} from 'lucide-react';

import { MEDICAL_ICON_LIBRARY } from '../../constants/medicalIcons';

const RTLS_ICON_COMPONENTS: Record<string, any> = {
  // Lucide Icons
  User, Box, Bed, Stethoscope, Activity, Syringe, Pill, Thermometer,
  Microscope, Dna, Brain, FlaskConical, Radiation, Baby, Bone, Eye, HeartPulse, Droplets,
  ClipboardList, Ambulance, UserCheck,
  // Custom Medical Icons
  ...Object.keys(MEDICAL_ICON_LIBRARY).reduce((acc, key) => ({
    ...acc,
    [key]: (props: any) => (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
        dangerouslySetInnerHTML={{ __html: MEDICAL_ICON_LIBRARY[key] }}
      />
    )
  }), {})
};

import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import { useTranslation } from 'react-i18next';
import HistoryDrawer from './HistoryDrawer';

// Correction pour les icônes Leaflet par défaut
import L from 'leaflet';
try {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  });
} catch (e) {
}

interface Asset {
  id: string;
  name: string;
  type: 'person' | 'equipment' | 'patient';
  floor: number;
  zone: string;
  coordinates?: { x: number; y: number };
  status: 'active' | 'idle' | 'offline';
  lastSeen: string;
  lastUpdateRaw?: string; // New field for ISO absolute time
  battery?: number;
  mrn?: string;
  room?: string;
  type_id?: string;
  type_name?: string;
  category_name?: string;
  icon?: string;
  color?: string;
}

interface Floor {
  id: number;
  name: string;
  description?: string;
  plan?: string; // Nom du fichier GeoJSON
}

const GEOJSON_SCALE = 1; // 1 si GeoJSON en cm, ajuster selon vos données

// Composant pour ajuster les bounds automatiquement
// Composant pour ajuster les bounds automatiquement
function MapBounds({ geojsonData, mapKey }: { geojsonData: any, mapKey: number }) {
  const map = useMap();

  useEffect(() => {
    if (!geojsonData || !map) return;

    // Vérifier que le conteneur de la carte est initialisé
    if (!map.getContainer() || !map.getContainer().offsetWidth) {
      return;
    }

    try {
      // Attendre un peu pour que le canvas soit complètement initialisé
      const timeoutId = setTimeout(() => {
        try {
          const geoJsonLayer = L.geoJSON(geojsonData);
          const bounds = geoJsonLayer.getBounds();

          if (bounds && bounds.isValid()) {
            // Ajouter un padding
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 2 });
          } else {
            // Fallback center if bounds are weird
            map.setView([2100, 3300], -1);
          }
        } catch (error) {
          console.error("Error setting bounds", error);
          map.setView([2100, 3300], -1);
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    } catch (error) {
    }
  }, [geojsonData, map, mapKey]);

  return null;
}

// Composant pour zoomer sur un asset sélectionné
function ZoomToAsset({ assetId, assets, selectedFloor }: { assetId: string | null; assets: Asset[]; selectedFloor: number | null }) {
  const map = useMap();

  useEffect(() => {
    if (!assetId || !map || selectedFloor === null) return;

    const asset = assets.find(a => a.id === assetId && a.floor === selectedFloor);
    if (!asset || !asset.coordinates) return;

    try {
      const timeoutId = setTimeout(() => {
        // Convertir les coordonnées (même logique que convertToLatLng)
        const [lat, lng] = [
          (asset.coordinates?.y ?? 0) / GEOJSON_SCALE,
          (asset.coordinates?.x ?? 0) / GEOJSON_SCALE
        ];
        map.setView([lat, lng], 3, { animate: true, duration: 0.5 });
      }, 300);

      return () => clearTimeout(timeoutId);
    } catch (error) {
    }
  }, [assetId, assets, selectedFloor, map]);

  return null;
}

// Composant pour le HUD (coordonnées souris)
function MapHUD() {
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  useMapEvents({
    mousemove: (e) => {
      const { lat, lng } = e.latlng;
      setCoords({
        x: Math.round(lng * GEOJSON_SCALE),
        y: Math.round(lat * GEOJSON_SCALE)
      });
    }
  });

  return (
    <div className="absolute left-3 bottom-3 z-[1000] bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-lg px-3 py-2 text-xs text-white font-mono">
      X=<b>{coords.x}</b> cm · Y=<b>{coords.y}</b> cm
    </div>
  );
}

function MapLegend({ assets }: { assets: Asset[] }) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const uniqueTypes = useMemo(() => {
    const typesMap = new Map<string, { icon: string; color: string; label: string; type: string }>();

    assets.forEach(asset => {
      const iconKey = asset.icon || asset.type;
      const typeLabel = asset.type_name || (asset.type === 'person' ? t('rtls.types.person') : asset.type === 'patient' ? t('rtls.types.patient') : t('rtls.types.equipment'));
      const key = `${iconKey}-${asset.color || ''}`;

      if (!typesMap.has(key)) {
        typesMap.set(key, {
          icon: asset.icon || '',
          color: asset.color || (asset.type === 'person' ? '#2563eb' : asset.type === 'patient' ? '#7c3aed' : '#059669'),
          label: typeLabel,
          type: asset.type
        });
      }
    });

    return Array.from(typesMap.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [assets, t]);

  if (uniqueTypes.length === 0) return null;

  return (
    <div className={`absolute right-3 bottom-12 z-[1000] bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl transition-all duration-300 ease-in-out ${isExpanded ? 'p-4 min-w-[180px] max-h-[400px]' : 'p-2 w-auto'}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full gap-3 group"
      >
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg transition-colors ${isExpanded ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
            <Info className="h-4 w-4" />
          </div>
          {isExpanded && (
            <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
              {t('rtls.legend') || 'Légende'}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
        ) : (
          <ChevronUp className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-3 overflow-y-auto custom-scrollbar pr-1" style={{ maxHeight: '300px' }}>
          {uniqueTypes.map((item, idx) => {
            const IconComponent = RTLS_ICON_COMPONENTS[item.icon] || (item.type === 'person' ? UserCheck : item.type === 'patient' ? Bed : Stethoscope);
            return (
              <div key={idx} className="flex items-center gap-3 px-1 animate-fadeIn">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border-2 shrink-0 shadow-sm" style={{ borderColor: item.color }}>
                  <IconComponent className="h-4 w-4" style={{ color: item.color }} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[12px] font-semibold text-gray-900 dark:text-white truncate" title={item.label}>
                    {item.label}
                  </span>
                  <span className="text-[9px] text-gray-500 dark:text-gray-400 uppercase font-bold tracking-tighter">
                    {item.type === 'person' ? t('rtls.types.person') : item.type === 'patient' ? t('rtls.types.patient') : t('rtls.types.equipment')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Créer une icône personnalisée pour les assets
// Créer une icône personnalisée pour les assets
function createAssetIcon(asset: Asset, isSelected: boolean = false): DivIcon {
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'person': return '#2563eb'; // Blue-600 (Darker for contrast on white)
      case 'patient': return '#7c3aed'; // Violet-600
      case 'equipment': return '#059669'; // Emerald-600
      default: return '#2563eb';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#10b981'; // Emerald-500
      case 'idle': return '#f59e0b'; // Amber-500
      case 'offline': return '#ef4444'; // Red-500
      default: return '#6b7280';
    }
  };

  const color = asset.color || getTypeColor(asset.type);
  const statusColor = getStatusColor(asset.status);

  // Updated SVGs to be slightly smaller to fit well inside the white circle
  const getIconSVG = (type: string, color: string, iconName?: string) => {
    const iconPaths: Record<string, string> = {
      ...MEDICAL_ICON_LIBRARY,
      // Fallbacks mapping types to library keys
      person: MEDICAL_ICON_LIBRARY['medecin'],
      patient: MEDICAL_ICON_LIBRARY['patient'],
      equipment: MEDICAL_ICON_LIBRARY['box']
    };

    const path = (iconName && iconPaths[iconName]) || iconPaths[type] || '<circle cx="12" cy="12" r="10"/>';
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5">${path}</svg>`;
  };

  const borderWidth = isSelected ? '3px' : '2px';
  const borderColor = isSelected ? '#fbbf24' : color;
  // White background makes it pop against dark map
  // Strong shadow adds depth
  const shadow = isSelected
    ? '0 0 0 4px rgba(251, 191, 36, 0.4), 0 8px 16px rgba(0,0,0,0.5)'
    : '0 4px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.2)';

  const html = `
    <div class="tag-chip" style="
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      position: relative;
      border: ${borderWidth} solid ${borderColor};
      background: #ffffff;
      box-shadow: ${shadow};
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      transform-origin: center center;
    ">
      ${getIconSVG(asset.type, color, asset.icon)}
      
      <!-- Status Dot -->
      <span style="
        position: absolute;
        right: -2px;
        top: -2px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: ${statusColor};
        border: 2px solid #ffffff;
        box-shadow: 0 1px 2px rgba(0,0,0,0.2);
      "></span>
    </div>
  `;

  return new DivIcon({
    className: '', // Empty class name to avoid default leaflet-div-icon styles (square white box)
    html,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

// Convertir les coordonnées en pixels en coordonnées Leaflet (lat/lng)
const convertToLatLng = (coords: { x: number; y: number }): [number, number] => {
  const x = Number(coords.x);
  const y = Number(coords.y);
  // Safeguard against NaN or undefined
  if (isNaN(x) || isNaN(y)) {
    console.warn('[RTLS] Invalid coordinates:', coords);
    return [0, 0];
  }
  return [y / GEOJSON_SCALE, x / GEOJSON_SCALE];
};

interface AssetMapProps {
  loadingFloors: boolean;
  selectedFloor: number | null;
  floors: Floor[];
  mapKey: number;
  geojsonData: any;
  filteredAssets: Asset[];
  selectedAssetId: string | null;
  isFullscreen?: boolean;
  onShowHistory?: (asset: Asset) => void;
}

const AssetMap = ({
  loadingFloors,
  selectedFloor,
  floors,
  mapKey,
  geojsonData,
  filteredAssets,
  selectedAssetId,
  isFullscreen = false,
  onShowHistory
}: AssetMapProps) => {
  const { t } = useTranslation();

  // Create asset markers
  const assetMarkers = useMemo(() => {
    // Filtrer les assets qui ont des coordonnées (même si à 0)
    const assetsWithCoords = filteredAssets.filter(asset =>
      asset.coordinates !== undefined && asset.coordinates !== null
    );

    return assetsWithCoords.map((asset) => {
      const coords = asset.coordinates;
      if (!coords) return null; // Ensure coords exist

      const finalCoords = {
        x: (coords.x === 0 && coords.y === 0) ? 3300 : coords.x,
        y: (coords.y === 0 && coords.y === 0) ? 2100 : coords.y
      };

      const [lat, lng] = convertToLatLng(finalCoords);
      const isSelected = selectedAssetId === asset.id;

      return (
        <Marker
          key={asset.id}
          position={[lat, lng]}
          icon={createAssetIcon(asset, isSelected)}
        >
          <Popup className="rtls-popup-clean">
            <div className="min-w-[280px] bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${asset.type === 'person' ? 'bg-blue-100 border-blue-200 dark:bg-blue-900/30 dark:border-blue-800' :
                  asset.type === 'patient' ? 'bg-purple-100 border-purple-200 dark:bg-purple-900/30 dark:border-purple-800' :
                    'bg-emerald-100 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800'
                  }`}>
                  {(() => {
                    const IconComponent = RTLS_ICON_COMPONENTS[asset.icon || ''] || (asset.type === 'person' ? UserCheck : asset.type === 'patient' ? Bed : Stethoscope);
                    return <IconComponent className="h-4 w-4" style={{ color: asset.color || 'currentColor' }} />;
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate" title={asset.name}>
                      {asset.name}
                    </h3>
                    {/* History Icon Trigger */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onShowHistory) onShowHistory(asset);
                      }}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full text-blue-500 transition-colors"
                      title={t('rtls.actions.viewHistory')}
                    >
                      <History className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                    {asset.id} · {asset.type === 'person' ? t('rtls.types.person') : asset.type === 'equipment' ? t('rtls.types.equipment') : t('rtls.types.patient')}
                  </div>
                </div>
                <div className={`ml-auto w-2.5 h-2.5 rounded-full ${asset.status === 'active' ? 'bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.2)]' :
                  asset.status === 'idle' ? 'bg-amber-500 shadow-[0_0_0_2px_rgba(245,158,11,0.2)]' :
                    'bg-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]'
                  }`}></div>
              </div>

              {/* Body */}
              <div className="px-4 py-3 space-y-3">
                <div className="flex gap-4">
                  {/* Photo Section */}
                  <a
                    href={`/photos/${asset.id}.jpg`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 group relative shadow-sm"
                  >
                    <img
                      src={`/photos/${asset.id}.jpg`}
                      alt={asset.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(asset.name)}&background=f3f4f6&color=6b7280&size=80`;
                      }}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Eye className="h-4 w-4 text-white" />
                    </div>
                  </a>

                  {/* Details Section */}
                  <div className="flex-1 grid grid-cols-[80px_1fr] gap-y-1.5 text-xs content-start">
                    {asset.room && asset.room !== 'circulation' && (
                      <>
                        <div className="text-gray-500 dark:text-gray-400">{t('common.room') || 'Chambre'}</div>
                        <div className="font-bold text-blue-600 dark:text-blue-400 text-sm">
                          {asset.room}
                        </div>
                      </>
                    )}


                    <div className="text-gray-500 dark:text-gray-400">{t('common.zone')}</div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {asset.zone || t('rtls.unknownZone')}
                    </div>

                    {asset.battery !== undefined && (
                      <>
                        <div className="text-gray-500 dark:text-gray-400">{t('common.battery')}</div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden w-24">
                            <div
                              className={`h-full rounded-full ${asset.battery > 50 ? 'bg-emerald-500' :
                                asset.battery > 20 ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                              style={{ width: `${asset.battery}%` }}
                            ></div>
                          </div>
                          <span className={`text-xs font-medium ${asset.battery > 20 ? 'text-gray-700 dark:text-gray-300' : 'text-red-600 dark:text-red-400'
                            }`}>{asset.battery}%</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-3 mt-1 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-xs">
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium ${asset.status === 'active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' :
                  asset.status === 'idle' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' :
                    'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                  }`}>
                  {asset.status === 'active' ? t('common.statusLabels.active') : asset.status === 'idle' ? t('common.statusLabels.idle') : t('common.statusLabels.offline')}
                </span>
                <span className="text-gray-400 flex items-center gap-1 font-mono text-[10px]">
                  <Clock className="h-3 w-3" />
                  MAJ: {asset.lastUpdateRaw ? new Date(asset.lastUpdateRaw).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : asset.lastSeen}
                </span>
              </div>

            </div>
          </Popup>
        </Marker>
      );
    });
  }, [filteredAssets, selectedAssetId, geojsonData]);

  // Ne pas rendre la carte si les étages ne sont pas encore chargés ou si aucun étage n'est sélectionné
  if (loadingFloors || selectedFloor === null || floors.length === 0) {
    return (
      <div className={`relative ${isFullscreen ? 'w-full h-full' : 'bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden'} flex items-center justify-center`} style={isFullscreen ? { height: '100vh' } : { height: '600px' }}>
        <div className="text-gray-500 dark:text-gray-400">
          {loadingFloors ? t('rtls.loadingFloors') : t('rtls.noFloors')}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${isFullscreen ? 'w-full h-full' : 'bg-gray-50 dark:bg-gray-700 rounded-lg overflow-hidden'}`} style={isFullscreen ? { height: '100vh' } : { height: '600px' }}>
      <MapContainer
        center={[2100, 3300]}
        zoom={-1}
        minZoom={-5}
        maxZoom={5}
        zoomSnap={0.5}
        crs={L.CRS.Simple}
        style={{ height: '100%', width: '100%', background: '#0f1a30' }}
      >
        {/* Fond transparent */}

        {/* Afficher le GeoJSON du plan d'étage */}
        {geojsonData && (
          <GeoJSON
            key={mapKey}
            data={geojsonData}
            style={{
              color: '#6aa0ff',
              weight: 1,
              fillColor: '#6aa0ff',
              fillOpacity: 0.08
            }}
          />
        )}



        {/* Afficher les assets comme marqueurs */}
        {assetMarkers}

        {/* HUD pour afficher les coordonnées */}
        <MapHUD />

        {/* Légende des types dynamique */}
        <MapLegend assets={filteredAssets} />

        {/* Ajuster les bounds automatiquement */}
        <MapBounds geojsonData={geojsonData} mapKey={mapKey} />

        {/* Zoomer sur l'asset sélectionné */}
        <ZoomToAsset assetId={selectedAssetId} assets={filteredAssets} selectedFloor={selectedFloor} />
      </MapContainer>
    </div>
  );
};

export default function FloorTrace() {
  const { t } = useTranslation();
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterNature, setFilterNature] = useState<string>('all');
  const [filterRoom, setFilterRoom] = useState<string>('all');
  const [geojsonData, setGeojsonData] = useState<any>(null);
  const [mapKey, setMapKey] = useState(0);
  const [fullMap, setFullMap] = useState(false);
  const [floors, setFloors] = useState<any[]>([]);
  const [loadingFloors, setLoadingFloors] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [assets, setAssets] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);


  // History State
  const [showHistory, setShowHistory] = useState(false);
  const [historyAsset, setHistoryAsset] = useState<any | null>(null);
  const [zoneHistory, setZoneHistory] = useState<any[]>([]);
  const [historyRange, setHistoryRange] = useState<{ start: Date, end: Date } | null>(null);


  const fetchHistory = async (assetId: string, start: Date, end: Date) => {
    try {
      setHistoryRange({ start, end });

      const response = await axios.get(`/assets/${assetId}/zone-history`, {
        params: { start: start.toISOString(), end: end.toISOString() }
      });

      if (response.data.success) {
        setZoneHistory(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching history", error);
    }
  };


  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleGlobalView = () => {
    setSelectedAssetId(null);
    setSearchQuery('');
    setFilterCategory('all');
    setFilterNature('all');
    setFilterRoom('all');
    setMapKey(prev => prev + 1); // Triggers re-render and MapBounds effect to auto-fit
  };

  const handleFocusSearch = () => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const openHistory = (asset: Asset) => {
    setHistoryAsset(asset);
    setShowHistory(true);
    // Default to last 2 hours
    const end = new Date();
    const start = new Date(end.getTime() - 2 * 60 * 60 * 1000); // Last 2 hours default
    fetchHistory(asset.id, start, end);
  };

  // --- SOCKET.IO INTEGRATION ---
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let isComponentMounted = true;

    // Determine WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:8789/api/ws`;


    const connect = () => {
      if (!isComponentMounted) return;

      // Avoid multiple connections
      if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;

      try {
        ws = new WebSocket(wsUrl);
      } catch (e) {
        console.error("Failed to create WebSocket", e);
        return;
      }

      ws.onopen = () => {
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          // Handle Real-time Messages
          if (message.type === 'mqtt_message') {

            // 1. POSITION BATCH UPDATE (Optimized)
            if (message.topic === 'rtls/positions_batch') {
              const batch = message.data;
              if (!batch || !Array.isArray(batch.positions)) return;

              setAssets(prev => {
                const updated = [...prev];
                batch.positions.forEach((pt: any) => {
                  const id = String(pt.id || '').trim().toLowerCase();
                  const newX = pt.x !== undefined ? Number(pt.x) : 0;
                  const newY = pt.y !== undefined ? Number(pt.y) : 0;
                  const floorId = pt.floor ? Number(pt.floor) : 1;

                  const existingIndex = updated.findIndex(a => a.id === id);
                  if (existingIndex >= 0) {
                    updated[existingIndex] = {
                      ...updated[existingIndex],
                      floor: floorId,
                      coordinates: { x: newX, y: newY },
                      zone: pt.zone !== undefined ? pt.zone : updated[existingIndex].zone,
                      room: pt.room !== undefined ? pt.room : updated[existingIndex].room,
                      lastSeen: t('rtls.justNow'),

                      lastUpdateRaw: new Date().toISOString(),
                      status: 'active'
                    };
                  } else {
                    updated.push({
                      id: id,
                      name: `Tag ${id.substr(-4)}`,
                      type: 'equipment',
                      floor: floorId,
                      zone: pt.zone || '',
                      coordinates: { x: newX, y: newY },
                      lastSeen: t('rtls.justNow'),
                      lastUpdateRaw: new Date().toISOString(),
                      status: 'active',
                      battery: 100
                    });
                  }
                });
                return updated;
              });
              return;
            }

            // 2. INDIVIDUAL POSITION UPDATE (Keep for backward compatibility)
            if (message.topic === 'rtls/position') {
              const pt = message.data;
              if (!pt) return;

              const id = String(pt.id || '').trim().toLowerCase();
              const newX = pt.x !== undefined ? Number(pt.x) : 0;
              const newY = pt.y !== undefined ? Number(pt.y) : 0;
              const floorId = pt.floor ? Number(pt.floor) : 1;

              setAssets(prev => {
                const existingIndex = prev.findIndex(a => a.id === id);
                if (existingIndex >= 0) {
                  const updated = [...prev];
                  updated[existingIndex] = {
                    ...updated[existingIndex],
                    floor: floorId,
                    coordinates: { x: newX, y: newY },
                    lastSeen: t('rtls.justNow'),
                    lastUpdateRaw: new Date().toISOString(),
                    status: 'active'
                  };
                  return updated;
                } else {
                  return [...prev, {
                    id: id,
                    name: `Tag ${id.substr(-4)}`,
                    type: 'equipment',
                    floor: floorId,
                    zone: '',
                    coordinates: { x: newX, y: newY },
                    lastSeen: t('rtls.justNow'),
                    lastUpdateRaw: new Date().toISOString(),
                    status: 'active',
                    battery: 100
                  }];
                }
              });
            }

            // 2. BATTERY/STATUS UPDATE (Raw RTLS Topic)
            if (message.topic === 'rtls/topic') {
              const raw = message.data;
              if (raw && (raw.battery !== undefined || (raw.data && Array.isArray(raw.data)))) {
                const items = raw.data || [raw];
                items.forEach((item: any) => {
                  const id = String(item.mac || item.deviceId || raw.deviceId || '').trim().toLowerCase();
                  if (!id) return;

                  const battery = item.battery !== undefined ? item.battery : raw.battery;

                  if (battery !== undefined) {
                    setAssets(prev => prev.map(a => {
                      if (a.id !== id) return a;
                      return {
                        ...a,
                        battery: Number(battery),
                        lastSeen: t('rtls.justNow'),
                        lastUpdateRaw: new Date().toISOString()
                      };
                    }));
                  }
                });
              }
            }
          }
        } catch (err) {
          console.error('[RTLS] WebSocket Message Error:', err);
        }
      };

      ws.onclose = () => {
        if (isComponentMounted) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error('[RTLS] WebSocket Error:', error);
        if (ws) ws.close();
      };
    };

    connect();

    return () => {
      isComponentMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (ws) {
        // Prevent listeners from firing during cleanup
        ws.onclose = null;
        ws.onerror = null;
        ws.close();
      }
    };

  }, []);

  // Format helper
  const formatLastSeen = (lastSeen: string | Date | null): string => {
    if (lastSeen === t('rtls.justNow')) return lastSeen;
    if (!lastSeen) return t('rtls.never');

    const now = new Date();
    const seenDate = typeof lastSeen === 'string' ? new Date(lastSeen) : lastSeen;
    const diffMs = now.getTime() - seenDate.getTime();
    if (diffMs < 2000) return t('rtls.justNow');

    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return `${diffSec} ${t('common.time.sec')}`;
    if (diffMin < 60) return `${diffMin} ${t('common.time.min')}`;
    if (diffHour < 24) return `${diffHour} ${t('common.time.h')}`;
    return `${diffDay} ${t('common.time.j')}`;
  };

  // Charger les assets depuis l'API
  useEffect(() => {
    const fetchAssets = async () => {
      try {

        const response = await axios.get('/assets');


        if (response.data && response.data.success) {
          const assetsData = response.data.data || [];


          if (assetsData.length === 0) {
            setAssets([]);
            return;
          }





          // Mapper les données de l'API vers le format Asset
          // Filtrer seulement ceux qui ont floor_id, les coordonnées peuvent être 0
          const mappedAssets: Asset[] = assetsData
            .filter((a: any) => a.floor_id !== null)
            .map((a: any) => {
              // Convertir category/type_id en type
              let assetType: 'person' | 'equipment' | 'patient' = 'equipment';
              const cat = String(a.id_categorie || a.category);
              if (cat === '2' || cat === 'person' || cat === 'patient') {
                if (String(a.type_id) === '4' || cat === 'patient') assetType = 'patient'; // Patients
                else assetType = 'person'; // Personnel/Médecin
              } else {
                assetType = 'equipment';
              }

              return {
                id: a.id,
                name: a.name,
                type: assetType,
                floor: a.floor_id,
                zone: a.zone || '',
                room: a.room || '',

                type_id: a.type_id || '',
                coordinates: {
                  x: a.coordinates_x !== null ? parseFloat(a.coordinates_x) : 0,
                  y: a.coordinates_y !== null ? parseFloat(a.coordinates_y) : 0
                },
                status: (a.status === 'active' || a.status === 'idle' || a.status === 'offline')
                  ? a.status
                  : 'active',
                lastSeen: formatLastSeen(a.last_seen),
                lastUpdateRaw: a.last_seen || new Date().toISOString(),
                battery: a.battery_level !== null ? parseInt(a.battery_level) : undefined,
                type_name: a.type_name,
                category_name: a.category_name,
                icon: a.icon,
                color: a.color
              };
            });


          setAssets(mappedAssets);
        } else {
          // Log removed
          setAssets([]);
        }
      } catch (error: any) {
        // Log removed
      } finally {
      }
    };

    fetchAssets();
  }, []);

  // Charger les étages depuis l'API
  useEffect(() => {
    const fetchFloors = async () => {
      try {
        setLoadingFloors(true);
        const response = await axios.get('/floors');
        if (response.data.success && response.data.data) {
          const floorsData = response.data.data;
          setFloors(floorsData);
          // Sélectionner le premier étage par défaut si aucun n'est sélectionné
          setSelectedFloor(prev => {
            if (prev === null && floorsData.length > 0) {
              return floorsData[0].id;
            }
            return prev;
          });
        }
      } catch (error) {
      } finally {
        setLoadingFloors(false);
      }
    };

    fetchFloors();
  }, []);

  // Fetch rooms for the selected floor
  useEffect(() => {
    const fetchRooms = async () => {
      if (selectedFloor === null) {
        setRooms([]);
        return;
      }
      try {
        const response = await axios.get('/rooms', {
          params: { floorId: selectedFloor }
        });
        if (response.data.success) {
          setRooms(response.data.data);
        }
      } catch (error) {
        console.error("Error fetching rooms", error);
      }
    };
    fetchRooms();
  }, [selectedFloor]);


  // Charger le GeoJSON pour l'étage sélectionné
  useEffect(() => {
    // Ne rien faire si les étages ne sont pas encore chargés ou si aucun étage n'est sélectionné
    if (loadingFloors || selectedFloor === null || floors.length === 0) {
      return;
    }

    const floor = floors.find(f => f.id === selectedFloor);
    if (!floor?.plan) {
      setGeojsonData(null);
      return;
    }

    // Avoid re-fetching if we already have data for this floor (optimization)
    // For now, simple fetch is safer to ensure we get the right plan

    let isMounted = true;

    const loadGeoJSON = async () => {
      try {
        const response = await fetch(`/${floor.plan}`, { cache: 'no-store' });

        // Fallback to secondary server if needed
        if (!response.ok) {
          const altResponse = await fetch(`http://localhost:3000/${floor.plan}`, { cache: 'no-store' });
          if (altResponse.ok) {
            const data = await altResponse.json();
            if (isMounted) {
              const scaled = scaleGeoJSON(data, 1 / GEOJSON_SCALE);
              setGeojsonData(scaled);
              setMapKey(prev => prev + 1); // Only update key on successful new data
            }
            return;
          }
        }

        if (response.ok) {
          const data = await response.json();
          if (isMounted) {
            const scaled = scaleGeoJSON(data, 1 / GEOJSON_SCALE);
            setGeojsonData(scaled);
            setMapKey(prev => prev + 1);
          }
        } else {
          if (isMounted) setGeojsonData(null);
        }
      } catch (error) {
        if (isMounted) setGeojsonData(null);
      } finally {
        if (isMounted) { }
      }
    };

    loadGeoJSON();

    return () => { isMounted = false; };
  }, [selectedFloor, floors, loadingFloors]);

  // Fonction pour mettre à l'échelle le GeoJSON
  function scaleGeoJSON(geojson: any, scale: number) {
    const g = JSON.parse(JSON.stringify(geojson));
    function rec(coords: any) {
      if (typeof coords[0] === 'number') {
        coords[0] *= scale;
        coords[1] *= scale;
      } else {
        for (const k of coords) rec(k);
      }
    }
    if (g.type === 'FeatureCollection') {
      g.features.forEach((f: any) => rec(f.geometry.coordinates));
    } else if (g.type === 'Feature') {
      rec(g.geometry.coordinates);
    } else {
      rec(g.coordinates);
    }
    return g;
  }

  const availableRooms = useMemo(() => {
    const dbRooms = rooms.map(r => r.room_number);
    // Include "circulation" if any asset is currently in it on this floor
    const hasCirculation = assets.some(a => a.floor === selectedFloor && a.room === 'circulation');
    const list = [...new Set(dbRooms)];
    if (hasCirculation && !list.includes('circulation')) {
      list.push('circulation');
    }
    return list.filter(Boolean).sort();
  }, [rooms, assets, selectedFloor]);


  const availableNatures = useMemo(() => {
    const categoryAssets = assets.filter(a =>
      a.floor === selectedFloor &&
      (filterCategory === 'all' || a.type === filterCategory)
    );
    return [...new Set(categoryAssets.map(a => a.name).filter(Boolean))].sort();
  }, [assets, selectedFloor, filterCategory]);

  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      const floorMatch = asset.floor === selectedFloor;
      const categoryMatch = filterCategory === 'all' || asset.type === filterCategory;
      const natureMatch = filterNature === 'all' || asset.name === filterNature;
      const roomMatch = filterRoom === 'all' ||
        (asset.room && filterRoom && asset.room.toLowerCase() === filterRoom.toLowerCase()) ||
        (asset.room === filterRoom); // Fallback for identical strings or 'circulation'
      
      const searchMatch = !searchQuery.trim() || 
        asset.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.id?.toLowerCase().includes(searchQuery.toLowerCase());

      return floorMatch && categoryMatch && natureMatch && roomMatch && searchMatch;
    });
  }, [assets, selectedFloor, filterCategory, filterNature, filterRoom, searchQuery]);

  // Log pour le débogage
  useEffect(() => {

  }, [assets, selectedFloor, filterCategory, filterNature, filterRoom, filteredAssets]);

  // Nom d'affichage de l'étage sélectionné (mémorisé pour éviter les répétitions)
  const currentFloorDisplayName = useMemo(() => {
    const floor = floors.find(f => f.id === selectedFloor);
    return floor?.description || floor?.name || (selectedFloor !== null ? `${t('rtls.floor')} ${selectedFloor}` : '');
  }, [selectedFloor, floors, t]);

  // Fonction de recherche d'asset par nom
  const handleSearchAsset = async () => {
    if (!searchQuery.trim()) {
      return;
    }

    try {
      setSearching(true);
      const response = await axios.get(`/assets/search`, {
        params: { name: searchQuery.trim() }
      });

      if (response.data.success && response.data.data.length > 0) {
        const foundAsset = response.data.data[0]; // Prendre le premier résultat

        // Sélectionner l'étage de l'asset trouvé
        if (foundAsset.floor_id) {
          setSelectedFloor(foundAsset.floor_id);
          setSelectedAssetId(foundAsset.id);

          // Mettre à jour les assets si nécessaire (ajouter l'asset trouvé aux assets affichés)
          // Convertir les coordonnées de l'asset de la base de données
          if (foundAsset.coordinates_x !== null && foundAsset.coordinates_y !== null) {
            // Convertir category en type
            let assetType: 'person' | 'equipment' | 'patient' = 'equipment';
            if (foundAsset.category === 'person') assetType = 'person';
            else if (foundAsset.category === 'patient') assetType = 'patient';
            else if (foundAsset.category === 'equipment' || foundAsset.category === 'energie') assetType = 'equipment';

            const assetForMap: Asset = {
              id: foundAsset.id,
              name: foundAsset.name,
              type: assetType,
              floor: foundAsset.floor_id,
              zone: foundAsset.zone || '',
              coordinates: {
                x: parseFloat(foundAsset.coordinates_x) || 0,
                y: parseFloat(foundAsset.coordinates_y) || 0
              },
              status: (foundAsset.status === 'active' || foundAsset.status === 'idle' || foundAsset.status === 'offline')
                ? foundAsset.status
                : 'active',
              lastSeen: formatLastSeen(foundAsset.last_seen),
              lastUpdateRaw: foundAsset.last_seen || new Date().toISOString(),
              battery: foundAsset.battery_level !== null ? parseInt(foundAsset.battery_level) : undefined
            };

            // Ajouter ou mettre à jour l'asset dans la liste
            setAssets(prev => {
              const existing = prev.find(a => a.id === foundAsset.id);
              if (existing) {
                return prev.map(a => a.id === foundAsset.id ? assetForMap : a);
              }
              return [...prev, assetForMap];
            });
          }
        }
      } else {
        alert(t('rtls.alerts.noAssetFound'));
        setSelectedAssetId(null);
      }
    } catch (error) {
      alert(t('rtls.alerts.searchError'));
    } finally {
      setSearching(false);
    }
  };

  const handleSnapToRoom = async () => {
    try {
      setSnapping(true);
      const response = await axios.post('/rtls-profiler/snap-to-room');
      if (response.data.success) {
        // Refresh assets list maybe? or it will update via MQTT
        // Force a map key update to redraw if needed
        setMapKey(prev => prev + 1);
      }
    } catch (error) {
      console.error("Error snapping to room", error);
    } finally {
      setSnapping(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'idle': return 'bg-yellow-500';
      case 'offline': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  // Raccourci clavier pour plein écran
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        setFullMap(!fullMap);
      }
      if (e.key === 'Escape' && fullMap) {
        setFullMap(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [fullMap]);

  // Mode plein écran
  if (fullMap) {
    return (
      <div className="fixed inset-0 z-[9999] bg-gray-900 flex flex-col">
        {/* Barre de contrôle plein écran */}
        <div className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#0096D6] rounded-lg">
                <Building className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {currentFloorDisplayName}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">{t('rtls.fullScreenMode')} • {filteredAssets.length} {t('rtls.element', { count: filteredAssets.length })}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedFloor ?? ''}
                onChange={(e) => {
                  setSelectedFloor(parseInt(e.target.value));
                  setFilterRoom('all');
                  setFilterNature('all');
                }}
                className="px-3 py-1.5 text-sm border border-gray-600 rounded-lg bg-gray-700 text-white focus:ring-2 focus:ring-blue-500"
              >
                {floors.map(floor => (
                  <option key={floor.id} value={floor.id}>{floor.description || floor.name}</option>
                ))}
              </select>
              <select
                value={filterCategory}
                onChange={(e) => {
                  setFilterCategory(e.target.value);
                  setFilterNature('all');
                }}
                className="px-3 py-1.5 text-sm border border-gray-600 rounded-lg bg-gray-700 text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">{t('common.all')}</option>
                <option value="person">{t('rtls.types.person')}</option>
                <option value="patient">{t('rtls.types.patient')}</option>
                <option value="equipment">{t('rtls.types.equipment')}</option>
              </select>
              <select
                value={filterNature}
                onChange={(e) => setFilterNature(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-600 rounded-lg bg-gray-700 text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">{t('common.all')}</option>
                {availableNatures.map(nature => (
                  <option key={nature} value={nature}>{nature}</option>
                ))}
              </select>
              <select
                value={filterRoom}
                onChange={(e) => setFilterRoom(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-600 rounded-lg bg-gray-700 text-white focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">{t('common.all')}</option>
                {availableRooms.map(room => (
                  <option key={room} value={room}>{room}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm text-gray-400">
              {filteredAssets.length} {t('rtls.element', { count: filteredAssets.length })} {t('rtls.onFloor')} {selectedFloor}
            </div>
            <button
              onClick={() => setFullMap(false)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors flex items-center gap-2"
              title={t('rtls.tooltips.exitFullScreen')}
            >
              <Minimize2 className="h-4 w-4" />
              <span>{t('common.exit')}</span>
            </button>
          </div>
        </div>

        {/* Carte plein écran */}
        <div className="flex-1 relative">
          <AssetMap
            loadingFloors={loadingFloors}
            selectedFloor={selectedFloor}
            floors={floors}
            mapKey={mapKey}
            geojsonData={geojsonData}
            filteredAssets={filteredAssets}
            selectedAssetId={selectedAssetId}
            isFullscreen={true}
            onShowHistory={openHistory}
          />
        </div>

        {/* Légende en bas */}
        <div className="bg-gray-800 border-t border-gray-700 px-6 py-3 text-xs text-gray-400">
          {t('rtls.displayUnit')} : <b>mm</b> · {t('rtls.doubleClickHint')} · {t('rtls.exitHint')}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('rtls.searchLabel')}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSearchAsset();
                    }
                  }}
                  placeholder={t('rtls.searchPlaceholder')}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
              <button
                onClick={handleSearchAsset}
                disabled={searching || !searchQuery.trim()}
                className="px-6 py-2.5 bg-[#0096D6] hover:bg-[#007BB5] disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors duration-200 flex items-center gap-2 font-medium"
              >
                {searching ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>{t('common.searching')}</span>
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    <span>{t('common.search')}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-4 sm:ml-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {assets.length}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('rtls.totalAssets')}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('common.statusLabels.active')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Floor selector and filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 md:p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 flex-1">
            {/* Étage */}
            <div className="flex-shrink-0 min-w-[140px]">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                {t('common.floor')}
              </label>
              <select
                value={selectedFloor ?? ''}
                onChange={(e) => {
                  setSelectedFloor(parseInt(e.target.value));
                  setFilterRoom('all'); // Reset room on floor change
                  setFilterNature('all');
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm shadow-sm transition-all"
              >
                {floors.map(floor => (
                  <option key={floor.id} value={floor.id}>{floor.name} {floor.description ? `- ${floor.description}` : ''}</option>
                ))}
              </select>
            </div>

            {/* Catégorie */}
            <div className="flex-shrink-0 min-w-[140px]">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                {t('rtls.filters.category') || 'Catégorie'}
              </label>
              <select
                value={filterCategory}
                onChange={(e) => {
                  setFilterCategory(e.target.value);
                  setFilterNature('all'); // Reset nature when category changes
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm shadow-sm transition-all"
              >
                <option value="all">{t('common.all')}</option>
                <option value="person">{t('rtls.types.person')}</option>
                <option value="patient">{t('rtls.types.patient')}</option>
                <option value="equipment">{t('rtls.types.equipment')}</option>
              </select>
            </div>

            {/* Nature */}
            <div className="flex-shrink-0 min-w-[160px]">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                {t('rtls.filters.nature') || 'Nature'}
              </label>
              <select
                value={filterNature}
                onChange={(e) => setFilterNature(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm shadow-sm transition-all"
              >
                <option value="all">{t('common.all')}</option>
                {availableNatures.map(nature => (
                  <option key={nature} value={nature}>{nature}</option>
                ))}
              </select>
            </div>

            {/* Chambre */}
            <div className="flex-shrink-0 min-w-[160px]">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 ml-1">
                {t('rtls.filters.room') || 'Chambre'}
              </label>
              <select
                value={filterRoom}
                onChange={(e) => setFilterRoom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm shadow-sm transition-all"
              >
                <option value="all">{t('common.all')}</option>
                {availableRooms.map(room => (
                  <option key={room} value={room}>{room}</option>
                ))}
              </select>
            </div>

            {/* Reload Button */}
            <div className="flex-shrink-0 pt-6">
              <button
                onClick={() => {
                  setMapKey(prev => prev + 1);
                  const floor = floors.find(f => f.id === selectedFloor);
                  if (floor?.plan) {
                    setGeojsonData(null);
                    setTimeout(() => {
                      const loadGeoJSON = async () => {
                        try {
                          let response = await fetch(`/${floor.plan}`, { cache: 'no-store' });
                          if (!response.ok) {
                            response = await fetch(`http://localhost:3000/${floor.plan}`, { cache: 'no-store' });
                          }
                          if (response.ok) {
                            const data = await response.json();
                            const scaled = scaleGeoJSON(data, 1 / GEOJSON_SCALE);
                            setGeojsonData(scaled);
                          }
                        } catch (error) { }
                      };
                      loadGeoJSON();
                    }, 100);
                  }
                }}
                className="p-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors border border-gray-300 dark:border-gray-600 shadow-sm"
                title={t('rtls.tooltips.reloadPlan')}
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 pr-2">
            <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-full">
              <span className="text-sm font-bold text-blue-700 dark:text-blue-300 whitespace-nowrap">
                {filteredAssets.length} {t('rtls.element', { count: filteredAssets.length })}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Floor map with Leaflet */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Building className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {currentFloorDisplayName}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {t('rtls.floorPlan')} • {filteredAssets.length} {t('rtls.element', { count: filteredAssets.length })}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Eye className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-500 dark:text-gray-400">{t('rtls.realTimeView')}</span>
                <button
                  onClick={() => setFullMap(true)}
                  className="ml-3 px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                  title={t('rtls.tooltips.maximize')}
                >
                  <Maximize2 className="h-4 w-4" />
                  <span>{t('rtls.fullScreen')}</span>
                </button>
              </div>
            </div>

            <AssetMap
              loadingFloors={loadingFloors}
              selectedFloor={selectedFloor}
              floors={floors}
              mapKey={mapKey}
              geojsonData={geojsonData}
              filteredAssets={filteredAssets}
              selectedAssetId={selectedAssetId}
              onShowHistory={openHistory}
            />
          </div>
        </div>

        {/* Assets list */}
        <div className="space-y-4">
          {/* Quick actions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <RefreshCw className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('rtls.quickActions')}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {t('rtls.quickActionsSubtitle')}
                </p>
              </div>
            </div>
            <div className="space-y-2.5">
              <button
                onClick={handleFocusSearch}
                className="w-full flex items-center justify-center space-x-2 bg-[#0096D6] hover:bg-[#007BB5] text-white px-4 py-2 rounded-lg transition-colors duration-200">
                <Search className="h-4 w-4" />
                <span>{t('common.search')}</span>
              </button>
              <button
                onClick={() => setFilterCategory('person')}
                className="w-full flex items-center justify-center space-x-2 bg-[#A2BD30] hover:bg-[#8EA62A] text-white px-4 py-2 rounded-lg transition-all duration-200 shadow-sm">
                <Users className="h-4 w-4" />
                <span>{t('rtls.filterPersonnel')}</span>
              </button>
              <button
                onClick={handleSnapToRoom}
                disabled={snapping}
                className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 disabled:bg-indigo-400">
                {snapping ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>{t('rtls.snapping') || 'Snapping...'}</span>
                  </>
                ) : (
                  <>
                    <MapPin className="h-4 w-4" />
                    <span>{t('rtls.snapToRoom')}</span>
                  </>
                )}
              </button>
              <button
                onClick={handleGlobalView}
                className="w-full flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors duration-200">
                <Maximize2 className="h-4 w-4" />
                <span>{t('rtls.resetView')}</span>
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {t('rtls.floorElements')}
                </h3>
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                  {filteredAssets.length} {t('rtls.asset', { count: filteredAssets.length })} {t('rtls.identified')}
                </p>
              </div>
            </div>

            {/* Asset List */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredAssets.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">{t('rtls.noElementsOnFloor')}</p>
                </div>
              ) : filteredAssets.map((asset) => {
                const IconComponent = RTLS_ICON_COMPONENTS[asset.icon || ''] || (asset.type === 'person' ? UserCheck : asset.type === 'patient' ? Bed : Stethoscope);
                const isSelected = selectedAssetId === asset.id;

                return (
                  <div
                    key={asset.id}
                    onClick={() => setSelectedAssetId(asset.id)}
                    className={`group relative flex items-center space-x-3 p-3 rounded-xl transition-all duration-200 cursor-pointer border-2 ${isSelected
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 shadow-sm'
                      : 'bg-gray-50/50 dark:bg-gray-700/30 border-transparent hover:bg-white dark:hover:bg-gray-700 hover:border-blue-200 dark:hover:border-blue-800'
                      }`}
                  >
                    <div className={`p-2.5 rounded-lg shrink-0 ${asset.type === 'person' ? 'bg-blue-100 dark:bg-blue-900/40' :
                      asset.type === 'patient' ? 'bg-purple-100 dark:bg-purple-900/40' :
                        'bg-green-100 dark:bg-green-900/40'
                      }`}>
                      <IconComponent className="h-5 w-5" style={{ color: asset.color || (asset.type === 'person' ? '#2563eb' : asset.type === 'patient' ? '#7c3aed' : '#059669') }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                          {asset.name}
                        </p>
                        <div className={`w-2 h-2 rounded-full shrink-0 shadow-sm ${getStatusColor(asset.status)} animate-pulse`} />
                      </div>

                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 truncate">
                          {asset.zone || t('rtls.unknownZone')}
                        </span>
                        <span className="text-[10px] text-gray-400">•</span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                          {asset.lastSeen}
                        </span>
                      </div>

                      {asset.battery !== undefined && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${asset.battery > 70 ? 'bg-green-500' :
                                asset.battery > 30 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                              style={{ width: `${asset.battery}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 w-7">
                            {asset.battery}%
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 items-end">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openHistory(asset);
                        }}
                        className={`p-2 rounded-lg transition-all ${isSelected
                          ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100'
                          }`}
                        title={t('rtls.actions.viewHistory')}
                      >
                        <History className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>

      </div>

      {/* Floor overview */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          {t('rtls.globalOverview')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {floors.map((floor) => {
            const floorAssets = assets.filter(a => a.floor === floor.id);
            const activeAssets = floorAssets.filter(a => a.status === 'active');
            const isSelected = selectedFloor === floor.id;

            return (
              <div
                key={floor.id}
                onClick={() => setSelectedFloor(floor.id)}
                className={`p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${isSelected
                  ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 shadow-lg scale-[1.02]'
                  : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex-shrink-0 p-2 rounded-lg ${isSelected
                    ? 'bg-[#0096D6] text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                    }`}>
                    <Building className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm leading-tight mb-2 ${isSelected
                      ? 'text-blue-900 dark:text-blue-100'
                      : 'text-gray-900 dark:text-white'
                      }`}>
                      {floor.name} {floor.description ? `- ${floor.description}` : ''}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${activeAssets.length > 0
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                        : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                        }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5"></span>
                        {activeAssets.length}/{floorAssets.length} {t('common.statusLabels.active')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <HistoryDrawer
        isOpen={showHistory}
        onClose={() => {
          setShowHistory(false);
          setZoneHistory([]);
        }}
        assetName={historyAsset?.name || t('rtls.asset')}
        onTimeRangeChange={(start, end) => {
          if (historyAsset) fetchHistory(historyAsset.id, start, end);
        }}
        initialRange={historyRange}
        zoneHistory={zoneHistory}
      />
    </div >

  );
}
