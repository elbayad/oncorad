import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Wind,
  Thermometer,
  Droplets,
  CheckCircle,
  AlertTriangle,
  Leaf,
  Bell,
  Check,
  Menu,
  Info
} from 'lucide-react';

interface AirQuality {
  id: string;
  name: string;
  floor_id: number;
  floor_name: string;
  zone: string;
  temperature_celsius: number;
  humidity_percent: number;
  co2_ppm: number;
  pm1_ugm3: number;
  pm25_ugm3: number;
  pm10_ugm3: number;
  tvoc_ugm3: number;
  smoke: number;
  presence: number;
  current_status: 'OK' | 'A_SURVEILLER' | 'CRITIQUE';
  reading_time: string;
  delta_guard_active: boolean;
  temp_min_warning?: number;
  temp_max_warning?: number;
  temp_min_critical?: number;
  temp_max_critical?: number;
  hum_min_warning?: number;
  hum_max_warning?: number;
  hum_min_critical?: number;
  hum_max_critical?: number;
  pm25_warning?: number;
  pm25_critical?: number;
  tvoc_warning?: number;
  tvoc_critical?: number;
  co2_warning?: number;
  co2_critical?: number;
}

const THRESHOLDS = {
  pm25: { warning: 10, critical: 35, max: 100 },
  tvoc: { warning: 500, critical: 1500, max: 2000 },
  co2: { warning: 1000, critical: 2000, max: 3000 },
  temp: { min: 18, max: 22, optimal: 20 },
  humidity: { min: 40, max: 60, optimal: 50 }
};

interface RootCause {
  msg: string;
  severity: 'critical' | 'warning';
  type: 'PM25' | 'TVOC' | 'CO2' | 'TEMP' | 'SMOKE' | 'HUMIDITY';
}

const SemiCircleGauge = ({ score }: { score: number }) => {
  // Score de 0 (Critique, Rouge, Droite) à 100 (Bon, Vert, Gauche)
  const normalizedScore = Math.max(0, Math.min(100, score));
  // Angle du pointeur : 180° = 0%, 0° = 100%
  const angle = 180 - (normalizedScore / 100) * 180;

  return (
    <div className="relative flex flex-col items-center">
      <div className="relative w-48 h-24 overflow-hidden">
        {/* Arc de cercle divisé en 3 sections de couleur */}
        <svg viewBox="0 0 200 100" className="w-full h-full transform">
          {/* Section Verte (100 à 66) - A gauche */}
          <path
            d="M 10 100 A 90 90 0 0 1 75.5 13.5"
            fill="none"
            stroke="#10B981"
            strokeWidth="15"
            strokeLinecap="round"
          />
          {/* Section Jaune (66 à 33) - Au milieu */}
          <path
            d="M 75.5 13.5 A 90 90 0 0 1 124.5 13.5"
            fill="none"
            stroke="#F59E0B"
            strokeWidth="15"
          />
          {/* Section Rouge (33 à 0) - A droite */}
          <path
            d="M 124.5 13.5 A 90 90 0 0 1 190 100"
            fill="none"
            stroke="#EF4444"
            strokeWidth="15"
            strokeLinecap="round"
          />

          {/* Pointeur/Aiguille */}
          <g transform={`translate(100, 100) rotate(${angle - 180})`}>
            {/* L'aiguille pointe horizontalement à gauche à 0°, du coup rotate(-180 + angle) */}
            <path d="M 0 -3 L 75 -1 L 75 1 L 0 3 Z" fill="#374151" />
            <circle cx="0" cy="0" r="6" fill="#1F2937" />
          </g>
        </svg>
      </div>

      <div className="absolute bottom-0 flex flex-col items-center justify-end w-full h-full pb-1">
        <span className="text-4xl font-black text-gray-800">{normalizedScore}</span>
      </div>

      <div className="flex w-56 justify-between mt-2 px-2 text-xs font-bold text-gray-500 uppercase">
        <span className="text-emerald-500">BON</span>
        <span className="text-red-500">CRITIQUE</span>
      </div>
    </div>
  );
};


