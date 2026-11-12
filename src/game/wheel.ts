/**
 * Ruleta: 6 colores + comodín (índice 6). Los segmentos van en sentido horario
 * desde arriba; el puntero está arriba. Girar la rueda `rot` grados en sentido
 * horario deja bajo el puntero el ángulo (−rot) de la rueda.
 */
import { pick, type Rng } from "./rng";

export const THEMES = 6;
export const WILD = 6;
export const SEGMENTS = 7;
export const SEG_DEG = 360 / SEGMENTS;

/** Solo puede caer en colores que faltan, o en el comodín. */
export function chooseSegment(missing: readonly number[], rng: Rng): number {
  return pick([...missing, WILD], rng);
}

/** Nueva rotación (siempre hacia delante, 5 vueltas + lo necesario). */
export function targetRotation(current: number, segment: number, rng: Rng, turns = 5): number {
  const center = (segment + 0.5) * SEG_DEG;
  const jitter = (rng() - 0.5) * SEG_DEG * 0.6;
  const base = (((-center - current) % 360) + 360) % 360;
  return current + 360 * turns + base + jitter;
}

/** Segmento que queda bajo el puntero con una rotación dada. */
export function segmentAt(rotation: number): number {
  const a = (((-rotation) % 360) + 360) % 360;
  return Math.floor(a / SEG_DEG) % SEGMENTS;
}
