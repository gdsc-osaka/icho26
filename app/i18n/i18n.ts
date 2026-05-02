import { createInstance, type i18n } from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en/common.json";
import ja from "./locales/ja/common.json";
import { DEFAULT_LOCALE, type Locale } from "./locale";

const resources = {
  ja: { common: ja },
  en: { common: en },
} as const;

export function createI18n(locale: Locale): i18n {
  const instance = createInstance();
  instance.use(initReactI18next).init({
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,
    defaultNS: "common",
    ns: ["common"],
    resources,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    returnNull: false,
  });
  return instance;
}
