import { SEGMENTS, SEG_DEG } from "../game/wheel";
import { esc } from "./util";

export interface WheelLabels {
  segments: { color: string; emoji: string; label: string }[]; // 6 temas
  wild: string;
  aria: string;
  spinAria: string;
  spinText: string;
}

const CX = 200, CY = 200, R = 186;
/** Radio del texto (tangencial) y del emoji. Fuera del anillo que palpita y por debajo del puntero. */
const R_LABEL = 132, R_EMOJI = 92;

/** Tamaño de letra para que la etiqueta quepa en el ancho del segmento a ese radio. */
function fontFor(label: string): number {
  const room = 2 * R_LABEL * Math.sin((SEG_DEG / 2) * (Math.PI / 180)) - 14; // cuerda menos margen
  const est = (fs: number) => label.length * fs * 0.56; // ancho aproximado en Fredoka
  let fs = 18;
  while (fs > 11 && est(fs) > room) fs--;
  return fs;
}

/**
 * SVG de la ruleta (7 segmentos) con el botón central GIRAR.
 * Las etiquetas van perpendiculares al radio con la parte de arriba hacia
 * fuera: el segmento que queda bajo el puntero siempre se lee derecho.
 */
export function wheelSVG(l: WheelLabels, rot: number): string {
  let segs = "", bulbs = "";
  const pt = (a: number, r: number) => [CX + r * Math.sin((a * Math.PI) / 180), CY - r * Math.cos((a * Math.PI) / 180)];
  for (let i = 0; i < SEGMENTS; i++) {
    const a0 = i * SEG_DEG, a1 = (i + 1) * SEG_DEG, mid = a0 + SEG_DEG / 2;
    const [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R);
    const seg = l.segments[i];
    const fill = seg ? seg.color : "#FFF4DC";
    const label = seg ? seg.label : l.wild, em = seg ? seg.emoji : "🎁";
    segs += `<g class="seg" data-seg="${i}">
      <path d="M${CX} ${CY}L${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}Z" fill="${fill}" stroke="#1B1230" stroke-width="4" stroke-linejoin="round"/>
      <g transform="rotate(${mid.toFixed(2)} ${CX} ${CY})">
        <text x="${CX}" y="${CY - R_EMOJI}" text-anchor="middle" dominant-baseline="central" font-size="28">${em}</text>
        <text x="${CX}" y="${CY - R_LABEL}" text-anchor="middle" dominant-baseline="central" font-family="Fredoka, Arial, sans-serif" font-weight="600" font-size="${fontFor(label)}" fill="#1B1230">${esc(label)}</text>
      </g>
    </g>`;
  }
  // Bombillas del borde, como en una ruleta de concurso (2 por segmento).
  for (let k = 0; k < SEGMENTS * 2; k++) {
    const [bx, by] = pt(k * (SEG_DEG / 2), R + 7);
    bulbs += `<circle cx="${bx.toFixed(2)}" cy="${by.toFixed(2)}" r="3.2" class="bulb${k % 2 ? " alt" : ""}"/>`;
  }
  return `<svg viewBox="-6 -6 412 412" role="group" aria-label="${esc(l.aria)}">
    <circle cx="${CX}" cy="${CY}" r="${R + 9}" fill="#1B1230"/>
    <g id="wheelG" style="transform:rotate(${rot}deg)">${segs}</g>
    <g class="bulbs" aria-hidden="true">${bulbs}</g>
    <g id="hub" role="button" tabindex="0" aria-label="${esc(l.spinAria)}">
      <circle class="ring" cx="${CX}" cy="${CY}" r="48"/>
      <circle class="focus" cx="${CX}" cy="${CY}" r="60"/>
      <circle class="knob" cx="${CX}" cy="${CY}" r="48"/>
      <text x="${CX}" y="${CY}" text-anchor="middle" dominant-baseline="central" font-family="Fredoka, Arial, sans-serif" font-weight="600" font-size="21" fill="#FFF4DC">${esc(l.spinText)}</text>
    </g>
    <path class="pointer" d="M200 46 L184 10 L216 10 Z" fill="#FFD23F" stroke="#1B1230" stroke-width="5" stroke-linejoin="round"/>
  </svg>`;
}
