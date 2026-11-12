/** Quesito de 6 porciones: las ganadas, con su color. */
/**
 * Quesito de progreso: cada porción crece desde el centro según lo dominado
 * en ese color (0..1). En el centro, el porcentaje total.
 */
export function progressPie(levels: readonly number[], colors: readonly string[], size: number, label: string): string {
  const c = 50, R = 46, hub = 18;
  const wedge = (i: number, r: number, fill: string, extra = "") => {
    const a0 = (i * 60 * Math.PI) / 180, a1 = ((i + 1) * 60 * Math.PI) / 180;
    const p = (a: number) => [c + r * Math.sin(a), c - r * Math.cos(a)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `<path d="M${c} ${c}L${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z" fill="${fill}"${extra}/>`;
  };
  let out = "";
  colors.forEach((col, i) => {
    out += wedge(i, R, "#3A2658", ' stroke="#241638" stroke-width="2"');
    const lv = Math.max(0, Math.min(1, levels[i] ?? 0));
    if (lv > 0) out += wedge(i, hub + (R - hub) * lv, col, ` class="pp-fill" style="--i:${i}" stroke="#241638" stroke-width="2"`);
  });
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">${out}
    <circle cx="${c}" cy="${c}" r="${R}" fill="none" stroke="#4A3568" stroke-width="2"/>
    <circle cx="${c}" cy="${c}" r="${hub}" fill="#241638" stroke="#FFD23F" stroke-width="2.5"/>
    <text x="${c}" y="${c}" text-anchor="middle" dominant-baseline="central" font-family="Fredoka, Arial, sans-serif" font-weight="600" font-size="${label.length > 3 ? 13 : 15}" fill="#FFF4DC">${label}</text>
  </svg>`;
}

/** `fresh`: índice de la porción recién ganada (se anima). */
export function pie(has: readonly boolean[], colors: readonly string[], size: number, fresh = -1): string {
  const r = 24, c = 28;
  let out = "";
  colors.forEach((color, i) => {
    const a0 = (i * 60 * Math.PI) / 180, a1 = ((i + 1) * 60 * Math.PI) / 180;
    const p = (a: number) => [c + r * Math.sin(a), c - r * Math.cos(a)];
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    out += `<path d="M${c} ${c}L${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z" fill="${has[i] ? color : "#3A2658"}"${i === fresh ? ' class="pie-new"' : ""} stroke="#241638" stroke-width="2"/>`;
  });
  return `<svg width="${size}" height="${size}" viewBox="0 0 56 56" aria-hidden="true">${out}<circle cx="28" cy="28" r="6" fill="#241638"/></svg>`;
}
