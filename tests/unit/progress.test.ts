import { describe, expect, it } from "vitest";
import { ProgressStore, STORAGE_KEY, isMastered, summarizeTheme, weightOf, type KV } from "../../src/progress/store";

const memory = (): KV & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};
const U = "historia/u08-prehistoria";

describe("progreso", () => {
  it("guarda aciertos y fallos por pregunta y los recupera", () => {
    const kv = memory();
    const a = new ProgressStore(kv);
    a.record(U, "q1", true, 1);
    a.record(U, "q1", false, 2);
    a.record(U, "q2", true, 3);
    const b = new ProgressStore(kv);
    expect(b.stat(U, "q1")).toEqual({ ok: 1, ko: 1, last: "ko", t: 2 });
    expect(b.stat(U, "q2")).toMatchObject({ ok: 1, ko: 0, last: "ok" });
    expect(JSON.parse(kv.data.get(STORAGE_KEY)!).v).toBe(1);
  });

  it("no rompe si el almacenamiento falla o está corrupto", () => {
    const broken: KV = {
      getItem: () => { throw new Error("bloqueado"); },
      setItem: () => { throw new Error("lleno"); },
      removeItem: () => {},
    };
    const s = new ProgressStore(broken);
    expect(() => s.record(U, "q1", true)).not.toThrow();
    expect(s.stat(U, "q1")?.ok).toBe(1);

    const kv = memory();
    kv.setItem(STORAGE_KEY, "{no es json");
    expect(new ProgressStore(kv).snapshot()).toEqual({ v: 1, units: {} });
    expect(new ProgressStore(null).weight(U, "x")).toBe(0);
  });

  it("peso para el Repaso: falladas primero, más si la última fue fallo", () => {
    expect(weightOf(undefined)).toBe(0);
    expect(weightOf({ ok: 3, ko: 0, last: "ok", t: 0 })).toBe(0);
    expect(weightOf({ ok: 0, ko: 1, last: "ko", t: 0 })).toBe(3);
    expect(weightOf({ ok: 1, ko: 1, last: "ok", t: 0 })).toBe(0 + 0);
    expect(weightOf({ ok: 0, ko: 3, last: "ko", t: 0 })).toBeGreaterThan(weightOf({ ok: 0, ko: 1, last: "ko", t: 0 }));
  });

  it("resumen por tema (nivel por color)", () => {
    const s = new ProgressStore(memory());
    s.record(U, "a", true);
    s.record(U, "b", false);
    s.record(U, "c", false);
    s.record(U, "c", true);
    const sum = summarizeTheme(s, U, ["a", "b", "c", "d"]);
    expect(sum).toEqual({ total: 4, seen: 3, mastered: 2, struggling: 1, level: 0.5 });
    expect(isMastered(s.stat(U, "c"))).toBe(true);
  });

  it("borrar el progreso de una unidad", () => {
    const s = new ProgressStore(memory());
    s.record(U, "a", true);
    s.record("otra/u1", "z", true);
    s.clear(U);
    expect(s.stat(U, "a")).toBeUndefined();
    expect(s.stat("otra/u1", "z")).toBeDefined();
  });
});
