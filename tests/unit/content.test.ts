import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { loadContent, rawContentFiles } from "../../src/data/load";
import { parseContent } from "../../src/data/parse";

const content = loadContent({ quiet: true });
const historia = content.subjects.find((s) => s.id === "historia")!;
const u8 = historia.units.find((u) => u.id === "u08-prehistoria")!;

/** Preguntas de la versión original, tal cual están en reference/carrera.html. */
type RefQ = [number, string, string, string[], string, number?];
const html = readFileSync(new URL("../../reference/carrera.html", import.meta.url), "utf8");
const REF: RefQ[] = JSON.parse(html.match(/const QS = (\[[\s\S]*?\n\]);/)![1]);
const REF_TEMAS = ["fuentes", "tiempo", "evolucion", "paleolitico", "neolitico", "arte"];

describe("contenido real", () => {
  it("carga sin errores", () => {
    expect(parseContent(rawContentFiles).errors).toEqual([]);
  });

  it("no le falta ninguna traducción al valenciano", () => {
    expect(parseContent(rawContentFiles).warnings).toEqual([]);
  });

  it("Historia, unidad 8, tiene los 6 temas de la referencia en el mismo orden", () => {
    expect(u8.temas.map((t) => t.id)).toEqual(REF_TEMAS);
    expect(u8.temas.map((t) => t.color)).toEqual(["#5BA4FF", "#FFD23F", "#FF7AB6", "#FF9F43", "#4ADE80", "#B79CFF"]);
  });

  it("conserva las 77 preguntas de la referencia sin cambios", () => {
    expect(REF).toHaveLength(77);
    REF.forEach(([cat, q, ok, wrong, expl, hoja], i) => {
      const id = "hist-u08-" + String(i + 1).padStart(3, "0");
      const m = u8.preguntas.find((x) => x.id === id);
      expect(m, id).toBeDefined();
      if (!m || m.tipo !== "multiple") throw new Error(`${id} debería ser multiple`);
      expect(m.tema).toBe(REF_TEMAS[cat]);
      expect(m.pregunta.es).toBe(q);
      expect(m.correcta.es).toBe(ok);
      expect(m.incorrectas.map((x) => x.es)).toEqual(wrong);
      // Única corrección intencionada: la explicación de la cerámica estaba en valenciano.
      if (expl === "Atifells y bols de cerámica.") expect(m.explicacion.es).toBe("Recipientes y cuencos de cerámica.");
      else expect(m.explicacion.es).toBe(expl);
      expect(m.fuente).toBe(hoja ? "Hoja de repaso" : "Libro, unidad 8");
      expect(m.verificada).toBe(true);
    });
  });

  it("cada tema tiene preguntas y los ids no se repiten", () => {
    for (const t of u8.temas) expect(u8.preguntas.some((q) => q.tema === t.id)).toBe(true);
    const ids = u8.preguntas.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("incluye preguntas de los cuatro tipos", () => {
    expect(new Set(u8.preguntas.map((q) => q.tipo))).toEqual(new Set(["multiple", "verdadero_falso", "numerica", "ordenar"]));
  });
});

/* ---------- Validación con contenido inventado ---------- */
const SUBJECT = `id: prueba\nnombre: { es: Prueba, va: Prova }\nemoji: "🧪"\npersonajes:\n${[1, 2, 3, 4].map((n) => `  - { emoji: "${n}", nombre: { es: P${n}, va: P${n} } }`).join("\n")}\n`;
const temas = ["a", "b", "c", "d", "e", "f"];
const UNIT = `id: u1\nnombre: { es: U1, va: U1 }\ntitulo: { es: T, va: T }\ndescripcion: { es: D, va: D }\ntemas:\n${temas.map((t) => `  - { id: ${t}, nombre: { es: ${t}, va: ${t} }, corto: { es: ${t}, va: ${t} }, emoji: "x", color: "#112233" }`).join("\n")}\n`;
const vf = (id: string, tema: string, extra = "") =>
  `- { id: ${id}, tema: ${tema}, tipo: verdadero_falso, respuesta: true, pregunta: { es: P, va: P }, explicacion: { es: E, va: E }, fuente: Libro, verificada: true${extra} }`;
const allThemes = temas.map((t) => vf(`q-${t}`, t)).join("\n");
const files = (questions: string, unit = UNIT) => ({
  "./subjects/prueba/subject.yaml": SUBJECT,
  "./subjects/prueba/u1/unit.yaml": unit,
  "./subjects/prueba/u1/questions.yaml": questions,
});

describe("validación del esquema", () => {
  it("acepta un banco válido", () => {
    const r = parseContent(files(allThemes));
    expect(r.errors).toEqual([]);
    expect(r.content.subjects[0].units[0].preguntas).toHaveLength(6);
  });

  it("falla si una pregunta multiple no tiene 3 incorrectas", () => {
    const bad = `- { id: m1, tema: a, tipo: multiple, pregunta: P, correcta: C, incorrectas: [X, Y], explicacion: E, fuente: Libro, verificada: true }`;
    const r = parseContent(files(allThemes + "\n" + bad));
    expect(r.errors.join("\n")).toMatch(/incorrectas/);
  });

  it("falla si el tema no existe", () => {
    const r = parseContent(files(allThemes + "\n" + vf("zz", "noexiste")));
    expect(r.errors.join("\n")).toMatch(/noexiste/);
  });

  it("falla si falta fuente o verificada", () => {
    const bad = `- { id: x1, tema: a, tipo: verdadero_falso, respuesta: true, pregunta: P, explicacion: E }`;
    const r = parseContent(files(allThemes + "\n" + bad));
    expect(r.errors.join("\n")).toMatch(/fuente/);
    expect(r.errors.join("\n")).toMatch(/verificada/);
  });

  it("falla con un tipo desconocido o un id repetido", () => {
    const bad = `- { id: q-a, tema: a, tipo: dibujo, pregunta: P, explicacion: E, fuente: L, verificada: true }`;
    expect(parseContent(files(allThemes + "\n" + bad)).errors.length).toBeGreaterThan(0);
    expect(parseContent(files(allThemes + "\n" + vf("q-a", "a"))).errors.join("\n")).toMatch(/repetido/);
  });

  it("falla si un tema se queda sin preguntas", () => {
    const r = parseContent(files(temas.slice(0, 5).map((t) => vf(`q-${t}`, t)).join("\n")));
    expect(r.errors.join("\n")).toMatch(/«f» no tiene ninguna pregunta/);
  });

  it("falla con HTML no permitido, pero acepta <sup>", () => {
    const sup = `- { id: s1, tema: a, tipo: numerica, respuesta: 81, pregunta: { es: "¿Cuánto es 3<sup>4</sup>?", va: "Quant és 3<sup>4</sup>?" }, explicacion: { es: E, va: E }, fuente: L, verificada: false }`;
    expect(parseContent(files(allThemes + "\n" + sup)).errors).toEqual([]);
    const bad = `- { id: s2, tema: a, tipo: numerica, respuesta: 1, pregunta: "<script>x</script>", explicacion: E, fuente: L, verificada: false }`;
    expect(parseContent(files(allThemes + "\n" + bad)).errors.join("\n")).toMatch(/etiquetas/);
  });

  it("si falta el valenciano solo avisa (no es error) y se puede escribir solo en español", () => {
    const es = `- { id: e1, tema: a, tipo: verdadero_falso, respuesta: false, pregunta: Solo español, explicacion: E, fuente: L, verificada: true }`;
    const r = parseContent(files(allThemes + "\n" + es));
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => w.includes("Solo español"))).toBe(true);
    const q = r.content.subjects[0].units[0].preguntas.find((x) => x.id === "e1")!;
    expect(q.pregunta).toEqual({ es: "Solo español" });
  });

  it("una unidad necesita exactamente 6 temas", () => {
    const five = UNIT.split("\n").filter((l) => !l.includes("id: f,")).join("\n");
    expect(parseContent(files(allThemes, five)).errors.join("\n")).toMatch(/6 temas/);
  });

  it("descubre materias nuevas solo por su carpeta", () => {
    const r = parseContent({ ...files(allThemes), "./subjects/otra/subject.yaml": SUBJECT.replace("id: prueba", "id: otra") });
    // «otra» existe pero aún no tiene unidades: error claro, no un fallo silencioso
    expect(r.errors.join("\n")).toMatch(/otra.*ninguna unidad/);
  });
});

