/**
 * Progreso guardado en localStorage: por unidad y pregunta, cuántas veces se
 * acertó y se falló. Todo con try/catch: si el navegador no deja guardar
 * (modo privado, almacenamiento bloqueado) el juego sigue funcionando.
 */
export interface QStat {
  ok: number;
  ko: number;
  /** Resultado de la última vez. */
  last: "ok" | "ko";
  /** Marca de tiempo de la última vez (ms). */
  t: number;
}

export interface ProgressData {
  v: 1;
  /** clave de unidad ("historia/u08-prehistoria") → id de pregunta → estadística */
  units: Record<string, Record<string, QStat>>;
}

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

export const STORAGE_KEY = "cdm-progress-v1";

const empty = (): ProgressData => ({ v: 1, units: {} });

function safeStorage(): KV | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

export class ProgressStore {
  private data: ProgressData;

  constructor(private readonly kv: KV | null = safeStorage()) {
    this.data = this.read();
  }

  private read(): ProgressData {
    try {
      const raw = this.kv?.getItem(STORAGE_KEY);
      if (!raw) return empty();
      const d = JSON.parse(raw);
      if (d && d.v === 1 && d.units && typeof d.units === "object") return d;
    } catch {
      /* datos corruptos o almacenamiento bloqueado: empezar de cero */
    }
    return empty();
  }

  private write() {
    try {
      this.kv?.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      /* sin espacio o bloqueado: se mantiene en memoria */
    }
  }

  record(unit: string, qid: string, correct: boolean, now = Date.now()): void {
    const u = (this.data.units[unit] ??= {});
    const s = (u[qid] ??= { ok: 0, ko: 0, last: "ok", t: 0 });
    if (correct) s.ok++;
    else s.ko++;
    s.last = correct ? "ok" : "ko";
    s.t = now;
    this.write();
  }

  stat(unit: string, qid: string): QStat | undefined {
    return this.data.units[unit]?.[qid];
  }

  /** Peso para el modo Repaso: >0 = «me cuesta»; cuanto más, antes sale. */
  weight(unit: string, qid: string): number {
    return weightOf(this.stat(unit, qid));
  }

  clear(unit?: string): void {
    if (unit) delete this.data.units[unit];
    else this.data = empty();
    this.write();
  }

  snapshot(): ProgressData {
    return JSON.parse(JSON.stringify(this.data));
  }
}

export function weightOf(s: QStat | undefined): number {
  if (!s || s.ko === 0) return 0;
  return (s.last === "ko" ? 2 : 0) + Math.max(0, s.ko - s.ok);
}

/** Dominada: la última vez se acertó y se ha acertado al menos tanto como fallado. */
export function isMastered(s: QStat | undefined): boolean {
  return !!s && s.last === "ok" && s.ok >= s.ko;
}

export interface ThemeSummary {
  total: number;
  seen: number;
  mastered: number;
  struggling: number;
  /** 0..1 */
  level: number;
}

export function summarizeTheme(store: ProgressStore, unit: string, qids: readonly string[]): ThemeSummary {
  let seen = 0, mastered = 0, struggling = 0;
  for (const id of qids) {
    const s = store.stat(unit, id);
    if (s) seen++;
    if (isMastered(s)) mastered++;
    if (weightOf(s) > 0) struggling++;
  }
  return { total: qids.length, seen, mastered, struggling, level: qids.length ? mastered / qids.length : 0 };
}
