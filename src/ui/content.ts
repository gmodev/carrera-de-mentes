/** Ayudas para mostrar contenido (respuestas, temas) en el idioma actual. */
import type { Pregunta, Unit } from "../data/schema";
import { unitKey } from "../data/keys";
import type { I18n } from "../i18n";
import type { ProgressStore } from "../progress/store";
import { summarizeTheme } from "../progress/store";
import { rich } from "./util";

export function formatNumber(n: number, lang: string): string {
  return new Intl.NumberFormat(lang === "va" ? "ca-ES" : "es-ES", { maximumFractionDigits: 6 }).format(n);
}

/** Respuesta correcta como HTML seguro. */
export function answerHtml(q: Pregunta, i18n: I18n): string {
  switch (q.tipo) {
    case "multiple":
      return rich(i18n.tx(q.correcta));
    case "verdadero_falso":
      return i18n.t(q.respuesta ? "answer.true" : "answer.false");
    case "numerica":
      return formatNumber(q.respuesta, i18n.lang) + (q.unidad ? " " + rich(i18n.tx(q.unidad)) : "");
    case "ordenar":
      return q.elementos.map((e) => rich(i18n.tx(e))).join(" → ");
  }
}

export const idsByTheme = (u: Unit) => u.temas.map((t) => u.preguntas.filter((q) => q.tema === t.id).map((q) => q.id));

export function unitSummary(u: Unit, store: ProgressStore) {
  const key = unitKey(u);
  const per = idsByTheme(u).map((ids) => summarizeTheme(store, key, ids));
  const total = per.reduce((a, s) => a + s.total, 0);
  const mastered = per.reduce((a, s) => a + s.mastered, 0);
  const struggling = per.reduce((a, s) => a + s.struggling, 0);
  const seen = per.reduce((a, s) => a + s.seen, 0);
  return { per, total, mastered, struggling, seen, level: total ? mastered / total : 0 };
}

export function levelKey(level: number): string {
  if (level >= 0.8) return "progress.level3";
  if (level >= 0.5) return "progress.level2";
  if (level >= 0.25) return "progress.level1";
  return "progress.level0";
}
