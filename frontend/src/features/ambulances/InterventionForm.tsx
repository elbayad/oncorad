import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { X, MapPin, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface InterventionFormProps {
  isOpen: boolean;
  onClose: () => void;
  ambulance: {
    id: string;
    last_latitude?: number;
    last_longitude?: number;
    imei_tablette?: string;
  } | null;
  onMissionSent?: () => void; // Callback pour rafraîchir la liste après envoi réussi
}

interface FormData {
  remarque: string;
  Address: string;
  Description: string;
  gravite: string;
  nombreVictimes: string;
  Type: string;
}

const InterventionForm: React.FC<InterventionFormProps> = ({ isOpen, onClose, ambulance, onMissionSent }) => {
  const [formData, setFormData] = useState<FormData>({
    remarque: '',
    Address: '',
    Description: '',
    gravite: 'high',
    nombreVictimes: '1',
    Type: 'accident'
  });

  const { t } = useTranslation();

  const [selectedPosition, setSelectedPosition] = useState<[number, number] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Centrage par défaut: Madinat Siha Safi
  const defaultCenter: [number, number] = [32.290209, -9.2269851];

  // Icône pour le marqueur de position sélectionnée
  const selectedIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [0, -28],
    shadowSize: [41, 41]
  });

  // Composant pour capturer les clics sur la carte
  function MapClickHandler() {
    useMapEvents({
      click: (e) => {
        const { lat, lng } = e.latlng;
        setSelectedPosition([lat, lng]);
      },
    });
    return null;
  }

  useEffect(() => {
    if (!isOpen) {
      setFormData({
        remarque: '',
        Address: '',
        Description: '',
        gravite: 'high',
        nombreVictimes: '1',
        Type: 'accident'
      });
      setSelectedPosition(null);
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Vérifications
    if (!ambulance) {
      setError(t('ambulance.form.errors.noAmbulance'));
      return;
    }

    if (!ambulance.last_latitude || !ambulance.last_longitude) {
      setError(t('ambulance.form.errors.positionUnavailable'));
      return;
    }

    if (!ambulance.imei_tablette) {
      setError(t('ambulance.form.errors.imeiUnavailable', { id: ambulance.id }));
      return;
    }

    if (!selectedPosition) {
      setError(t('ambulance.form.errors.noTarget'));
      return;
    }

    // Demander confirmation avant d'envoyer
    const confirmed = window.confirm(
      t('ambulance.form.confirmSend')
    );

    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Générer un ID unique pour la mission (utiliser timestamp pour plus d'unicité)
      const missionId = Math.floor(Math.random() * 1000);

      // Préparer les données (convertir en nombres pour s'assurer que ce sont des nombres)
      const startLat = Number(ambulance.last_latitude);
      const startLng = Number(ambulance.last_longitude);
      const endLat = selectedPosition[0];
      const endLng = selectedPosition[1];

      // Formater la remarque avec ville et date (si vide, envoyer chaîne vide)
      const today = new Date().toISOString().split('T')[0];
      const remarqueFormatted = formData.remarque.trim()
        ? `${formData.remarque} – ville:3 – date:${today}`
        : '';

      // Préparer le JSON
      const payload = {
        pairs: [
          {
            start: `${startLng},${startLat}`,
            end: `${endLng},${endLat}`,
            id: missionId,
            assigned_to: ambulance.imei_tablette,
            deviceID: ambulance.imei_tablette,
            image: "https://fastly.picsum.photos/id/410/640/360.jpg?hmac=t-kRimBGV420ia2gIMbTWYq0CR_YRQp1sdPoUFtwdPw",
            remarque: remarqueFormatted,
            Address: formData.Address,
            Description: formData.Description,
            gravite: formData.gravite,
            nombreVictimes: formData.nombreVictimes,
            Type: formData.Type
          }
        ]
      };

      // Envoyer la requête
      const myHeaders = new Headers();
      myHeaders.append("Content-Type", "application/json");
      myHeaders.append("Cookie", "frontend_lang=fr_FR");

      const requestOptions = {
        method: "POST",
        headers: myHeaders,
        body: JSON.stringify(payload),
        redirect: "follow" as RequestRedirect
      };


      const response = await fetch("http://rabat.geodaki.com:3006/api/distances", requestOptions);

      // Essayer de parser la réponse comme JSON, sinon utiliser text()
      let result;
      try {
        result = await response.json();
      } catch {
        result = await response.text();
      }



      if (response.ok) {
        setSuccess(true);

        // Mettre à jour le statut de l'ambulance à "en-route"
        try {
          const token = localStorage.getItem('clinicToken');
          const updateResponse = await fetch(`/api/ambulances/${ambulance.id}/status`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'en-route' })
          });

          if (updateResponse.ok) {
            // Rafraîchir la liste des ambulances si callback fourni
            if (onMissionSent) {
              onMissionSent();
            }
          } else {
          }
        } catch (updateError) {
          // Ne pas bloquer le processus si la mise à jour échoue
        }

        setTimeout(() => {
          onClose();
        }, 2000);
      } else if (response.status === 409) {
        // Conflit - ambulance déjà assignée à une mission
        const errorMessage = typeof result === 'object' && result.message
          ? result.message
          : typeof result === 'string'
            ? result
            : 'Un conflit est survenu.';

        // Message spécifique selon le type de conflit
        let userMessage = t('ambulance.form.errors.conflict');
        if (errorMessage.includes('already accepted') || errorMessage.includes('déjà assignée')) {
          userMessage = t('ambulance.form.errors.alreadyAssigned');
        } else if (errorMessage.includes('ID') || errorMessage.includes('id')) {
          userMessage = t('ambulance.form.errors.duplicateMission');
        } else {
          userMessage = `⚠️ ${errorMessage}`;
        }

        setError(userMessage);
      } else {
        const errorMessage = typeof result === 'object' && result.message
          ? result.message
          : typeof result === 'string'
            ? result
            : `Erreur ${response.status}: ${response.statusText}`;

        setError(`Erreur ${response.status}: ${errorMessage}`);
      }
    } catch (err: any) {
      setError(t('ambulance.form.errors.connectionError', { error: err.message || t('common.unknownError') }));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between z-10">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {t('ambulance.form.title')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Messages d'erreur/succès */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg">
              {t('ambulance.form.success')}
            </div>
          )}

          {/* Informations ambulance */}
          {ambulance && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>{t('common.ambulance')}:</strong> {ambulance.id}
                {ambulance.last_latitude && ambulance.last_longitude && (
                  <span className="ml-4">
                    <strong>{t('ambulance.form.currentPosition')}:</strong> {Number(ambulance.last_latitude).toFixed(6)}, {Number(ambulance.last_longitude).toFixed(6)}
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Grille de formulaire */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('common.description')}
              </label>
              <textarea
                value={formData.Description}
                onChange={(e) => handleInputChange('Description', e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('common.gravity')} *
              </label>
              <select
                value={formData.gravite}
                onChange={(e) => handleInputChange('gravite', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="high">{t('common.high')}</option>
                <option value="medium">{t('common.medium')}</option>
                <option value="low">{t('common.low')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('ambulance.form.victimCount')} *
              </label>
              <input
                type="number"
                min="1"
                value={formData.nombreVictimes}
                onChange={(e) => handleInputChange('nombreVictimes', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('ambulance.form.interventionType')} *
              </label>
              <select
                value={formData.Type}
                onChange={(e) => handleInputChange('Type', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="accident">{t('ambulance.form.types.accident')}</option>
                <option value="medical_emergency">{t('ambulance.form.types.medicalEmergency')}</option>
                <option value="transfer">{t('ambulance.form.types.transfer')}</option>
                <option value="other">{t('common.other')}</option>
              </select>
            </div>
          </div>

          {/* Carte pour sélectionner la position */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('ambulance.form.selectDestination')} *
            </label>
            <div className="rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600" style={{ height: '400px' }}>
              <MapContainer
                center={selectedPosition || defaultCenter}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler />
                {selectedPosition && (
                  <Marker position={selectedPosition} icon={selectedIcon}>
                    <Popup>
                      <div className="space-y-1">
                        <div className="font-semibold">{t('ambulance.form.destination')}</div>
                        <div className="text-xs">{selectedPosition[0].toFixed(6)}, {selectedPosition[1].toFixed(6)}</div>
                      </div>
                    </Popup>
                  </Marker>
                )}
                {ambulance?.last_latitude && ambulance?.last_longitude && (
                  <Marker
                    position={[Number(ambulance.last_latitude), Number(ambulance.last_longitude)]}
                    icon={L.icon({
                      iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
                      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
                      iconSize: [25, 41],
                      iconAnchor: [12, 41],
                      popupAnchor: [0, -28],
                      shadowSize: [41, 41]
                    })}
                  >
                    <Popup>
                      <div className="space-y-1">
                        <div className="font-semibold">{t('ambulance.form.ambulancePosition')}</div>
                        <div className="text-xs">{Number(ambulance.last_latitude).toFixed(6)}, {Number(ambulance.last_longitude).toFixed(6)}</div>
                      </div>
                    </Popup>
                  </Marker>
                )}
              </MapContainer>
            </div>
            {selectedPosition && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 flex items-center space-x-1">
                <MapPin className="h-4 w-4" />
                <span>Lat: {selectedPosition[0].toFixed(6)}, Lng: {selectedPosition[1].toFixed(6)}</span>
              </p>
            )}
          </div>

          {/* Boutons */}
          <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              disabled={isSubmitting}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedPosition}
              className="px-6 py-2 bg-[#0096D6] hover:bg-[#007BB5] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{t('common.sending')}...</span>
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  <span>{t('ambulance.form.sendRequest')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InterventionForm;
