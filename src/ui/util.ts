export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector(sel) as T;
export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll(sel)) as T[];

export const esc = (s: unknown) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Escapa y vuelve a permitir solo <sup>, <sub>, <b> e <i> (validadas en el esquema). */
export const rich = (s: string) => esc(s).replace(/&lt;(\/?)(sup|sub|b|i)&gt;/g, "<$1$2>");

/** Texto plano (sin etiquetas) para atributos como aria-label. */
export const plain = (s: string) => s.replace(/<\/?(sup|sub|b|i)>/g, (m) => (m === "<sup>" ? "^" : ""));

export const mmss = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
};

/** Un SVG como valor CSS url(...) para usarlo de fondo. */
export const svgUrl = (svg: string) => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;

export const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
