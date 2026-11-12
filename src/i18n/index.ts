/** Textos de interfaz (es/va) y textos bilingües del contenido. */
import es from "./es.json";
import va from "./va.json";
import type { Lang, Texto } from "../data/schema";

export type { Lang };
type Dict = Record<string, string | string[]>;
export const DICTS: Record<Lang, Dict> = { es, va };

const LANG_KEY = "cdm-lang";

export function loadLang(): Lang {
  try {
    const v = localStorage.getItem(LANG_KEY);
    if (v === "es" || v === "va") return v;
  } catch {
    /* sin almacenamiento */
  }
  return "es";
}

export function saveLang(l: Lang) {
  try {
    localStorage.setItem(LANG_KEY, l);
  } catch {
    /* sin almacenamiento */
  }
}

export interface I18n {
  lang: Lang;
  /** Texto de interfaz con variables {nombre}. Si falta en va, usa es. */
  t(key: string, vars?: Record<string, string | number>): string;
  /** Lista de interfaz (p. ej. mensajes de ánimo). */
  list(key: string): string[];
  /** Texto del contenido en el idioma actual (o es si falta). */
  tx(x: Texto | undefined): string;
}

export function makeI18n(lang: Lang): I18n {
  const get = (k: string) => DICTS[lang][k] ?? DICTS.es[k];
  return {
    lang,
    t(key, vars) {
      const v = get(key);
      let s = typeof v === "string" ? v : key;
      if (vars) for (const [k, val] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(val));
      return s;
    },
    list(key) {
      const v = get(key);
      return Array.isArray(v) ? v : [];
    },
    tx(x) {
      if (!x) return "";
      return (lang === "va" && x.va) || x.es;
    },
  };
}
