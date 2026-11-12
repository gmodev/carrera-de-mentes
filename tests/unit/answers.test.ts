import { describe, expect, it } from "vitest";
import { checkNumeric, checkOrder, parseNumber, scrambledOrder } from "../../src/game/answers";
import { seeded } from "../../src/game/rng";

describe("parseNumber", () => {
  it.each([
    ["81", 81], ["  81 ", 81], ["3,5", 3.5], ["3.5", 3.5], ["0,25", 0.25], [",5", 0.5],
    ["1 000", 1000], ["1.000", 1000], ["1.200.000", 1200000], ["1.234,5", 1234.5], ["1,234.5", 1234.5],
    ["-2", -2], ["−2", -2], ["+7", 7], ["1492", 1492], ["1.492", 1492], ["2.50", 2.5],
  ])("%s → %s", (input, expected) => {
    expect(parseNumber(input)).toBe(expected);
  });

  it.each(["", "   ", "abc", "3,5,", "1..2", "3 a"])("«%s» no es un número", (input) => {
    expect(parseNumber(input)).toBeNull();
  });
});

describe("checkNumeric", () => {
  it("acepta coma o punto decimal y espacios", () => {
    expect(checkNumeric(" 2,5 ", 2.5)).toBe(true);
    expect(checkNumeric("2.5", 2.5)).toBe(true);
    expect(checkNumeric("2,6", 2.5)).toBe(false);
  });
  it("respeta la tolerancia", () => {
    expect(checkNumeric("3,14", Math.PI, 0.01)).toBe(true);
    expect(checkNumeric("3,1", Math.PI, 0.01)).toBe(false);
  });
  it("una respuesta vacía o con letras es incorrecta", () => {
    expect(checkNumeric("", 0)).toBe(false);
    expect(checkNumeric("cero", 0)).toBe(false);
  });
});

describe("ordenar", () => {
  it("checkOrder", () => {
    expect(checkOrder([0, 1, 2, 3])).toBe(true);
    expect(checkOrder([1, 0, 2, 3])).toBe(false);
  });
  it("scrambledOrder nunca empieza resuelto y es una permutación", () => {
    const rng = seeded(1);
    for (let n = 3; n <= 6; n++)
      for (let k = 0; k < 200; k++) {
        const o = scrambledOrder(n, rng);
        expect(checkOrder(o)).toBe(false);
        expect([...o].sort()).toEqual(Array.from({ length: n }, (_, i) => i));
      }
  });
});
