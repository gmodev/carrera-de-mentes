/**
 * Esquema del contenido (materias, unidades, temas y preguntas).
 * Los ficheros YAML de src/data/subjects se validan con esto al compilar:
 * un error rompe `npm run build`; una traducción que falta solo avisa.
 */
import { z } from "zod";

export { LANGS, type Lang } from "./keys";

/** Etiquetas HTML permitidas dentro de los textos (p. ej. exponentes 3<sup>4</sup>). */
const ALLOWED_TAGS = /<\/?(sup|sub|b|i)>/g;
const hasOnlyAllowedHtml = (s: string) => !/[<>]/.test(s.replace(ALLOWED_TAGS, ""));
const str = z
  .string()
  .trim()
  .min(1, "no puede estar vacío")
  .refine(hasOnlyAllowedHtml, "solo se permiten las etiquetas <sup>, <sub>, <b> e <i>");

/** Texto bilingüe. Se puede escribir solo como cadena (= español). */
export interface Texto {
  es: string;
  va?: string;
}
export const Texto = z.union([
  str.transform((es): Texto => ({ es })),
  z.object({ es: str, va: str.optional() }).strict(),
]);

const id = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "usa minúsculas, números y guiones");
const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "color en formato #RRGGBB");

export const Tema = z
  .object({
    id,
    nombre: Texto,
    /** Nombre corto para la ruleta. */
    corto: Texto,
    emoji: z.string().min(1),
    color,
  })
  .strict();
export type Tema = z.output<typeof Tema>;

export const Personaje = z.object({ emoji: z.string().min(1), nombre: Texto }).strict();
export type Personaje = z.output<typeof Personaje>;

export const SubjectFile = z
  .object({
    id,
    nombre: Texto,
    emoji: z.string().min(1),
    /** Orden en el menú (menor primero). */
    orden: z.number().int().default(100),
    /** Personajes para elegir en esta materia (mínimo 4, uno por jugador). */
    personajes: z.array(Personaje).min(4),
  })
  .strict();

export const UnitFile = z
  .object({
    id,
    /** Nombre en el menú, p. ej. «Unidad 8: La prehistoria». */
    nombre: Texto,
    /** Título grande del juego, p. ej. «Carrera de la Prehistoria». */
    titulo: Texto,
    descripcion: Texto,
    orden: z.number().int().default(100),
    temas: z.array(Tema).length(6, "una unidad necesita exactamente 6 temas (uno por color)"),
  })
  .strict();

const base = {
  id,
  /** id del tema (color) al que pertenece. */
  tema: id,
  pregunta: Texto,
  explicacion: Texto,
  /** De dónde sale el dato: «Libro, p. 12», «Hoja de repaso»… */
  fuente: z.string().trim().min(1),
  /** false = pendiente de comprobar con el libro (se muestra con asterisco). */
  verificada: z.boolean(),
};

export const PreguntaMultiple = z
  .object({
    ...base,
    tipo: z.literal("multiple"),
    correcta: Texto,
    incorrectas: z.array(Texto).length(3, "una pregunta multiple lleva 3 respuestas incorrectas"),
  })
  .strict();

export const PreguntaVF = z
  .object({ ...base, tipo: z.literal("verdadero_falso"), respuesta: z.boolean() })
  .strict();

export const PreguntaNumerica = z
  .object({
    ...base,
    tipo: z.literal("numerica"),
    respuesta: z.number().finite(),
    /** Margen aceptado (por defecto 0: exacta). */
    tolerancia: z.number().nonnegative().default(0),
    unidad: Texto.optional(),
  })
  .strict();

export const PreguntaOrdenar = z
  .object({
    ...base,
    tipo: z.literal("ordenar"),
    /** Elementos en el orden correcto; el juego los baraja. */
    elementos: z.array(Texto).min(3).max(6),
  })
  .strict();

export const Pregunta = z.discriminatedUnion("tipo", [
  PreguntaMultiple,
  PreguntaVF,
  PreguntaNumerica,
  PreguntaOrdenar,
]);
export type Pregunta = z.output<typeof Pregunta>;
export type TipoPregunta = Pregunta["tipo"];

export const QuestionsFile = z.array(Pregunta).min(1);

/* ---------- Contenido ya validado y montado ---------- */
export type Unit = z.output<typeof UnitFile> & { subjectId: string; preguntas: Pregunta[] };
export type Subject = z.output<typeof SubjectFile> & {
  units: Unit[];
  /** Dibujo de fondo opcional (subjects/<materia>/fondo.svg), ya validado. */
  fondo?: string;
};
export interface Content {
  subjects: Subject[];
}

export { unitKey } from "./keys";
