import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import fr from './locales/fr.json';
import en from './locales/en.json';
import ar from './locales/ar.json';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            fr: { translation: fr },
            en: { translation: en },
            ar: { translation: ar },
        },
        fallbackLng: 'fr',
        supportedLngs: ['fr', 'en', 'ar'],
        interpolation: {
            escapeValue: false, // React already handles XSS
        },
        detection: {
            order: ['localStorage', 'navigator'],
            lookupLocalStorage: 'i18nextLng',
            caches: ['localStorage'],
        },
    });

// Apply dir attribute on init and language change
const applyDirection = (lng: string) => {
    const dir = lng === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = lng;
};

applyDirection(i18n.language || 'fr');
i18n.on('languageChanged', applyDirection);

export default i18n;
