import ru from "@/i18n/messages/ru.json";

type Messages = typeof ru;

export function getTranslations(_locale: string, namespace: string) {
  const ns = (ru as Record<string, Record<string, string>>)[namespace];
  return (key: string): string => {
    return ns?.[key] || key;
  };
}
