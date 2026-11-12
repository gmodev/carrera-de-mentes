import { unitKey } from "../../data/keys";
import type { App, Screen } from "../app";
import { levelKey, unitSummary } from "../content";
import { esc } from "../util";
import { menuScreen } from "./menu";
import { setupScreen } from "./setup";

export function progressScreen(): Screen {
  return {
    heading: (app) => ({ title: app.i18n.t("progress.title"), tagline: app.i18n.t("progress.note") }),
    render(app: App) {
      const { t, tx } = app.i18n;
      const blocks = app.content.subjects.flatMap((s) =>
        s.units.map((u) => {
          const sum = unitSummary(u, app.progress);
          return `
          <section class="panel stack" aria-label="${esc(tx(s.nombre) + " · " + tx(u.nombre))}">
            <h2>${s.emoji} ${esc(tx(s.nombre))} · ${esc(tx(u.nombre))}</h2>
            ${sum.seen === 0 ? `<p class="muted">${esc(t("progress.empty"))}</p>` : ""}
            <ul class="levels">
              ${u.temas
                .map((th, i) => {
                  const x = sum.per[i];
                  const pct = Math.round(x.level * 100);
                  return `<li>
                    <span class="dot" style="background:${th.color}" aria-hidden="true">${th.emoji}</span>
                    <div class="lv">
                      <div class="lv-top"><b>${esc(tx(th.nombre))}</b><span class="lv-tag">${esc(t(levelKey(x.level)))}</span></div>
                      <div class="lv-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="${esc(tx(th.nombre))}"><i style="width:${pct}%;background:${th.color}"></i></div>
                      <span class="muted small">${esc(t("progress.mastered", { m: x.mastered, t: x.total }))}${x.struggling ? " · " + esc(t("progress.struggling", { n: x.struggling })) : ""}</span>
                    </div>
                  </li>`;
                })
                .join("")}
            </ul>
            <div class="row">
              ${sum.struggling ? `<button type="button" class="btn small" data-review="${esc(s.id)}|${esc(u.id)}">${esc(t("progress.review"))}</button>` : ""}
              ${sum.seen ? `<button type="button" class="btn small ghost" data-reset="${esc(s.id)}|${esc(u.id)}">${esc(t("progress.reset"))}</button>` : ""}
            </div>
          </section>`;
        }),
      );
      app.html(`<div class="stack" id="progress">
        <div><button type="button" class="btn small ghost" id="back">${esc(t("nav.back"))}</button></div>
        ${blocks.join("")}
      </div>`);
      document.getElementById("back")!.addEventListener("click", () => app.go(menuScreen()));
      document.getElementById("progress")!.addEventListener("click", (e) => {
        const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-review],button[data-reset]");
        if (!b) return;
        const [sid, uid] = (b.dataset.review ?? b.dataset.reset)!.split("|");
        const found = app.findUnit(sid, uid);
        if (!found) return;
        if (b.dataset.review) {
          app.prefs.review = true;
          app.go(setupScreen(found.subject, found.unit));
        } else if (confirm(t("progress.resetConfirm"))) {
          app.progress.clear(unitKey(found.unit));
          this.render(app);
        }
      });
    },
  };
}