import { checkSvg } from "../../src/data/parse";

describe("fondo de la materia (fondo.svg)", () => {
  const ok = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><g id="a"><circle r="2"/></g></defs><use href="#a"/></svg>';
  const check = (svg: string) => {
    const errors: string[] = [];
    return { out: checkSvg(svg, "fondo.svg", errors), errors };
  };

  it("Historia tiene su fondo y es válido", () => {
    expect(historia.fondo).toMatch(/^<svg /);
  });

  it("acepta un dibujo con <use> internos y lo compacta", () => {
    const r = check(`<!-- comentario -->\n${ok.replace("><", ">\n  <")}`);
    expect(r.errors).toEqual([]);
    expect(r.out).not.toMatch(/comentario|\n/);
  });

  it.each([
    ["scripts", ok.replace("</svg>", "<script>alert(1)</script></svg>")],
    ["eventos", ok.replace("<circle", '<circle onclick="x()"')],
    ["enlaces externos", ok.replace('href="#a"', 'href="https://ejemplo.com/a.svg"')],
    ["url() externas", ok.replace("<circle", '<circle fill="url(https://x/y)"')],
    ["algo que no es SVG", "<html></html>"],
    ["sin xmlns", ok.replace(' xmlns="http://www.w3.org/2000/svg"', "")],
  ])("rechaza %s", (_, svg) => {
    const r = check(svg);
    expect(r.out).toBeNull();
    expect(r.errors).toHaveLength(1);
  });

  it("rechaza un fondo demasiado grande", () => {
    const big = ok.replace("</svg>", `<path d="${"M0 0L1 1".repeat(6000)}"/></svg>`);
    expect(check(big).errors.join()).toMatch(/KB/);
  });

  it("un fondo inválido rompe la carga de la materia", () => {
    const r = parseContent({ ...files(allThemes), "./subjects/prueba/fondo.svg": "<svg><script/></svg>" });
    expect(r.errors.join("\n")).toMatch(/fondo\.svg/);
  });

  it("el fondo es opcional", () => {
    expect(parseContent(files(allThemes)).content.subjects[0].fondo).toBeUndefined();
  });
});