export default function AirGuard() {
  const { t, i18n } = useTranslation();
  const [airData, setAirData] = useState<AirQuality[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAirData();
    const interval = setInterval(fetchAirData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchAirData = async () => {
    try {
      const token = localStorage.getItem('clinicToken');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('/api/air', { headers });
      const result = await response.json();
      if (result.success) {
        setAirData(result.data);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const getAnalysis = (data: AirQuality) => {
    const causes: RootCause[] = [];
    const pm25Crit = Number(data.pm25_critical ?? THRESHOLDS.pm25.critical);
    const pm25Warn = Number(data.pm25_warning ?? THRESHOLDS.pm25.warning);
    const tvocCrit = Number(data.tvoc_critical ?? THRESHOLDS.tvoc.critical);
    const tvocWarn = Number(data.tvoc_warning ?? THRESHOLDS.tvoc.warning);
    const tMaxCrit = Number(data.temp_max_critical ?? THRESHOLDS.temp.max);
    const tMinCrit = Number(data.temp_min_critical ?? THRESHOLDS.temp.min);
    const hMaxCrit = Number(data.hum_max_critical ?? THRESHOLDS.humidity.max);
    const hMinCrit = Number(data.hum_min_critical ?? THRESHOLDS.humidity.min);
    const tMaxWarn = Number(data.temp_max_warning ?? THRESHOLDS.temp.max);
    const tMinWarn = Number(data.temp_min_warning ?? THRESHOLDS.temp.min);
    const hMaxWarn = Number(data.hum_max_warning ?? THRESHOLDS.humidity.max);
    const hMinWarn = Number(data.hum_min_warning ?? THRESHOLDS.humidity.min);

    const pm25Val = Number(data.pm25_ugm3);
    const tvocVal = Number(data.tvoc_ugm3);
    const tempVal = Number(data.temperature_celsius);
    const humVal = Number(data.humidity_percent);

    if (Number(data.smoke) === 1) causes.push({ msg: t('airGuard.smokeDetected'), severity: 'critical', type: 'SMOKE' });
    if (pm25Val > pm25Crit) causes.push({ msg: `PM2.5 critique (> ${pm25Crit})`, severity: 'critical', type: 'PM25' });
    else if (pm25Val > pm25Warn) causes.push({ msg: `PM2.5 élevé (> ${pm25Warn})`, severity: 'warning', type: 'PM25' });
    if (tvocVal > tvocCrit) causes.push({ msg: `TVOC critique (> ${tvocCrit})`, severity: 'critical', type: 'TVOC' });
    else if (tvocVal > tvocWarn) causes.push({ msg: `TVOC élevé (> ${tvocWarn})`, severity: 'warning', type: 'TVOC' });
    if (tempVal > tMaxCrit) causes.push({ msg: "Température critique (élevée)", severity: 'critical', type: 'TEMP' });
    else if (tempVal > tMaxWarn) causes.push({ msg: "Température élevée", severity: 'warning', type: 'TEMP' });
    if (tempVal < tMinCrit) causes.push({ msg: "Température critique (basse)", severity: 'critical', type: 'TEMP' });
    else if (tempVal < tMinWarn) causes.push({ msg: "Température basse", severity: 'warning', type: 'TEMP' });
    if (humVal > hMaxCrit) causes.push({ msg: "Humidité critique (élevée)", severity: 'critical', type: 'HUMIDITY' });
    else if (humVal > hMaxWarn) causes.push({ msg: "Humidité élevée", severity: 'warning', type: 'HUMIDITY' });
    if (humVal < hMinCrit) causes.push({ msg: "Humidité critique (basse)", severity: 'critical', type: 'HUMIDITY' });
    else if (humVal < hMinWarn) causes.push({ msg: "Humidité basse", severity: 'warning', type: 'HUMIDITY' });

    return causes;
  };

  const getHealthScore = (data: AirQuality) => {
    let penalty = 0;
    const pm25Crit = Number(data.pm25_critical ?? THRESHOLDS.pm25.critical);
    const pm25Warn = Number(data.pm25_warning ?? THRESHOLDS.pm25.warning);
    const tvocCrit = Number(data.tvoc_critical ?? THRESHOLDS.tvoc.critical);
    const tvocWarn = Number(data.tvoc_warning ?? THRESHOLDS.tvoc.warning);
    const tMaxCrit = Number(data.temp_max_critical ?? THRESHOLDS.temp.max);
    const tMinCrit = Number(data.temp_min_critical ?? THRESHOLDS.temp.min);
    const hMaxCrit = Number(data.hum_max_critical ?? THRESHOLDS.humidity.max);
    const hMinCrit = Number(data.hum_min_critical ?? THRESHOLDS.humidity.min);
    const tMaxWarn = Number(data.temp_max_warning ?? THRESHOLDS.temp.max);
    const tMinWarn = Number(data.temp_min_warning ?? THRESHOLDS.temp.min);
    const hMaxWarn = Number(data.hum_max_warning ?? THRESHOLDS.humidity.max);
    const hMinWarn = Number(data.hum_min_warning ?? THRESHOLDS.humidity.min);

    const pm25Val = Number(data.pm25_ugm3);
    const tvocVal = Number(data.tvoc_ugm3);
    const tempVal = Number(data.temperature_celsius);
    const humVal = Number(data.humidity_percent);

    if (Number(data.smoke) === 1) penalty += 100;
    if (pm25Val > pm25Crit) penalty += 40; else if (pm25Val > pm25Warn) penalty += 15;
    if (tvocVal > tvocCrit) penalty += 30; else if (tvocVal > tvocWarn) penalty += 10;
    if (tempVal < tMinCrit || tempVal > tMaxCrit) penalty += 30; else if (tempVal < tMinWarn || tempVal > tMaxWarn) penalty += 15;
    if (humVal < hMinCrit || humVal > hMaxCrit) penalty += 30; else if (humVal < hMinWarn || humVal > hMaxWarn) penalty += 15;

    let score = Math.max(0, 100 - penalty);
    if (data.current_status === 'CRITIQUE') return Math.min(score, 45);
    if (data.current_status === 'A_SURVEILLER') return Math.min(score, 75);
    return score;
  };

  const globalHealthScore = useMemo(() => {
    if (airData.length === 0) return 100;
    const scores = airData.map(d => getHealthScore(d));
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }, [airData]);

  const globalStatus = useMemo(() => {
    if (airData.some(d => d.current_status === 'CRITIQUE')) return 'CRITICAL';
    if (airData.some(d => d.current_status === 'A_SURVEILLER')) return 'WARNING';
    return 'OK';
  }, [airData]);

  if (loading && airData.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  // Agrégation des dérives pour la sidebar
  const allCauses = airData.flatMap(sensor => getAnalysis(sensor).map(cause => ({ ...cause, sensorName: sensor.name })));

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* HEADER BAR */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight uppercase">QUALITÉ DE L'AIR – ZONES OPÉRATOIRES</h1>
          <p className="text-sm text-gray-500 mt-0.5">Surveillance environnementale</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-sm text-gray-500">
            Dernière mise à jour : <span className="font-semibold">{new Date().toLocaleTimeString(i18n.language === 'ar' ? 'ar-MA' : 'fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
          <button className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
            <Bell className="h-5 w-5" />
          </button>
          <button className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* MAIN CONTENT - OPTIMIZED FOR 2 BLOCKS (3 EQUAL COLUMNS) */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* COLUMN 1 - GLOBAL STATUS */}
        <div className="flex flex-col gap-6">

          {/* GAUGE CARD */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col relative">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-widest mb-6">STATUT GLOBAL QUALITÉ DE L'AIR</h2>

            <div className="flex justify-between w-full mb-2 items-center">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">INDICE ENVIRONNEMENTAL</span>
              <div className="group relative">
                <Info className="h-4 w-4 text-gray-400 hover:text-blue-500 cursor-help transition-colors" />
                <div className="absolute right-0 top-6 w-80 p-5 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 opacity-0 group-hover:opacity-100 visibility-hidden group-hover:visible transition-all duration-300 z-[100] pointer-events-none max-h-96 overflow-y-auto custom-scrollbar">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white uppercase mb-3 border-b pb-2">Paramètres de Surveillance</h4>
                  <div className="space-y-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-bold text-blue-600">PM 2.5 : Particules Fines</span>
                      <p className="text-[10px] text-gray-500 leading-relaxed text-left">Poussières et fumées microscopiques. Limite recommandée : &lt; 10 µg/m³.</p>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-bold text-emerald-600">TVOC : Composés Volatils</span>
                      <p className="text-[10px] text-gray-500 leading-relaxed text-left">Vapeurs chimiques et solvants. Limite recommandée : &lt; 500 ppb.</p>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-bold text-orange-600">Température</span>
                      <p className="text-[10px] text-gray-500 leading-relaxed text-left">Cible optimale : 18°C – 22°C pour la stérilité et le confort.</p>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[11px] font-bold text-sky-600">Humidité</span>
                      <p className="text-[10px] text-gray-500 leading-relaxed text-left">Cible : 40% – 60% (prévention bactérienne et statique).</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center py-4">
              <SemiCircleGauge score={globalHealthScore} />
            </div>

            <div className="mt-4 flex flex-col items-center">
              {globalStatus === 'WARNING' && (
                <div className="bg-orange-500 text-white text-sm font-bold px-4 py-1 rounded-full uppercase truncate mb-2">
                  DÉRIVE
                </div>
              )}
              {globalStatus === 'CRITICAL' && (
                <div className="bg-red-600 text-white text-sm font-bold px-4 py-1 rounded-full uppercase truncate mb-2">
                  CRITIQUE
                </div>
              )}
              {globalStatus === 'OK' && (
                <div className="bg-emerald-500 text-white text-sm font-bold px-4 py-1 rounded-full uppercase truncate mb-2">
                  CONFORME
                </div>
              )}
              <div className="text-sm font-bold text-gray-600 uppercase tracking-wider">
                {airData.length} ZONES MONITORÉES
              </div>
            </div>
          </div>

          {/* PARAMETERS OFF LIMITS */}
          <div className={`bg-white rounded-xl shadow-sm border p-6 flex-1 flex flex-col
            ${globalStatus === 'WARNING' ? 'border-orange-200' : globalStatus === 'CRITICAL' ? 'border-red-200' : 'border-emerald-200'}`}>

            <div className="mb-6">
              <h2 className={`text-lg font-black uppercase flex items-center gap-2
                 ${globalStatus === 'WARNING' ? 'text-orange-600' : globalStatus === 'CRITICAL' ? 'text-red-600' : 'text-emerald-600'}`}>
                {globalStatus === 'WARNING' ? <AlertTriangle className="h-5 w-5" /> : globalStatus === 'CRITICAL' ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                {globalStatus === 'WARNING' ? 'DÉRIVE ENVIRONNEMENTALE' : globalStatus === 'CRITICAL' ? 'ÉTAT CRITIQUE' : 'TOUT EST CONFORME'}
              </h2>
              <p className="text-sm font-bold text-gray-500 tracking-wider mt-1">{airData.length} ZONES MONITORÉES</p>
            </div>

            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 border-b pb-2">PARAMÈTRES HORS PLAGE</h3>

            <div className="flex-1 overflow-y-auto space-y-4">
              {allCauses.length === 0 ? (
                <p className="text-sm text-gray-500 font-medium">Aucun paramètre en dérive.</p>
              ) : (
                // Grouping causes by type to mimic mock
                ["TEMP", "HUMIDITY", "PM2.5", "TVOC"].map(causeType => {
                  const matchedCauses = allCauses.filter(c => c.type === causeType || (causeType === "PM2.5" && c.type === "PM25"));
                  if (matchedCauses.length === 0) return null;

                  return (
                    <div key={causeType} className="flex items-start gap-3">
                      {causeType === "TEMP" && <Thermometer className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />}
                      {(causeType === "PM2.5" || causeType === "HUMIDITY") && <Droplets className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />}
                      {causeType === "TVOC" && <Leaf className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />}

                      <div>
                        <span className="font-bold text-gray-800 text-sm">{causeType === "TEMP" ? "Température" : causeType === "PM2.5" ? "PM2.5" : causeType === "HUMIDITY" ? "Humidité" : "TVOC"} </span>
                        <span className="text-sm text-gray-900 font-semibold">{matchedCauses.map(c => c.sensorName).join(', ')}</span>
                        {/* In a real scenario we could aggregate min/max here, keeping it generic over the matched causes for now */}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="mt-6 pt-4 border-t flex justify-between items-center bg-gray-50 -mx-6 -mb-6 p-4 rounded-b-xl shrink-0">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">CONFORMITÉ ENVIRONNEMENTALE</span>
              <span className="text-sm font-black text-gray-800">{airData.reduce((acc, sensor) => acc + (getHealthScore(sensor) > 75 ? 1 : 0), 0)} / {airData.length}</span>
            </div>
          </div>
        </div>

        {/* COLUMNS 2 & 3 - SENSOR BLOCKS */}
        {airData.map(sensor => {
          const pm25Warn = Number(sensor.pm25_warning ?? THRESHOLDS.pm25.warning);
          const tvocWarn = Number(sensor.tvoc_warning ?? THRESHOLDS.tvoc.warning);
          const tMaxWarn = Number(sensor.temp_max_warning ?? THRESHOLDS.temp.max);
          const tMinWarn = Number(sensor.temp_min_warning ?? THRESHOLDS.temp.min);
          const hMaxWarn = Number(sensor.hum_max_warning ?? THRESHOLDS.humidity.max);
          const hMinWarn = Number(sensor.hum_min_warning ?? THRESHOLDS.humidity.min);

          const pm25Val = Number(sensor.pm25_ugm3);
          const tvocVal = Number(sensor.tvoc_ugm3);
          const tempVal = Number(sensor.temperature_celsius);
          const humVal = Number(sensor.humidity_percent);

          const isCritical = sensor.current_status === 'CRITIQUE';
          const isWarning = sensor.current_status === 'A_SURVEILLER';

          const conformCount = (tempVal >= tMinWarn && tempVal <= tMaxWarn ? 1 : 0) +
            (humVal >= hMinWarn && humVal <= hMaxWarn ? 1 : 0) +
            (pm25Val <= pm25Warn ? 1 : 0) +
            (tvocVal <= tvocWarn ? 1 : 0);

          return (
            <div key={sensor.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col hover:shadow-md transition-shadow self-start">
              {/* Card Header */}
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-black text-gray-900 uppercase">{sensor.name}</h3>
                <div className={`px-2 py-1 text-[10px] font-bold rounded flex items-center gap-1 uppercase tracking-wider
                      ${isCritical ? 'bg-red-100 text-red-700' : isWarning ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {conformCount} / 4 {isCritical ? 'CRITIQUE' : isWarning ? 'DÉRIVE' : 'CONFORME'}
                </div>
              </div>

              {/* Metrics Grid 2x2 */}
              <div className="grid grid-cols-2 gap-4">

                {/* Temperature */}
                <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 mb-2 opacity-70">
                    <Thermometer className="h-4 w-4 text-gray-500" />
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Température</span>
                  </div>
                  <div>
                    <div className="text-4xl font-black text-gray-900 leading-none tracking-tight">
                      {tempVal.toFixed(1)}<span className="text-sm text-gray-400 font-bold ml-1 uppercase">°C</span>
                    </div>
                    <div className={`text-[11px] font-bold mt-3 inline-flex items-center px-2 py-0.5 rounded-full shadow-sm
                         ${tempVal < tMinWarn || tempVal > tMaxWarn ? 'bg-orange-500 text-white' : 'bg-emerald-500 text-white'}`}>
                      {tempVal < tMinWarn ? '⚠ BASSE' : tempVal > tMaxWarn ? '⚠ ÉLEVÉE' : '✓ CONFORME'}
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-400 font-bold mt-3 uppercase tracking-tighter">
                    Cible : <span className="text-gray-500">{tMinWarn}–{tMaxWarn}°C</span>
                  </div>
                </div>

                {/* Humidity */}
                <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5 mb-2 opacity-70">
                    <Droplets className="h-4 w-4 text-gray-500" />
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Humidité</span>
                  </div>
                  <div>
                    <div className="text-4xl font-black text-gray-900 leading-none tracking-tight">
                      {humVal.toFixed(0)}<span className="text-sm text-gray-400 font-bold ml-1 uppercase">%</span>
                    </div>
                    <div className={`text-[11px] font-bold mt-3 inline-flex items-center px-2 py-0.5 rounded-full shadow-sm
                         ${humVal < hMinWarn || humVal > hMaxWarn ? 'bg-orange-500 text-white' : 'bg-emerald-500 text-white'}`}>
                      {humVal < hMinWarn ? '⚠ BASSE' : humVal > hMaxWarn ? '⚠ ÉLEVÉE' : '✓ CONFORME'}
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-400 font-bold mt-3 uppercase tracking-tighter">
                    Cible : <span className="text-gray-500">{hMinWarn}–{hMaxWarn}%</span>
                  </div>
                </div>

                {/* PM2.5 */}
                <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-1.5 mb-2 opacity-70">
                    <Wind className="h-4 w-4 text-gray-500" />
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">PM2.5</span>
                  </div>
                  <div className="text-2xl font-black text-gray-900 leading-none">
                    {pm25Val.toFixed(1)}<span className="text-xs text-gray-400 font-bold ml-1 uppercase">µG/M³</span>
                  </div>
                  <div className={`text-[10px] font-bold mt-2.5 inline-flex items-center px-2 py-0.5 rounded-full shadow-sm
                         ${pm25Val > pm25Warn ? 'bg-orange-500 text-white' : 'bg-emerald-500 text-white'}`}>
                    {pm25Val > pm25Warn ? '⚠ ÉLEVÉ' : '✓ OPTIMAL'}
                  </div>
                  <div className="text-[10px] text-gray-400 font-bold mt-2.5 uppercase tracking-tighter">
                    LIMITE : <span className="text-gray-500">&lt; {pm25Warn}</span>
                  </div>
                </div>

                {/* TVOC */}
                <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-1.5 mb-2 opacity-70">
                    <Leaf className="h-4 w-4 text-gray-500" />
                    <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">TVOC</span>
                  </div>
                  <div className="text-2xl font-black text-gray-900 leading-none">
                    {tvocVal.toFixed(0)}<span className="text-xs text-gray-400 font-bold ml-1 uppercase">PPB</span>
                  </div>
                  <div className={`text-[10px] font-bold mt-2.5 inline-flex items-center px-2 py-0.5 rounded-full shadow-sm
                         ${tvocVal > tvocWarn ? 'bg-orange-500 text-white' : 'bg-emerald-500 text-white'}`}>
                    {tvocVal > tvocWarn ? '⚠ ÉLEVÉ' : '✓ OPTIMAL'}
                  </div>
                  <div className="text-[10px] text-gray-400 font-bold mt-2.5 uppercase tracking-tighter">
                    LIMITE : <span className="text-gray-500">&lt; {tvocWarn}</span>
                  </div>
                </div>

              </div>
            </div>
          );
        })}
      </main>

      {/* FOOTER ALERTS */}
      <footer className="bg-gray-100 border-t border-gray-200 p-4">
        <div className="max-w-screen-xl mx-auto flex flex-col md:flex-row items-center gap-6 justify-between">
          <div className="flex flex-col gap-1 w-full md:w-auto">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">ALERTES ACTIVES</h3>
            {allCauses.length > 0 ? (
              <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
                {allCauses.map((cause, i) => (
                  <div key={i} className={`flex items-start gap-2 min-w-[200px] border-l-2 pl-3 py-1 ${cause.severity === 'critical' ? 'border-red-500' : 'border-orange-500'}`}>
                    <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${cause.severity === 'critical' ? 'text-red-500' : 'text-orange-500'}`} />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-gray-800">{cause.sensorName} <span className="font-medium text-gray-600">{cause.msg}</span></span>
                      <span className="text-xs text-gray-400">Dérive détectée</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500 font-medium">Aucune alerte en cours.</div>
            )}
          </div>

          <button className="bg-[#1a56db] hover:bg-blue-700 text-white px-6 py-2.5 rounded text-xs font-bold uppercase tracking-wider shadow-sm flex items-center gap-2 shrink-0 transition-colors">
            <Check className="h-4 w-4" /> ACCUSER RÉCEPTION
          </button>
        </div>
      </footer>
    </div>
  );
}