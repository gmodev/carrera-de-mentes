import type { Subject, Unit } from "../../data/schema";
import type { App, Screen } from "../app";
import { unitSummary } from "../content";
import { $, $$, esc } from "../util";
import { menuScreen } from "./menu";
import { startGame } from "./play";

const LIMITS = [0, 15, 30, 45];

export function setupScreen(subject: Subject, unit: Unit): Screen {
  const keepNames = (app: App) => {
    $$<HTMLInputElement>("#pset input").forEach((inp, i) => (app.prefs.names[i] = inp.value));
  };
  // Si la materia tiene menos personajes que los elegidos antes, se reajustan.
  const fixAvatars = (app: App) => {
    app.prefs.avatars = app.prefs.avatars.map((a, i) => (a < subject.personajes.length ? a : i % subject.personajes.length));
  };

  return {
    subject,
    heading: (app) => ({ title: app.i18n.tx(unit.titulo), tagline: app.i18n.tx(unit.descripcion) }),
    render(app: App) {
      fixAvatars(app);
      const { t, tx } = app.i18n;
      const p = app.prefs;
      const pending = unitSummary(unit, app.progress).struggling;
      app.html(`
        <section id="setup" class="panel stack">
          <div><button type="button" class="btn small ghost" id="back">${esc(t("nav.back"))}</button></div>
          <h2>${esc(t("setup.who"))}</h2>
          <div class="setrow"><b>${esc(t("setup.players"))}</b>
            <div class="seg" id="count" role="group" aria-label="${esc(t("setup.playersGroup"))}">
              ${[1, 2, 3, 4].map((n) => `<button type="button" data-n="${n}" aria-pressed="${n === p.nPlayers}">${esc(n === 1 ? t("setup.onePlayer") : t("setup.nPlayers", { n }))}</button>`).join("")}
            </div>
          </div>
          <div class="pset" id="pset">
            ${Array.from({ length: p.nPlayers }, (_, i) => `
              <div class="pbox">
                <label for="p${i}">${esc(t("setup.name", { n: i + 1 }))}<input id="p${i}" maxlength="14" value="${esc(p.names[i])}" placeholder="${esc(t("setup.namePlaceholder", { n: i + 1 }))}" autocomplete="off"></label>
                <div class="avs" role="group" aria-label="${esc(t("setup.avatarGroup", { n: i + 1 }))}">
                  ${subject.personajes.map((a, k) => `<button type="button" data-p="${i}" data-a="${k}" title="${esc(tx(a.nombre))}" aria-label="${esc(tx(a.nombre))}" aria-pressed="${p.avatars[i] === k}">${a.emoji}</button>`).join("")}
                </div>
              </div>`).join("")}
          </div>
          <div class="setrow"><b>${esc(t("setup.time"))}</b>
            <div class="seg" id="limit" role="group" aria-label="${esc(t("setup.timeGroup"))}">
              ${LIMITS.map((v) => `<button type="button" data-l="${v}" aria-pressed="${v === p.limit}">${esc(v ? t("setup.seconds", { n: v }) : t("setup.noTime"))}</button>`).join("")}
            </div>
          </div>
          <div class="setrow"><b>${esc(t("setup.mode"))}</b>
            <div class="seg" id="mode" role="group" aria-label="${esc(t("setup.modeGroup"))}">
              <button type="button" data-r="0" aria-pressed="${!p.review}">${esc(t("setup.modeNormal"))}</button>
              <button type="button" data-r="1" aria-pressed="${p.review}">${esc(t("setup.modeReview"))}</button>
            </div>
            ${p.review ? `<p class="muted note">${esc(pending ? t("setup.modeReviewHint", { n: pending }) : t("setup.modeReviewEmpty"))}</p>` : ""}
          </div>
          <div class="setrow">
            <b>${esc(t("setup.colors"))}</b>
            <ul class="cats">${unit.temas.map((c) => `<li><span class="dot" style="background:${c.color}">${c.emoji}</span>${esc(tx(c.nombre))}</li>`).join("")}</ul>
          </div>
          <details>
            <summary>${esc(t("setup.how"))}</summary>
            <ol>${[1, 2, 3, 4, 5, 6].map((n) => `<li>${esc(t(`setup.how${n}`))}</li>`).join("")}</ol>
          </details>
          <div><button class="btn big" id="go" type="button">${esc(t("setup.go"))}</button></div>
        </section>`);

      const click = (sel: string, fn: (b: HTMLButtonElement) => void) =>
        $(sel).addEventListener("click", (e) => {
          const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
          if (!b) return;
          keepNames(app);
          fn(b);
          app.snd.ensure();
          app.snd.blip();
          this.render(app);
        });
      click("#count", (b) => (p.nPlayers = +b.dataset.n!));
      click("#limit", (b) => (p.limit = +b.dataset.l!));
      click("#mode", (b) => (p.review = b.dataset.r === "1"));
      $("#pset").addEventListener("click", (e) => {
        const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-a]");
        if (!b) return;
        keepNames(app);
        p.avatars[+b.dataset.p!] = +b.dataset.a!;
        app.snd.ensure();
        app.snd.blip();
        this.render(app);
        $<HTMLButtonElement>(`#pset button[data-p="${b.dataset.p}"][data-a="${b.dataset.a}"]`)?.focus();
      });
      $("#back").addEventListener("click", () => {
        keepNames(app);
        app.go(menuScreen());
      });
      $("#go").addEventListener("click", () => {
        keepNames(app);
        const players = Array.from({ length: p.nPlayers }, (_, i) => ({
          name: p.names[i].trim() || t("setup.namePlaceholder", { n: i + 1 }),
          avatar: subject.personajes[p.avatars[i]].emoji,
        }));
        startGame(app, { subject, unit, players, limit: p.limit, review: p.review });
      });
    },
  };
}
