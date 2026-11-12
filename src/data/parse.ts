/**
 * Convierte los YAML de src/data/subjects en contenido validado.
 * Función pura (recibe { ruta: texto }) para poder probarla sin ficheros.
 *
 * Estructura esperada:
 *   subjects/<materia>/subject.yaml
 *   subjects/<materia>/<unidad>/unit.yaml
 *   subjects/<materia>/<unidad>/questions.yaml
 */
import { parse as parseYaml } from "yaml";
import type { ZodType } from "zod";
import {
  QuestionsFile,
  SubjectFile,
  UnitFile,
  type Content,
  type Pregunta,
  type Subject,
  type Texto,
  type Unit,
} from "./schema";

export interface ParseResult {
  content: Content;
  errors: string[];
  warnings: string[];
}

function check<T>(schema: ZodType<T>, raw: string, file: string, errors: string[]): T | null {
  let data: unknown;
  try {
    data = parseYaml(raw);
  } catch (e) {
    errors.push(`${file}: YAML mal formado: ${(e as Error).message}`);
    return null;
  }
  const r = schema.safeParse(data);
  if (!r.success) {
    for (const { path, message } of explain(r.error.issues)) {
      errors.push(`${file} → ${path.join(".") || "(raíz)"}: ${message}`);
    }
    return null;
  }
  return r.data;
}

type Issue = { code: string; path: PropertyKey[]; message: string; errors?: Issue[][] };

/**
 * Mensajes legibles: en las uniones (p. ej. Texto = cadena u objeto {es, va})
 * Zod solo dice «Invalid input»; aquí se elige la rama que mejor explica el fallo
 * (la que no falla por tipo en su raíz).
 */
function explain(issues: readonly unknown[], prefix: PropertyKey[] = []): { path: PropertyKey[]; message: string }[] {
  const out: { path: PropertyKey[]; message: string }[] = [];
  for (const raw of issues as Issue[]) {
    const path = [...prefix, ...raw.path];
    if (raw.code === "invalid_union" && raw.errors?.length) {
      const branch =
        raw.errors.find((b) => b.length && !b.some((i) => i.code === "invalid_type" && i.path.length === 0)) ?? raw.errors[0];
      out.push(...explain(branch, path));
    } else out.push({ path, message: raw.message });
  }
  return out;
}

/** Recorre un objeto y avisa de cada Texto sin traducción al valenciano. */
function warnMissingVa(value: unknown, where: string, warnings: string[]) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => warnMissingVa(v, `${where}[${i}]`, warnings));
  } else if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    if (typeof o.es === "string" && Object.keys(o).every((k) => k === "es" || k === "va")) {
      if (!o.va) warnings.push(`${where}: falta la traducción al valenciano («${o.es}»)`);
      return;
    }
    for (const [k, v] of Object.entries(o)) warnMissingVa(v, `${where}.${k}`, warnings);
  }
}

export const MAX_SVG_BYTES = 40_000;

/**
 * Fondo de una materia: un SVG decorativo. Solo dibujo: sin scripts,
 * eventos ni enlaces externos (los <use href="#id"> internos sí valen).
 * Devuelve el SVG compactado o null si no es válido.
 */
