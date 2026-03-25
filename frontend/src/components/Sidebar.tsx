import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import {
  X,
  LayoutDashboard,
  ClipboardList,
  UserPlus,
  UserRound,
  Ambulance,
  MapPin,
  Activity,
  Sparkles,
  Settings,
  Zap
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, hasModuleAccess } = useAuth();
  const location = useLocation();
  const { t } = useTranslation();

  const modules = [
    {
      id: 'floortrace',
      name: t('moduleNames.geolocation'),
      description: t('moduleDescriptions.geolocation'),
      path: '/rtls',
      icon: MapPin,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    },
    {
      id: 'oxyflow',
      name: t('moduleNames.oxygenMonitoring'),
      description: t('moduleDescriptions.oxygenMonitoring'),
      path: '/oxygen',
      icon: Activity,
      color: 'text-blue-500 dark:text-blue-300',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20'
    },
    {
      id: 'airguard',
      name: t('moduleNames.airQuality'),
      description: t('moduleDescriptions.airQuality'),
      path: '/air',
      icon: Sparkles,
      color: 'text-sky-600 dark:text-sky-400',
      bgColor: 'bg-sky-50 dark:bg-sky-900/20'
    },
    {
      id: 'energypulse',
      name: t('moduleNames.energyMonitoring'),
      description: t('moduleDescriptions.energyMonitoring'),
      path: '/energy',
      icon: Zap,
      color: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20'
    },
    {
      id: 'ambutrack',
      name: t('moduleNames.ambulances'),
      description: t('moduleDescriptions.ambulances'),
      path: '/ambulances',
      icon: Ambulance,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20'
    },
    {
      id: 'reporting',
      name: t('sidebar.reportingGlobal'),
      description: t('reporting.subtitle'),
      path: '/reporting',
      icon: ClipboardList,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20'
    }
  ];

  const navigation = [
    { name: t('sidebar.dashboard'), path: '/', icon: LayoutDashboard },
    { name: t('sidebar.admission'), path: '/admission', icon: UserPlus },
    { name: t('sidebar.patientRecord'), path: '/dossier-patient', icon: UserRound },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 shadow-xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-6">
            <Link to="/" className="flex items-center">
              <img src="/logo.png" alt="Oncorad Group" className="h-10 w-auto" />
            </Link>

            <button
              onClick={onClose}
              className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>


          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            <div className="space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={`flex items-center space-x-4 px-4 py-3 rounded-full transition-all duration-200 group ${isActive(item.path)
                      ? 'bg-[#0096D6] text-white shadow-md'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-[#0096D6] hover:text-white'
                      }`}
                  >
                    <Icon className={`h-5 w-5 transition-colors duration-200 ${isActive(item.path) ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
                    <span className="font-semibold text-[15px]">{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* Modules Section */}
            <div className="pt-6">
              <h3 className="text-[13px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-4 px-6">
                {t('sidebar.iotModules')}
              </h3>
              <div className="space-y-1 px-3">
                {modules.map((module) => {
                  if (!hasModuleAccess(module.id)) return null;

                  const Icon = module.icon;
                  return (
                    <Link
                      key={module.path}
                      to={module.path}
                      onClick={onClose}
                      className={`group flex items-center space-x-4 px-4 py-2.5 rounded-full transition-all duration-200 ${isActive(module.path)
                        ? 'bg-[#0096D6] text-white shadow-md'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-[#0096D6] hover:text-white'
                        }`}
                    >
                      <Icon className={`h-5 w-5 transition-colors duration-200 ${isActive(module.path) ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
                      <span className="font-semibold text-[15px]">{module.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
            {/* Administration Link (Bottom) */}
            {user?.role === 'admin' && (
              <div className="pt-2 px-3">
                <Link
                  to="/admin"
                  onClick={onClose}
                  className={`flex items-center space-x-4 px-4 py-2.5 rounded-full transition-all duration-200 group ${isActive('/admin')
                    ? 'bg-[#0096D6] text-white shadow-md'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-[#0096D6] hover:text-white'
                    }`}
                >
                  <Settings className={`h-5 w-5 transition-colors duration-200 ${isActive('/admin') ? 'text-white' : 'text-gray-400 group-hover:text-white'}`} />
                  <span className="font-semibold text-[15px]">{t('sidebar.administration')}</span>
                </Link>
              </div>
            )}
          </nav>
        </div>
      </div>
    </>
  );
}