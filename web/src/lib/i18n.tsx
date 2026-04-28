"use client";
import { createContext, useContext, ReactNode } from "react";
import ru from "@/i18n/messages/ru.json";

type Messages = typeof ru;

const I18nContext = createContext<{ locale: string; messages: Messages }>({
  locale: "ru",
  messages: ru,
});

export function I18nProvider({ locale, children }: { locale: string; children: ReactNode }) {
  return (
    <I18nContext.Provider value={{ locale: "ru", messages: ru }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslations(namespace?: string) {
  const { messages } = useContext(I18nContext);
  return (key: string) => {
    const ns = namespace ? (messages as any)[namespace] : messages;
    if (!ns) return key;
    return (ns as any)[key] || key;
  };
}

export function useLocale() {
  return useContext(I18nContext).locale;
}
