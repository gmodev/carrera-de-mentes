/**
 * Reglas de la partida: jugadores, turnos, quesitos, racha y 50/50.
 * Sin DOM. La interfaz llama a estas funciones y luego pinta el estado.
 */
import { shuffle, type Rng } from "./rng";
import { THEMES } from "./wheel";

export interface PlayerSetup {
  name: string;
  avatar: string;
}

export interface Player extends PlayerSetup {
  has: boolean[];
  ok: number;
  tot: number;
  streak: number;
  best: number;
  fiftyUsed: boolean;
}

export interface Missed {
  qid: string;
  who: string;
}

export interface GameState {
  players: Player[];
  cur: number;
  missed: Missed[];
  winner: number | null;
}

export interface AnswerOutcome {
  correct: boolean;
  /** Ha ganado un quesito nuevo con esta respuesta. */
  gained: boolean;
  /** Tiene ya los 6 colores. */
  won: boolean;
  /** Quién juega después (el mismo si acierta o si juega solo). */
  nextPlayer: number;
}

export function createGame(setup: readonly PlayerSetup[]): GameState {
  if (setup.length < 1 || setup.length > 4) throw new Error("De 1 a 4 jugadores");
  return {
    players: setup.map((p) => ({
      ...p,
      has: Array(THEMES).fill(false),
      ok: 0,
      tot: 0,
      streak: 0,
      best: 0,
      fiftyUsed: false,
    })),
    cur: 0,
    missed: [],
    winner: null,
  };
}

export const current = (s: GameState) => s.players[s.cur];

export function missingThemes(p: Player): number[] {
  return p.has.map((h, i) => (h ? -1 : i)).filter((i) => i >= 0);
}

export const wedgeCount = (p: Player) => p.has.filter(Boolean).length;

/** Registra la respuesta del jugador actual (sin cambiar aún de turno). */
export function recordAnswer(s: GameState, theme: number, correct: boolean, qid: string): AnswerOutcome {
  const p = current(s);
  p.tot++;
  let gained = false;
  if (correct) {
    p.ok++;
    p.streak++;
    p.best = Math.max(p.best, p.streak);
    if (!p.has[theme]) {
      p.has[theme] = true;
      gained = true;
    }
  } else {
    p.streak = 0;
    s.missed.push({ qid, who: p.name });
  }
  const won = p.has.every(Boolean);
  if (won) s.winner = s.cur;
  const nextPlayer = correct ? s.cur : (s.cur + 1) % s.players.length;
  return { correct, gained, won, nextPlayer };
}

/** Pasa al siguiente turno según el resultado. */
export function advance(s: GameState, outcome: AnswerOutcome): void {
  s.cur = outcome.nextPlayer;
}

/** Gasta el 50/50 del jugador actual. Devuelve false si ya lo había usado. */
export function useFifty(s: GameState): boolean {
  const p = current(s);
  if (p.fiftyUsed) return false;
  p.fiftyUsed = true;
  return true;
}

/** Índices de dos opciones incorrectas que quita el 50/50. */
export function fiftyRemove(isCorrect: readonly boolean[], rng: Rng): number[] {
  const wrong = isCorrect.map((ok, i) => (ok ? -1 : i)).filter((i) => i >= 0);
  return shuffle(wrong, rng).slice(0, Math.min(2, Math.max(0, wrong.length - 1)));
}

/** Preguntas falladas sin repetir (para «Para repasar»). */
export function uniqueMissed(s: GameState): Missed[] {
  const seen = new Set<string>();
  return s.missed.filter((m) => !seen.has(m.qid) && (seen.add(m.qid), true));
}

/* ---------- Clasificación final ---------- */

/** Estrellas según el porcentaje de aciertos: ≥90 % → 3, ≥70 % → 2, ≥50 % → 1. */
export function stars(ok: number, tot: number): 0 | 1 | 2 | 3 {
  if (!tot) return 0;
  const p = ok / tot;
  return p >= 0.9 ? 3 : p >= 0.7 ? 2 : p >= 0.5 ? 1 : 0;
}

export interface Standing {
  /** Índice del jugador en la partida. */
  index: number;
  player: Player;
  /** 1 = primero. Los empates comparten puesto (1, 2, 2, 4). */
  place: number;
  accuracy: number;
  stars: 0 | 1 | 2 | 3;
}

/**
 * Orden: el ganador; luego más quesitos; luego más aciertos; luego mejor
 * porcentaje. Si todo coincide, empate (mismo puesto).
 */
export function ranking(s: GameState): Standing[] {
  const key = (i: number) => {
    const p = s.players[i];
    return [s.winner === i ? 1 : 0, wedgeCount(p), p.ok, p.tot ? p.ok / p.tot : 0];
  };
  const cmp = (a: number, b: number) => {
    const ka = key(a), kb = key(b);
    for (let k = 0; k < ka.length; k++) if (ka[k] !== kb[k]) return kb[k] - ka[k];
    return 0;
  };
  const order = s.players.map((_, i) => i).sort((a, b) => cmp(a, b) || a - b);
  const out: Standing[] = [];
  order.forEach((i, pos) => {
    const p = s.players[i];
    const prev = out[pos - 1];
    const place = prev && cmp(prev.index, i) === 0 ? prev.place : pos + 1;
    out.push({ index: i, player: p, place, accuracy: p.tot ? p.ok / p.tot : 0, stars: stars(p.ok, p.tot) });
  });
  return out;
}
