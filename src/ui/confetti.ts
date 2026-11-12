import { reducedMotion } from "./util";

export function confetti(colors: readonly string[]) {
  if (reducedMotion()) return;
  const cv = document.getElementById("fx") as HTMLCanvasElement | null;
  const ctx = cv?.getContext("2d");
  if (!cv || !ctx) return;
  cv.hidden = false;
  const W = (cv.width = innerWidth), H = (cv.height = innerHeight);
  const bits = Array.from({ length: 140 }, () => ({
    x: Math.random() * W, y: -20 - Math.random() * H * 0.5, s: 6 + Math.random() * 8,
    v: 2 + Math.random() * 3, r: Math.random() * 6, c: colors[Math.floor(Math.random() * colors.length)],
  }));
  let t = 0;
  (function f() {
    ctx.clearRect(0, 0, W, H);
    for (const b of bits) {
      b.y += b.v;
      b.x += Math.sin((b.y + b.r) / 30);
      ctx.fillStyle = b.c;
      ctx.fillRect(b.x, b.y, b.s, b.s * 0.6);
    }
    if (++t < 260) requestAnimationFrame(f);
    else { ctx.clearRect(0, 0, W, H); cv.hidden = true; }
  })();
}
