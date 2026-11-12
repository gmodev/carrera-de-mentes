import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parse } from "yaml";
import { QuestionsFile } from "../../src/data/schema";

it("los ejemplos de preguntas del README cumplen el esquema", () => {
  const md = readFileSync(new URL("../../README.md", import.meta.url), "utf8");
  const block = md.match(/```yaml\n([\s\S]*?)```/)![1];
  const r = QuestionsFile.safeParse(parse(block));
  expect(r.success ? [] : r.error.issues).toEqual([]);
  expect(new Set(r.data!.map((q) => q.tipo)).size).toBe(4);
});
