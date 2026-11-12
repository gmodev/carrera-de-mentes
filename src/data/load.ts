/**
 * Carga todos los YAML de src/data/subjects (sin registro manual: basta con
 * crear la carpeta). Se ejecuta al compilar; si hay errores, el build falla.
 * No lo importes desde el código del navegador.
 */
import { parseContent } from "./parse";
import type { Content } from "./schema";

const files = import.meta.glob(["./subjects/**/*.yaml", "./subjects/*/fondo.svg"], {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

let cached: Content | null = null;

export function loadContent({ quiet = false } = {}): Content {
  if (cached) return cached;
  const { content, errors, warnings } = parseContent(files);
  if (!quiet) for (const w of warnings) console.warn(`[contenido] aviso: ${w}`);
  if (errors.length) {
    throw new Error(`Contenido inválido (${errors.length} errores):\n  - ${errors.join("\n  - ")}`);
  }
  cached = content;
  return content;
}

export const rawContentFiles = files;
