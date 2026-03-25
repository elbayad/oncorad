import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  Users,
  Activity,
  AlertTriangle,
  CheckCircle,
  Ambulance,
  MapPin,
  Zap,
  Wind,
  ClipboardList
} from 'lucide-react';
import mqttService from '../services/mqttService';

export default function Dashboard() {
  const { user, hasModuleAccess } = useAuth();
  const { t } = useTranslation();

  interface ActivityItem {
    time: string;
    module: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
  }

  const [recentActivity, setRecentActivity] = React.useState<ActivityItem[]>([
    { time: '14:15', module: t('moduleNames.ambulances'), message: 'Ambulance #AMB-03 arrivée étage 5', type: 'success' },
    { time: '13:45', module: t('moduleNames.airQuality'), message: 'Qualité air excellente - Étage 3', type: 'success' },
    { time: '13:30', module: t('moduleNames.energyMonitoring'), message: 'Pic de consommation détecté - Étage 7', type: 'info' }
  ]);

  const [stats, setStats] = React.useState({
    activeModules: user?.modules.length || 0,
    activeAlerts: 0,
    systemsOk: 0,
    connectedUsers: 0
  });

  React.useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem('clinicToken');
        const res = await fetch('/api/reporting/dashboard-stats', {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        const json = await res.json();
        if (json.success) {
          setStats(json.data);
        }
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 60000); // 1 min update
    return () => clearInterval(interval);
  }, [user]);

  React.useEffect(() => {
    const handleMqttMessage = (topic: string, message: unknown) => {
      if (topic === 'alarm/sub/topic') {
        const payload = message as any;
        const sirenData = payload.data || payload;

        let msgText = '';

        if (sirenData.state1 === 'ON') msgText += `Sortie 1 Activée (Sirène ${sirenData.mac}) `;
        if (sirenData.state2 === 'ON') msgText += `Sortie 2 Activée (Sirène ${sirenData.mac}) `;

        if (msgText) {
          const newActivity: ActivityItem = {
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            module: 'Sirènes (Geofence)',
            message: msgText,
            type: 'error'
          };

          setRecentActivity(prev => [newActivity, ...prev].slice(0, 10));
        }
      }
    };

    mqttService.subscribe('alarm/sub/topic', handleMqttMessage);
    return () => {
      mqttService.unsubscribe('alarm/sub/topic', handleMqttMessage);
    };
  }, []);

  const quickStats = [
    {
      title: t('dashboard.activeModules'),
      value: stats.activeModules,
      icon: Activity,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    },
    {
      title: t('dashboard.activeAlerts'),
      value: stats.activeAlerts,
      icon: AlertTriangle,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20'
    },
    {
      title: t('dashboard.systemsOk'),
      value: stats.systemsOk,
      icon: CheckCircle,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20'
    },
    {
      title: t('dashboard.connectedUsers'),
      value: stats.connectedUsers,
      icon: Users,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20'
    }
  ];

  const moduleCards = [
    {
      id: 'ambutrack',
      name: t('moduleNames.ambulances'),
      description: t('moduleDescriptions.ambulancesLong'),
      path: '/ambulances',
      icon: Ambulance,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      status: t('moduleStatus.activeAmbulances')
    },
    {
      id: 'floortrace',
      name: t('moduleNames.geolocation'),
      description: t('moduleDescriptions.geolocationLong'),
      path: '/rtls',
      icon: MapPin,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      status: t('moduleStatus.trackedAssets')
    },
    {
      id: 'energypulse',
      name: t('moduleNames.energyMonitoring'),
      description: t('moduleDescriptions.energyMonitoringLong'),
      path: '/energy',
      icon: Zap,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      status: t('moduleStatus.normalConsumption')
    },
    {
      id: 'airguard',
      name: t('moduleNames.airQuality'),
      description: t('moduleDescriptions.airQualityLong'),
      path: '/air',
      icon: Wind,
      color: 'text-cyan-600 dark:text-cyan-400',
      bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
      status: t('moduleStatus.excellentQuality')
    },
    {
      id: 'oxyflow',
      name: t('moduleNames.oxygenMonitoring'),
      description: t('moduleDescriptions.oxygenMonitoringLong'),
      path: '/oxygen',
      icon: Activity,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      status: t('moduleStatus.optimalPressure')
    },
    {
      id: 'reporting',
      name: t('sidebar.reportingGlobal'),
      description: t('reporting.subtitle'),
      path: '/reporting',
      icon: ClipboardList,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
      status: t('common.active')
    }
  ];

  return (
    <div className="space-y-6">
      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.title}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow duration-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Module access grid */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          {t('dashboard.availableModules')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {moduleCards.map((module) => {
            if (!hasModuleAccess(module.id)) return null;

            const Icon = module.icon;
            return (
              <Link
                key={module.id}
                to={module.path}
                className="group bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-lg ${module.bgColor} group-hover:scale-110 transition-transform duration-200`}>
                    <Icon className={`h-6 w-6 ${module.color}`} />
                  </div>
                  <div className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-full">
                    {t('common.active')}
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                  {module.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {module.description}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  {module.status}
                </p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent activity */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('dashboard.recentActivity')}
        </h2>
        <div className="space-y-3">
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-500 italic">{t('dashboard.noRecentActivity')}</p>
          ) : (
            recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200">
                <div className={`w-2 h-2 rounded-full ${activity.type === 'warning' ? 'bg-orange-500' :
                  activity.type === 'success' ? 'bg-green-500' :
                    activity.type === 'error' ? 'bg-red-500' : 'bg-[#0096D6]'
                  }`} />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {activity.module}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {activity.time}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {activity.message}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}