import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Sun, Moon, Loader2 } from 'lucide-react';
import LanguageSwitcher from '../components/LanguageSwitcher';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { user, login, isLoading } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { t } = useTranslation();

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const success = await login(email, password);
    if (!success) {
      setError(t('login.errorInvalid'));
    }
  };



  return (
    <div className="min-h-screen bg-[#F7F9FA] dark:bg-gray-900 flex items-center justify-center p-4 transition-colors duration-200">
      <div className="absolute top-4 end-4 flex items-center space-x-2">
        <LanguageSwitcher />
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg bg-white/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 shadow-lg transition-all duration-200"
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>

      <div className="w-full max-w-md">
        {/* Logo and title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-[400px] h-[117px] mb-6">
            <img
              src="/logo.png"
              alt="ONCORAD GROUP"
              className="w-full h-full object-contain drop-shadow-lg"
            />
          </div>

          <p className="text-lg font-semibold text-gray-700 dark:text-gray-300 tracking-wide">
            {t('login.subtitle')}
          </p>
        </div>

        {/* Login form */}
        <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-md rounded-2xl shadow-2xl p-8 border border-gray-100 dark:border-gray-800">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('login.emailLabel')}
              </label>
              <input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-[#BED00A] focus:border-[#BED00A] bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all duration-200"
                placeholder={t('login.emailPlaceholder')}
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('login.passwordLabel')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-[#BED00A] focus:border-[#BED00A] bg-white dark:bg-gray-800 text-gray-900 dark:text-white transition-all duration-200"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 end-0 pe-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#0E8FCF] hover:bg-[#0C7BB4] text-white py-3.5 px-4 rounded-xl font-semibold focus:ring-2 focus:ring-[#BED00A] focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 shadow-lg"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{isLoading ? t('login.submitLoading') : t('login.submit')}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}