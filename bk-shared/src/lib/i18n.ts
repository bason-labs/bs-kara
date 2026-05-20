import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import vi from '../locales/vi.json';
import en from '../locales/en.json';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      vi: { translation: vi },
      en: { translation: en },
    },
    lng: 'vi',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

// Always re-merge the resource bundles. The init guard above only runs once
// per i18next singleton lifetime, but Turbopack/Next can re-evaluate this
// module after a JSON edit while the singleton (and its old resources) is
// preserved — that produces a server/client hydration mismatch where the
// server returns the raw key and the client returns the new translation.
// The deepMerge=true flag makes addResourceBundle update existing keys.
i18n.addResourceBundle('vi', 'translation', vi, true, true);
i18n.addResourceBundle('en', 'translation', en, true, true);

export default i18n;
