import { describe, expect, it } from "vitest";
import {
  advance, createGame, current, fiftyRemove, missingThemes, recordAnswer, uniqueMissed, useFifty, wedgeCount,
} from "../../src/game/rules";
import { seeded } from "../../src/game/rng";

const two = () => createGame([{ name: "Ana", avatar: "🦬" }, { name: "Leo", avatar: "🦣" }]);

describe("turnos y quesitos", () => {
  it("acertar da el quesito y mantiene el turno", () => {
    const g = two();
    const out = recordAnswer(g, 2, true, "q1");
    expect(out).toMatchObject({ correct: true, gained: true, won: false, nextPlayer: 0 });
    advance(g, out);
    expect(g.cur).toBe(0);
    expect(g.players[0].has[2]).toBe(true);
    expect(wedgeCount(g.players[0])).toBe(1);
  });

  it("fallar pasa el turno al siguiente y vuelve al primero al final", () => {
    const g = two();
    advance(g, recordAnswer(g, 0, false, "q1"));
    expect(g.cur).toBe(1);
    advance(g, recordAnswer(g, 0, false, "q2"));
    expect(g.cur).toBe(0);
  });

  it("jugando solo, fallar no cambia de jugador", () => {
    const g = createGame([{ name: "Ana", avatar: "🦬" }]);
    advance(g, recordAnswer(g, 0, false, "q1"));
    expect(g.cur).toBe(0);
  });

  it("un quesito que ya tienes no se gana dos veces", () => {
    const g = two();
    recordAnswer(g, 1, true, "a");
    const out = recordAnswer(g, 1, true, "b");
    expect(out.gained).toBe(false);
    expect(wedgeCount(current(g))).toBe(1);
  });

  it("gana al reunir los 6 colores", () => {
    const g = two();
    for (let t = 0; t < 5; t++) expect(recordAnswer(g, t, true, `q${t}`).won).toBe(false);
    const out = recordAnswer(g, 5, true, "q5");
    expect(out.won).toBe(true);
    expect(g.winner).toBe(0);
  });

  it("missingThemes solo devuelve los colores que faltan", () => {
    const g = two();
    recordAnswer(g, 0, true, "a");
    recordAnswer(g, 3, true, "b");
    expect(missingThemes(current(g))).toEqual([1, 2, 4, 5]);
  });

  it("cuenta aciertos, total, racha y mejor racha", () => {
    const g = two();
    recordAnswer(g, 0, true, "a");
    recordAnswer(g, 1, true, "b");
    recordAnswer(g, 2, true, "c");
    const p = current(g);
    expect([p.ok, p.tot, p.streak, p.best]).toEqual([3, 3, 3, 3]);
    recordAnswer(g, 3, false, "d");
    expect([p.ok, p.tot, p.streak, p.best]).toEqual([3, 4, 0, 3]);
  });

  it("guarda las falladas sin repetir para «Para repasar»", () => {
    const g = createGame([{ name: "Ana", avatar: "🦬" }]);
    recordAnswer(g, 0, false, "x");
    recordAnswer(g, 0, false, "x");
    recordAnswer(g, 1, false, "y");
    expect(uniqueMissed(g).map((m) => m.qid)).toEqual(["x", "y"]);
  });

  it("de 1 a 4 jugadores", () => {
    expect(() => createGame([])).toThrow();
    expect(() => createGame(Array(5).fill({ name: "x", avatar: "y" }))).toThrow();
  });
});

describe("50/50", () => {
  it("solo una vez por jugador y partida", () => {
    const g = two();
    expect(useFifty(g)).toBe(true);
    expect(useFifty(g)).toBe(false);
    g.cur = 1;
    expect(useFifty(g)).toBe(true);
  });

  it("quita exactamente dos incorrectas y nunca la correcta", () => {
    for (let s = 0; s < 100; s++) {
      const ok = [false, false, true, false];
      const removed = fiftyRemove(ok, seeded(s));
      expect(removed).toHaveLength(2);
      expect(removed).not.toContain(2);
      expect(new Set(removed).size).toBe(2);
    }
  });
});

import { ranking, stars } from "../../src/game/rules";

describe("pantalla final: estrellas y podio", () => {
  it("estrellas según el porcentaje de aciertos", () => {
    expect(stars(0, 0)).toBe(0);
    expect(stars(9, 10)).toBe(3);
    expect(stars(6, 6)).toBe(3);
    expect(stars(7, 10)).toBe(2);
    expect(stars(5, 10)).toBe(1);
    expect(stars(4, 10)).toBe(0);
  });

  const four = () =>
    createGame(["Ana", "Leo", "Eva", "Teo"].map((name) => ({ name, avatar: "x" })));
  const give = (g: ReturnType<typeof four>, player: number, wedges: number, wrong = 0) => {
    g.cur = player;
    for (let t = 0; t < wedges; t++) recordAnswer(g, t, true, `q${player}-${t}`);
    for (let k = 0; k < wrong; k++) recordAnswer(g, 0, false, `w${player}-${k}`);
  };

  it("el ganador va primero y el resto por quesitos", () => {
    const g = four();
    give(g, 0, 2);
    give(g, 1, 4);
    give(g, 3, 1);
    give(g, 2, 6); // gana Eva
    const r = ranking(g);
    expect(r.map((x) => x.player.name)).toEqual(["Eva", "Leo", "Ana", "Teo"]);
    expect(r.map((x) => x.place)).toEqual([1, 2, 3, 4]);
  });

  it("a igualdad de quesitos desempatan los aciertos, y si todo coincide comparten puesto", () => {
    const g = four();
    give(g, 1, 3, 1);
    give(g, 2, 3, 1);
    give(g, 3, 2);
    give(g, 0, 6);
    // Leo y Eva: 3 quesitos, 3 aciertos de 4 → empate en el 2.º puesto
    const r = ranking(g);
    expect(r.map((x) => [x.player.name, x.place])).toEqual([["Ana", 1], ["Leo", 2], ["Eva", 2], ["Teo", 4]]);
    expect(r[1].stars).toBe(2); // 75 %
  });
});
