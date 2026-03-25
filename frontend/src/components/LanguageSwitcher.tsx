import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

const languages = [
    { code: 'fr', label: 'FR', fullLabel: 'Français' },
    { code: 'en', label: 'EN', fullLabel: 'English' },
    { code: 'ar', label: 'AR', fullLabel: 'العربية' },
];

export default function LanguageSwitcher() {
    const { i18n } = useTranslation();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleChange = (code: string) => {
        i18n.changeLanguage(code);
        setOpen(false);
    };

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                aria-label="Change language"
                id="language-switcher"
            >
                <Globe className="h-4 w-4" />
                <span>{currentLang.label}</span>
            </button>

            {open && (
                <div className="absolute top-full mt-1 end-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 min-w-[140px] py-1">
                    {languages.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => handleChange(lang.code)}
                            className={`w-full text-start px-3 py-2 text-sm transition-colors duration-150 flex items-center justify-between ${i18n.language === lang.code
                                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium'
                                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                }`}
                        >
                            <span>{lang.fullLabel}</span>
                            <span className="text-xs text-gray-400 dark:text-gray-500">{lang.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
