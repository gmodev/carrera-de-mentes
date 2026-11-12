import { describe, expect, it } from "vitest";
import { WILD, chooseSegment, segmentAt, targetRotation } from "../../src/game/wheel";
import { seeded } from "../../src/game/rng";

describe("ruleta", () => {
  it("solo cae en colores que faltan o en el comodín", () => {
    const rng = seeded(7);
    for (let k = 0; k < 500; k++) {
      const seg = chooseSegment([1, 4], rng);
      expect([1, 4, WILD]).toContain(seg);
    }
  });

  it("puede caer en todos los que faltan y en el comodín", () => {
    const rng = seeded(8);
    const seen = new Set(Array.from({ length: 500 }, () => chooseSegment([0, 2, 5], rng)));
    expect(seen).toEqual(new Set([0, 2, 5, WILD]));
  });

  it("la rotación deja el segmento elegido bajo el puntero y siempre gira hacia delante", () => {
    const rng = seeded(11);
    let rot = 0;
    for (let k = 0; k < 300; k++) {
      const seg = k % 7;
      const next = targetRotation(rot, seg, rng);
      expect(next - rot).toBeGreaterThanOrEqual(360 * 5);
      expect(segmentAt(next)).toBe(seg);
      rot = next;
    }
  });
});
