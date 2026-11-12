import { describe, expect, it } from "vitest";
import { Deck, orderPile } from "../../src/game/deck";
import { seeded, shuffle } from "../../src/game/rng";

const ids = (t: string, n: number) => Array.from({ length: n }, (_, i) => `${t}${i}`);

describe("Deck: selección aleatoria sin repetición", () => {
  it("no repite ninguna pregunta del tema hasta agotarlas", () => {
    const deck = new Deck([ids("a", 10), ids("b", 3)], seeded(42));
    const seen = Array.from({ length: 10 }, () => deck.draw(0));
    expect(new Set(seen).size).toBe(10);
    expect(new Set(seen)).toEqual(new Set(ids("a", 10)));
  });

  it("al agotarse vuelve a barajar y no repite la última justo después", () => {
    for (let seed = 0; seed < 50; seed++) {
      const deck = new Deck([ids("a", 4)], seeded(seed));
      const first = Array.from({ length: 4 }, () => deck.draw(0));
      const nextOne = deck.draw(0);
      expect(nextOne).not.toBe(first[3]);
      const rest = [nextOne, ...Array.from({ length: 3 }, () => deck.draw(0))];
      expect(new Set(rest).size).toBe(4);
    }
  });

  it("los temas son independientes", () => {
    const deck = new Deck([ids("a", 2), ids("b", 2)], seeded(3));
    expect(deck.draw(1).startsWith("b")).toBe(true);
    expect(deck.draw(0).startsWith("a")).toBe(true);
  });

  it("falla con un tema vacío", () => {
    expect(() => new Deck([[]], seeded(1)).draw(0)).toThrow();
  });

  it("es aleatorio: distintas semillas dan distintos órdenes", () => {
    const orders = new Set(Array.from({ length: 10 }, (_, s) => shuffle(ids("a", 8), seeded(s)).join()));
    expect(orders.size).toBeGreaterThan(5);
  });
});

describe("modo Repaso", () => {
  it("las preguntas con peso salen primero, ordenadas por peso", () => {
    const w: Record<string, number> = { a3: 5, a7: 2, a1: 2 };
    const pile = orderPile(ids("a", 10), seeded(9), (id) => w[id] ?? 0);
    expect(pile[0]).toBe("a3");
    expect(new Set(pile.slice(1, 3))).toEqual(new Set(["a7", "a1"]));
    expect(pile).toHaveLength(10);
  });

  it("el Deck usa el peso al barajar", () => {
    const deck = new Deck([ids("a", 6)], seeded(5), (id) => (id === "a4" ? 3 : 0));
    expect(deck.draw(0)).toBe("a4");
  });
});
