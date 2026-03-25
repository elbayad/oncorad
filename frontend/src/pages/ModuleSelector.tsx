import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  Ambulance,
  MapPin,

  Zap,
  Wind,
  Heart,
  ArrowRight,
  Lock,
  ClipboardList
} from 'lucide-react';

export default function ModuleSelector() {
  const { hasModuleAccess } = useAuth();
  const { t } = useTranslation();

  const modules = [
    {
      id: 'ambutrack',
      name: t('moduleNames.ambulances'),
      description: t('moduleDescriptions.ambulancesLong'),
      details: t('moduleDescriptions.ambulancesDetails'),
      path: '/ambulances',
      icon: Ambulance,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-800',
      features: [t('moduleFeatures.gpsTracking'), t('moduleFeatures.autoDispatch'), t('moduleFeatures.missionHistory')]
    },
    {
      id: 'floortrace',
      name: t('moduleNames.geolocation'),
      description: t('moduleDescriptions.geolocationLong'),
      details: t('moduleDescriptions.geolocationDetails'),
      path: '/rtls',
      icon: MapPin,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800',
      features: [t('moduleFeatures.floor3dView'), t('moduleFeatures.realtimeLocation'), t('moduleFeatures.definedZones')]
    },
    {
      id: 'energypulse',
      name: t('moduleNames.energyMonitoring'),
      description: t('moduleDescriptions.energyMonitoringLong'),
      details: t('moduleDescriptions.energyMonitoringDetails'),
      path: '/energy',
      icon: Zap,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      borderColor: 'border-yellow-200 dark:border-yellow-800',
      features: [t('moduleFeatures.realtimeConsumption'), t('moduleFeatures.predictiveAnalysis'), t('moduleFeatures.energyReports')]
    },
    {
      id: 'airguard',
      name: t('moduleNames.airQuality'),
      description: t('moduleDescriptions.airQualityLong'),
      details: t('moduleDescriptions.airQualityDetails'),
      path: '/air',
      icon: Wind,
      color: 'text-cyan-600 dark:text-cyan-400',
      bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
      borderColor: 'border-cyan-200 dark:border-cyan-800',
      features: [t('moduleFeatures.realtimeAirQuality'), t('moduleFeatures.contaminantDetection'), t('moduleFeatures.cleanZones')]
    },
    {
      id: 'oxyflow',
      name: t('moduleNames.oxygenMonitoring'),
      description: t('moduleDescriptions.oxygenMonitoringLong'),
      details: t('moduleDescriptions.oxygenMonitoringDetails'),
      path: '/oxygen',
      icon: Heart,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
      features: [t('moduleFeatures.realtimePressure'), t('moduleFeatures.leakDetection'), t('moduleFeatures.predictiveMaintenance')]
    },
    {
      id: 'reporting',
      name: t('sidebar.reportingGlobal'),
      description: t('reporting.subtitle'),
      details: t('reporting.sensorOverview'),
      path: '/reporting',
      icon: ClipboardList,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
      borderColor: 'border-emerald-200 dark:border-emerald-800',
      features: [t('reporting.total'), t('reporting.uptime'), t('reporting.consumptionEnvironment')]
    }
  ];

  return (
    <div className="space-y-6 pt-2">
      {/* Modules grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {modules.map((module) => {
          const hasAccess = hasModuleAccess(module.id);
          const Icon = module.icon;

          return (
            <div
              key={module.id}
              className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border transition-all duration-200 ${hasAccess
                ? `${module.borderColor} hover:shadow-lg hover:-translate-y-1 cursor-pointer`
                : 'border-gray-200 dark:border-gray-700 opacity-60 cursor-not-allowed'
                }`}
            >
              {hasAccess ? (
                <Link to={module.path} className="block p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-lg ${module.bgColor}`}>
                      <Icon className={`h-6 w-6 ${module.color}`} />
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {module.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {module.description}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
                    {module.details}
                  </p>

                  <div className="space-y-1">
                    {module.features.map((feature, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="w-1 h-1 bg-gray-400 rounded-full" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {feature}
                        </span>
                      </div>
                    ))}
                  </div>
                </Link>
              ) : (
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-700">
                      <Icon className="h-6 w-6 text-gray-400" />
                    </div>
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>

                  <h3 className="text-lg font-semibold text-gray-500 dark:text-gray-400 mb-2">
                    {module.name}
                  </h3>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mb-3">
                    {module.description}
                  </p>
                  <p className="text-xs text-red-500 dark:text-red-400">
                    {t('moduleStatus.unauthorizedAccess')}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}