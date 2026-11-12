/** Comprobación de respuestas escritas y de ordenar. */

/**
 * Lee un número escrito por una persona:
 * - ignora espacios ("1 000" → 1000)
 * - la coma es decimal ("3,5" → 3.5)
 * - el punto es decimal ("3.5"), salvo que tenga forma de miles ("1.000", "1.200.000")
 * - si hay punto y coma, el último que aparece es el decimal ("1.234,5" → 1234.5)
 * Devuelve null si no es un número.
 */
export function parseNumber(input: string): number | null {
  let s = input.replace(/[\s  ]/g, "").replace(/^\+/, "").replace(/[−–]/g, "-");
  if (!s) return null;
  const hasComma = s.includes(","), hasDot = s.includes(".");
  if (hasComma && hasDot) {
    const dec = s.lastIndexOf(",") > s.lastIndexOf(".") ? "," : ".";
    const thou = dec === "," ? "." : ",";
    s = s.split(thou).join("");
    if (dec === ",") s = s.replace(",", ".");
  } else if (hasComma) {
    if (/^-?\d{1,3}(,\d{3}){2,}$/.test(s)) s = s.split(",").join("");
    else s = s.replace(",", ".");
  } else if (hasDot) {
    if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.split(".").join("");
  }
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function checkNumeric(input: string, expected: number, tolerance = 0): boolean {
  const n = parseNumber(input);
  if (n === null) return false;
  return Math.abs(n - expected) <= tolerance + 1e-9;
}

/** `order` son índices de los elementos en el orden correcto (0..n-1). */
export function checkOrder(order: readonly number[]): boolean {
  return order.every((v, i) => v === i);
}

/** Baraja el orden asegurando que no empieza ya resuelto. */
export function scrambledOrder(n: number, rng: () => number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let tries = 0; tries < 20; tries++) {
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    if (!checkOrder(idx)) return idx;
  }
  return idx.reverse();
}
