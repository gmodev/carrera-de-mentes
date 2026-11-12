import type { App, Screen } from "../app";
import { levelKey, unitSummary } from "../content";
import { progressPie } from "../pie";
import { esc, svgUrl } from "../util";
import { setupScreen } from "./setup";
import { progressScreen } from "./progress";

export function menuScreen(): Screen {
  return {
    render(app: App) {
      const { t, tx } = app.i18n;
      app.html(`
        <section class="stack" aria-labelledby="menu-h" id="menu">
          <h2 id="menu-h" class="menu-h">${esc(t("menu.choose"))}</h2>
          ${app.content.subjects
            .map(
              (s) => `
            <div class="subject panel"${s.fondo ? ` style="--sart:${esc(svgUrl(s.fondo))}"` : ""}>
              <h3 class="subject-h"><span class="subject-emoji" aria-hidden="true">${s.emoji}</span> ${esc(tx(s.nombre))}</h3>
              <div class="units">
                ${s.units
                  .map((u) => {
                    const sum = unitSummary(u, app.progress);
                    const pct = Math.round(sum.level * 100);
                    const levelText = sum.seen ? t("menu.level", { level: t(levelKey(sum.level)), p: pct }) : t("menu.notStarted");
                    return `<div class="unitcard">
                      <button type="button" class="unitbtn" data-s="${esc(s.id)}" data-u="${esc(u.id)}">
                        <span class="unit-pie">${progressPie(sum.per.map((x) => x.level), u.temas.map((th) => th.color), 112, `${pct}%`)}</span>
                        <span class="unit-info">
                          <b class="unit-name">${esc(tx(u.nombre))}</b>
                          <span class="muted">${esc(t("menu.questions", { n: u.preguntas.length }))}</span>
                          <span class="unit-level">${esc(levelText)}</span>
                          <span class="unit-go" aria-hidden="true">${esc(t("menu.play"))} →</span>
                        </span>
                      </button>
                      ${sum.struggling
                        ? `<button type="button" class="btn small review-mini" data-review="1" data-s="${esc(s.id)}" data-u="${esc(u.id)}" aria-label="${esc(t(sum.struggling === 1 ? "menu.reviewAria1" : "menu.reviewAria", { n: sum.struggling, unit: tx(u.nombre) }))}">🔁 ${esc(t("menu.review", { n: sum.struggling }))}</button>`
                        : ""}
                    </div>`;
                  })
                  .join("")}
              </div>
            </div>`,
            )
            .join("")}
          <div><button type="button" class="btn small" id="to-progress">${esc(t("menu.progress"))}</button></div>
        </section>`);
      document.getElementById("menu")!.addEventListener("click", (e) => {
        const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-u]");
        if (!b) return;
        const found = app.findUnit(b.dataset.s!, b.dataset.u!);
        if (!found) return;
        app.prefs.review = b.dataset.review === "1";
        app.snd.ensure();
        app.snd.blip();
        app.go(setupScreen(found.subject, found.unit));
      });
      document.getElementById("to-progress")!.addEventListener("click", () => {
        app.snd.blip();
        app.go(progressScreen());
      });
    },
  };
}
