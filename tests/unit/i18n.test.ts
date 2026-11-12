import { describe, expect, it } from "vitest";
import es from "../../src/i18n/es.json";
import va from "../../src/i18n/va.json";
import { makeI18n } from "../../src/i18n";

describe("i18n", () => {
  it("es.json y va.json tienen las mismas claves", () => {
    expect(Object.keys(va).sort()).toEqual(Object.keys(es).sort());
  });

  it("sustituye variables", () => {
    expect(makeI18n("es").t("game.turnOf", { name: "Ana" })).toBe("Turno de Ana");
    expect(makeI18n("va").t("game.turnOf", { name: "Ana" })).toBe("Torn de Ana");
  });

  it("los textos del contenido usan es si falta va", () => {
    const va = makeI18n("va");
    expect(va.tx({ es: "Hola", va: "Bon dia" })).toBe("Bon dia");
    expect(va.tx({ es: "Hola" })).toBe("Hola");
    expect(makeI18n("es").tx({ es: "Hola", va: "Bon dia" })).toBe("Hola");
  });
});
