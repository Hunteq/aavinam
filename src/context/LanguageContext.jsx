import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../db/db';
import { translations, languages } from '../translations';

const LanguageContext = createContext();

export const useLanguage = () => useContext(LanguageContext);

export const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState(localStorage.getItem('appLanguage') || 'en');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadLanguage = async () => {
            try {
                // 1. Try localStorage first (already set in initial state)

                // 2. Try Database
                const settings = await db.settings.get('global');
                if (settings && settings.language) {
                    if (settings.language !== language) {
                        setLanguage(settings.language);
                        localStorage.setItem('appLanguage', settings.language);
                    }
                }
            } catch (error) {
                console.error("Error loading language:", error);
            } finally {
                setLoading(false);
            }
        };
        loadLanguage();
    }, []);

    const changeLanguage = async (newLang) => {
        if (!translations[newLang]) {
            console.warn(`Language ${newLang} not found, falling back to english`);
            return;
        }

        setLanguage(newLang);
        localStorage.setItem('appLanguage', newLang);

        try {
            const settings = await db.settings.get('global');
            await db.settings.put({
                ...(settings || { id: 'global' }),
                language: newLang,
                updatedAt: new Date()
            });
        } catch (error) {
            console.error("Error saving language preference:", error);
        }
    };

    // Translation function: t('common.save') -> "Save"
    const t = (path) => {
        const keys = path.split('.');
        let current = translations[language];
        let fallback = translations['en'];

        for (const key of keys) {
            if (current && current[key] !== undefined) {
                current = current[key];
            } else {
                current = undefined;
            }

            if (fallback && fallback[key] !== undefined) {
                fallback = fallback[key];
            } else {
                fallback = undefined;
            }
        }

        return current || fallback || path;
    };

    return (
        <LanguageContext.Provider value={{ language, changeLanguage, t, languages }}>
            {children}
        </LanguageContext.Provider>
    );
};
