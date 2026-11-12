/**
 * Mazos de preguntas por tema: se sacan sin repetir hasta agotar el tema;
 * entonces se vuelve a barajar. Con `weight` (modo Repaso) las preguntas con
 * más peso (las que cuestan) salen primero; entre iguales, al azar.
 */
import { shuffle, type Rng } from "./rng";

export type WeightFn = (id: string) => number;

export function orderPile(ids: readonly string[], rng: Rng, weight?: WeightFn): string[] {
  const shuffled = shuffle(ids, rng);
  if (!weight) return shuffled;
  // sort es estable: el barajado se mantiene entre preguntas del mismo peso.
  return shuffled
    .map((id) => ({ id, w: weight(id) }))
    .sort((a, b) => b.w - a.w)
    .map((x) => x.id);
}

export class Deck {
  private piles: string[][];
  private avoid: string | null = null;

  constructor(
    private readonly idsByTheme: readonly (readonly string[])[],
    private readonly rng: Rng,
    private readonly weight?: WeightFn,
  ) {
    this.piles = idsByTheme.map(() => []);
  }

  /** Devuelve el id de la siguiente pregunta del tema `theme`. */
  draw(theme: number): string {
    const all = this.idsByTheme[theme];
    if (!all || !all.length) throw new Error(`El tema ${theme} no tiene preguntas`);
    if (!this.piles[theme].length) {
      let pile = orderPile(all, this.rng, this.weight);
      // Al rebarajar, que no repita justo la última pregunta que salió.
      if (pile.length > 1 && pile[0] === this.avoid) pile = [...pile.slice(1), pile[0]];
      this.piles[theme] = pile;
    }
    const id = this.piles[theme].shift()!;
    this.avoid = id;
    return id;
  }

  remaining(theme: number): number {
    return this.piles[theme].length;
  }
}
