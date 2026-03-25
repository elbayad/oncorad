import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  Menu,
  Sun,
  Moon,
  LogOut,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Sidebar from './Sidebar';
import LanguageSwitcher from './LanguageSwitcher';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const { t } = useTranslation();

  const getPageTitle = () => {
    const path = location.pathname;
    const titles: { [key: string]: string } = {
      '/': t('pageTitles.dashboard'),
      '/modules': t('pageTitles.modules'),
      '/admin': t('pageTitles.admin'),
      '/ambulances': t('pageTitles.ambulances'),
      '/rtls': t('pageTitles.rtls'),
      '/bloc-view': t('pageTitles.blocView'),
      '/energy': t('pageTitles.energy'),
      '/air': t('pageTitles.air'),
      '/oxygen': t('pageTitles.oxygen'),
      '/reporting': t('pageTitles.reporting'),
      '/admission': t('pageTitles.admission'),
      '/dossier-patient': t('pageTitles.patientRecord'),
    };
    return titles[path] || t('pageTitles.default');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* Mobile header */}
      <div className="lg:hidden bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between p-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
          >
            <Menu className="h-6 w-6" />
          </button>

          <img src="/logo.png" alt="Oncorad Group" className="h-8 w-auto" />

          <div className="flex items-center space-x-2">
            <LanguageSwitcher />

            <button
              onClick={toggleTheme}
              className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <button
              onClick={logout}
              className="p-2 rounded-md text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main content */}
        <div className="flex-1">
          {/* Desktop header */}
          <div className="hidden lg:block bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {getPageTitle()}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {t('common.floorLabel')} {user?.floor || t('common.allFloors')}
                </p>
              </div>

              <div className="flex items-center space-x-4">
                <LanguageSwitcher />

                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-md text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                >
                  {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>


                <button
                  onClick={logout}
                  className="flex items-center space-x-2 px-3 py-2 rounded-md text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{t('common.logout')}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Page content */}
          <main className="p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}