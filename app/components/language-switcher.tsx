import { useTranslation } from "react-i18next";
import { Form } from "react-router";
import { SUPPORTED_LOCALES, type Locale } from "~/i18n/locale";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const current = i18n.resolvedLanguage as Locale | undefined;

  return (
    <Form
      method="post"
      action="/locale"
      className="flex items-center gap-1 border border-cyan-500/30 bg-[#05070A]/60 px-1 py-0.5"
      aria-label={t("languageSwitcher.label")}
    >
      {SUPPORTED_LOCALES.map((locale) => {
        const active = current === locale;
        return (
          <button
            key={locale}
            type="submit"
            name="locale"
            value={locale}
            aria-pressed={active}
            className={`px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest transition-colors ${
              active
                ? "bg-cyan-500/20 text-cyan-300"
                : "text-cyan-500/60 hover:text-cyan-300"
            }`}
          >
            {locale === "ja" ? "JA" : "EN"}
          </button>
        );
      })}
    </Form>
  );
}