export function checkSvg(raw: string, file: string, errors: string[]): string | null {
  const svg = raw.replace(/<!--[\s\S]*?-->/g, "").replace(/\s+/g, " ").trim();
  const bad = (m: string) => (errors.push(`${file}: ${m}`), null);
  if (!/^(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(svg)) return bad("debe empezar por <svg");
  if (!/<\/svg>$/i.test(svg)) return bad("debe terminar en </svg>");
  if (!/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(svg)) return bad('falta xmlns="http://www.w3.org/2000/svg"');
  if (/<script|<foreignObject|\son[a-z]+\s*=/i.test(svg)) return bad("no puede llevar scripts ni eventos");
  if (/(?:xlink:)?href\s*=\s*["'](?!#)/i.test(svg) || /url\(\s*["']?(?!#)/i.test(svg)) return bad("no puede enlazar archivos externos (solo #ids internos)");
  if (new TextEncoder().encode(svg).length > MAX_SVG_BYTES) return bad(`ocupa más de ${MAX_SVG_BYTES / 1000} KB`);
  return svg;
}

export function parseContent(files: Record<string, string>): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byRel = new Map<string, { file: string; raw: string }>();
  for (const [file, raw] of Object.entries(files)) {
    const m = file.replace(/\\/g, "/").match(/subjects\/(.+)$/);
    if (m) byRel.set(m[1], { file: `subjects/${m[1]}`, raw });
  }

  const subjects: Subject[] = [];
  const seenQ = new Map<string, string>();

  for (const [rel, { file, raw }] of byRel) {
    const sm = rel.match(/^([^/]+)\/subject\.yaml$/);
    if (!sm) continue;
    const folder = sm[1];
    const s = check(SubjectFile, raw, file, errors);
    if (!s) continue;
    if (s.id !== folder) errors.push(`${file}: el id «${s.id}» debe coincidir con la carpeta «${folder}»`);
    warnMissingVa(s, `${file}`, warnings);

    const units: Unit[] = [];
    for (const [urel, uf] of byRel) {
      const um = urel.match(new RegExp(`^${folder}/([^/]+)/unit\\.yaml$`));
      if (!um) continue;
      const ufolder = um[1];
      const u = check(UnitFile, uf.raw, uf.file, errors);
      if (!u) continue;
      if (u.id !== ufolder) errors.push(`${uf.file}: el id «${u.id}» debe coincidir con la carpeta «${ufolder}»`);
      warnMissingVa(u, uf.file, warnings);

      const temaIds = u.temas.map((t) => t.id);
      if (new Set(temaIds).size !== temaIds.length) errors.push(`${uf.file}: hay ids de tema repetidos`);

      const qf = byRel.get(`${folder}/${ufolder}/questions.yaml`);
      let preguntas: Pregunta[] = [];
      if (!qf) {
        errors.push(`${uf.file}: falta ${folder}/${ufolder}/questions.yaml`);
      } else {
        preguntas = check(QuestionsFile, qf.raw, qf.file, errors) ?? [];
        for (const q of preguntas) {
          const where = `${qf.file} → ${q.id}`;
          const prev = seenQ.get(q.id);
          if (prev) errors.push(`${where}: id repetido (ya está en ${prev})`);
          seenQ.set(q.id, qf.file);
          if (!temaIds.includes(q.tema)) errors.push(`${where}: el tema «${q.tema}» no existe en unit.yaml (${temaIds.join(", ")})`);
          if (q.tipo === "multiple") {
            const all = [q.correcta, ...q.incorrectas].map((t) => t.es.toLowerCase());
            if (new Set(all).size !== all.length) errors.push(`${where}: hay respuestas repetidas`);
          }
          warnMissingVa(q, where, warnings);
        }
        for (const t of temaIds) {
          if (preguntas.length && !preguntas.some((q) => q.tema === t)) {
            errors.push(`${qf.file}: el tema «${t}» no tiene ninguna pregunta`);
          }
        }
      }
      units.push({ ...u, subjectId: s.id, preguntas });
    }
    if (!units.length) errors.push(`${file}: la materia no tiene ninguna unidad`);
    units.sort((a, b) => a.orden - b.orden || a.id.localeCompare(b.id));
    const bg = byRel.get(`${folder}/fondo.svg`);
    const fondo = bg ? checkSvg(bg.raw, bg.file, errors) ?? undefined : undefined;
    subjects.push({ ...s, units, ...(fondo ? { fondo } : {}) });
  }

  if (!subjects.length) errors.push("No se ha encontrado ninguna materia (subjects/<materia>/subject.yaml)");
  subjects.sort((a, b) => a.orden - b.orden || a.id.localeCompare(b.id));
  return { content: { subjects }, errors, warnings };
}
