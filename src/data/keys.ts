/** Constantes sin dependencias (se pueden importar desde el navegador sin arrastrar Zod). */
export const LANGS = ["es", "va"] as const;
export type Lang = (typeof LANGS)[number];

/** Clave única de una unidad: "historia/u08-prehistoria". */
export const unitKey = (u: { subjectId: string; id: string }) => `${u.subjectId}/${u.id}`;
