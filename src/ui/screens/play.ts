/**
 * Partida: ruleta → pregunta → resultado → … → pantalla final.
 * El estado vive en `Session`; render() puede repintar en cualquier momento
 * (cambio de idioma) sin perder nada: ni opciones quitadas, ni temporizador.
 */
import type { Pregunta, Subject, Texto, Unit } from "../../data/schema";
import { unitKey } from "../../data/keys";
import { Deck } from "../../game/deck";
import { shuffle } from "../../game/rng";
import {
  advance, createGame, current, fiftyRemove, missingThemes, ranking, recordAnswer, uniqueMissed, useFifty, wedgeCount,
  type Standing,
  type AnswerOutcome, type GameState, type PlayerSetup,
} from "../../game/rules";
import { SEG_DEG, WILD, chooseSegment, targetRotation } from "../../game/wheel";
import { checkNumeric, checkOrder, parseNumber, scrambledOrder } from "../../game/answers";
import type { App, Screen } from "../app";
import { answerHtml, idsByTheme } from "../content";
import { pie } from "../pie";
import { wheelSVG } from "../wheel";
import { confetti } from "../confetti";
import { $, esc, mmss, plain, reducedMotion, rich } from "../util";
import { menuScreen } from "./menu";
import { setupScreen } from "./setup";

export interface GameConfig {
  subject: Subject;
  unit: Unit;
  players: PlayerSetup[];
  /** Segundos por pregunta; 0 = sin tiempo. */
  limit: number;
  /** Modo «Repaso: solo lo que me cuesta». */
  review: boolean;
}

interface QState {
  q: Pregunta;
  theme: number;
  /** multiple: opciones barajadas. */
  opts: { text: Texto; ok: boolean }[];
  gone: Set<number>;
  /** ordenar: orden actual (índices de q.elementos). */
  order: number[];
  numInput: string;
  answered: boolean;
  /** multiple/vf: índice elegido (vf: 0 = verdadero, 1 = falso). */
  chosen: number | null;
  timeout: boolean;
  outcome: AnswerOutcome | null;
  /** Índice del mensaje de ánimo, para repintarlo en otro idioma. */
  msgIdx: number;
  /** Primera vez que se pinta: animación de entrada (no al repintar por idioma, 50/50…). */
  fresh: boolean;
  /** Recién contestada: animación de acierto/fallo una sola vez. */
  justAnswered: boolean;
}

type Phase = "handoff" | "wheel" | "spinning" | "wild" | "question" | "end";

interface Session extends GameConfig {
  game: GameState;
  deck: Deck;
  phase: Phase;
  rot: number;
  banner: string;
  qs: QState | null;
  start: number;
  endTime: number;
  timers: Set<ReturnType<typeof setTimeout>>;
  clockInt: ReturnType<typeof setInterval> | null;
  tInt: ReturnType<typeof setInterval> | null;
  tLeft: number;
  lastBeep: number;
  /** La pantalla final ya se animó (al repintar por idioma no se repite). */
  endShown: boolean;
}

export function startGame(app: App, cfg: GameConfig) {
  const key = unitKey(cfg.unit);
  const s: Session = {
    ...cfg,
    game: createGame(cfg.players),
    deck: new Deck(idsByTheme(cfg.unit), app.rng, cfg.review ? (id) => app.progress.weight(key, id) : undefined),
    // Con varios jugadores, primero se anuncia quién empieza.
    phase: cfg.players.length > 1 ? "handoff" : "wheel",
    // Al empezar, el puntero señala el centro del comodín (no una línea entre colores).
    rot: -(WILD + 0.5) * SEG_DEG,
    banner: "",
    qs: null,
    start: Date.now(),
    endTime: 0,
    timers: new Set(),
    clockInt: null,
    tInt: null,
    tLeft: 0,
    lastBeep: -1,
    endShown: false,
  };
  app.snd.ensure();
  app.musicWanted = true;
  app.snd.startMusic();
  app.snd.wild();
  app.go(playScreen(s));
}

function playScreen(s: Session): Screen {
  let app!: App;
  const { unit } = s;
  const colors = unit.temas.map((t) => t.color);

  const later = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      s.timers.delete(id);
      fn();
    }, ms);
    s.timers.add(id);
  };
  const stopTimer = () => {
    if (s.tInt) clearInterval(s.tInt);
    s.tInt = null;
  };

  /* ---------- Estructura ---------- */
  function render(a: App) {
    app = a;
    const { t } = app.i18n;
    if (!document.getElementById("game")) {
      // Reloj y «Salir» van en la cabecera compacta.
      $("#hslot").innerHTML = `
        <span class="clock" id="clock" aria-label="${esc(t("game.clock"))}">⏱ 00:00</span>
        <button type="button" class="btn small ghost" id="exit">${esc(t("nav.exit"))}</button>`;
      app.html(`
        <section id="game" class="stack">
          <div class="players" id="players"></div>
          <div class="stage" id="stage"></div>
        </section>`);
      $("#exit").addEventListener("click", () => {
        if (s.phase === "end" || confirm(app.i18n.t("nav.exitConfirm"))) {
          app.musicWanted = false;
          app.snd.stopMusic();
          app.go(menuScreen());
        }
      });
      if (!s.clockInt && s.phase !== "end") {
        s.clockInt = setInterval(() => {
          const c = document.getElementById("clock");
          if (c) c.textContent = "⏱ " + mmss(Date.now() - s.start);
        }, 500);
      }
    } else {
      $("#clock").setAttribute("aria-label", t("game.clock"));
      $("#exit").textContent = t("nav.exit");
    }
    $("#clock").textContent = "⏱ " + mmss((s.endTime || Date.now()) - s.start);
    renderPlayers();
    renderStage();
  }

  /** `gain`: jugador y tema del quesito recién ganado (para animarlo). */
  function renderPlayers(gain?: { player: number; theme: number }) {
    const { t } = app.i18n;
    $("#players").innerHTML = s.game.players
      .map((p, i) => {
        const on = i === s.game.cur && s.phase !== "end";
        const sub = [t("game.ofSix", { n: wedgeCount(p) })];
        if (p.streak >= 2) sub.push(t("game.streak", { n: p.streak }));
        if (on) sub.push(t("game.yourTurn"));
        const g = gain?.player === i;
        return `<div class="pcard${on ? " on" : ""}${g ? " gain" : ""}"><span class="av" aria-hidden="true">${p.avatar}</span><div class="who"><span class="nm">${esc(p.name)}</span><span class="sub">${esc(sub.join(" · "))}</span></div>${pie(p.has, colors, 46, g ? gain!.theme : -1)}${g ? `<span class="plus" aria-hidden="true">${esc(t("turn.plus"))}</span>` : ""}</div>`;
      })
      .join("");
  }

  function renderStage() {
    if (s.phase === "handoff") renderHandoff();
    else if (s.phase === "wheel" || s.phase === "spinning") renderWheel();
    else if (s.phase === "wild") renderWild();
    else if (s.phase === "question") renderQuestion();
    else renderEnd();
  }

  /* ---------- Cambio de turno ---------- */
  function renderHandoff() {
    const { t } = app.i18n;
    const p = current(s.game);
    const first = s.game.players.every((x) => x.tot === 0);
    $("#stage").innerHTML = `
      <div class="panel handoff">
        <div class="ho-av" aria-hidden="true">${p.avatar}</div>
        <h2 class="ho-title">${esc(first ? t("turn.first", { name: p.name }) : t("turn.title", { name: p.name }))}</h2>
        <div class="ho-pie">${pie(p.has, colors, 84)}</div>
        <p class="muted" style="margin:0">${esc(t("game.ofSix", { n: wedgeCount(p) }))}</p>
        <button type="button" class="btn big" id="ready">${esc(t("turn.ready"))}</button>
      </div>`;
    $("#ready").addEventListener("click", () => {
      app.snd.blip();
      s.phase = "wheel";
      renderStage();
      $<SVGGElement>("#hub")?.focus({ preventScroll: true });
    });
    $<HTMLButtonElement>("#ready").focus({ preventScroll: true });
  }

  /* ---------- Ruleta ---------- */
  function renderWheel() {
    const { t, tx } = app.i18n;
    const p = current(s.game);
    $("#stage").innerHTML = `
      <div class="turn">${p.avatar} ${esc(t("game.turnOf", { name: p.name }))}</div>
      <div class="wheelbox">${wheelSVG({
        segments: unit.temas.map((th) => ({ color: th.color, emoji: th.emoji, label: tx(th.corto) })),
        wild: t("wheel.wild"),
        aria: t("wheel.label"),
        spinAria: t("wheel.spin"),
        spinText: t("wheel.spinText"),
      }, s.rot)}</div>
      <p class="hint" id="hint">${s.phase === "wheel" ? esc(t("wheel.hint")) : ""}</p>
      <div class="banner" id="banner" aria-live="polite">${s.banner ? esc(s.banner) : "&nbsp;"}</div>`;
    const hub = $("#hub");
    if (s.phase === "spinning") hub.classList.add("off");
    hub.addEventListener("click", spin);
    hub.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        spin();
      }
    });
  }

  function spin() {
    if (s.phase !== "wheel") return;
    s.phase = "spinning";
    app.lockLang(true);
    $("#hub").classList.add("off");
    $("#hint").textContent = "";
    app.snd.ensure();
    const idx = chooseSegment(missingThemes(current(s.game)), app.rng);
    s.rot = targetRotation(s.rot, idx, app.rng);
    const g = $<SVGGElement>("#wheelG");
    requestAnimationFrame(() => (g.style.transform = `rotate(${s.rot}deg)`));
    const reduce = reducedMotion();
    if (!reduce) {
      let tt = 0, d = 45;
      while (tt < 3400) {
        later(() => app.snd.tick(), tt);
        tt += d;
        d *= 1.12;
      }
    }
    later(() => landed(idx), reduce ? 500 : 3800);
  }

  function landed(idx: number) {
    const { t, tx } = app.i18n;
    // Resalta el segmento ganador y apaga el resto.
    $(".wheelbox")?.classList.add("picked");
    document.querySelector(`#wheelG .seg[data-seg="${idx}"]`)?.classList.add("on");
    if (idx === WILD) {
      app.snd.wild();
      s.banner = t("wheel.wildBanner");
      $("#banner").textContent = s.banner;
      later(() => {
        s.banner = "";
        s.phase = "wild";
        app.lockLang(false);
        renderStage();
        $<HTMLButtonElement>(".wild button")?.focus();
      }, 800);
    } else {
      const th = unit.temas[idx];
      s.banner = th.emoji + " " + t("wheel.landed", { theme: tx(th.nombre) });
      $("#banner").textContent = s.banner;
      app.snd.blip();
      later(() => {
        s.banner = "";
        showQuestion(idx);
      }, 1000);
    }
  }

  function renderWild() {
    const { t, tx } = app.i18n;
    const p = current(s.game);
    $("#stage").innerHTML = `<div class="turn">${esc(t("wheel.wildTitle", { name: p.name }))}</div>
      <div class="wild">${unit.temas.map((c, i) => (p.has[i] ? "" : `<button type="button" data-c="${i}"><span class="dot" style="background:${c.color}">${c.emoji}</span>${esc(tx(c.nombre))}</button>`)).join("")}</div>`;
    $("#stage .wild").addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
      if (!b) return;
      app.snd.blip();
      showQuestion(+b.dataset.c!);
    });
  }

  /* ---------- Pregunta ---------- */
  function showQuestion(theme: number) {
    const q = app.question(s.deck.draw(theme));
    s.qs = {
      q, theme,
      opts: q.tipo === "multiple" ? shuffle([q.correcta, ...q.incorrectas].map((text, i) => ({ text, ok: i === 0 })), app.rng) : [],
      gone: new Set(),
      order: q.tipo === "ordenar" ? scrambledOrder(q.elementos.length, app.rng) : [],
      numInput: "",
      answered: false,
      chosen: null,
      timeout: false,
      outcome: null,
      msgIdx: 0,
      fresh: true,
      justAnswered: false,
    };
    s.phase = "question";
    s.tLeft = s.limit;
    app.lockLang(false);
    renderQuestion();
    startTimer();
    // Foco en el primer control para jugar con teclado.
    $<HTMLElement>("#qbody input, #qbody button:not(:disabled)")?.focus({ preventScroll: true });
  }

  function renderQuestion() {
    const qs = s.qs!;
    const { q } = qs;
    const { t, tx } = app.i18n;
    const th = unit.temas[qs.theme];
    const p = current(s.game);
    const limit = s.limit;
    $("#stage").innerHTML = `
      <div class="qcard${qs.fresh ? " enter" : ""}" style="--cc:${th.color}" data-qid="${esc(q.id)}" data-tipo="${q.tipo}">
        <div class="qhead">
          <span class="chip"><i aria-hidden="true">${th.emoji}</i>${esc(tx(th.nombre))}</span>
          <span class="sheet">${esc(q.fuente)}</span>
        </div>
        ${limit ? `<div class="timer" id="timer"><div class="tbar"><i id="tfill"></i></div><span class="tnum" id="tnum">${Math.ceil(s.tLeft || limit)} s</span></div>` : ""}
        <div class="qtext" id="qtext">${rich(tx(q.pregunta))}${q.verificada ? "" : `<span class="unv" title="${esc(t("q.unverified"))}" aria-label="${esc(t("q.unverified"))}">*</span>`}</div>
        <div id="qbody">${body()}</div>
        ${q.tipo === "multiple" ? `<div class="tools2"><button type="button" class="fifty" id="fifty" ${p.fiftyUsed || qs.answered ? "disabled" : ""}>${esc(p.fiftyUsed ? t("q.fiftyUsed") : t("q.fifty"))}</button></div>` : ""}
        <div id="after">${qs.answered ? afterHtml() : ""}</div>
        ${q.verificada ? "" : `<p class="unv-note">${esc(t("q.unverifiedNote"))}</p>`}
      </div>`;
    updTimer();
    wireQuestion();
    qs.fresh = false;
    qs.justAnswered = false;
  }

  /** Clase de animación al contestar: rebote si está bien, sacudida si está mal. */
  const fx = (ok: boolean) => (s.qs?.justAnswered ? (ok ? " bounce" : " shake") : "");

  function optButton(i: number, label: string, html: string, ok: boolean) {
    const qs = s.qs!;
    const { t } = app.i18n;
    let cls = "opt", tag = "";
    if (qs.answered) {
      if (ok) {
        cls += " right" + fx(true);
        tag = qs.chosen === i ? t("q.rightYours") : t("q.right");
      } else if (qs.chosen === i) {
        cls += " wrong" + fx(false);
        tag = t("q.wrongYours");
      }
    } else if (qs.gone.has(i)) cls += " gone";
    const dis = qs.answered || qs.gone.has(i) ? "disabled" : "";
    return `<button type="button" class="${cls}" data-i="${i}" style="--i:${i}" ${dis}><span class="k">${label}</span><span class="t">${html}${tag ? `<span class="tag">${esc(tag)}</span>` : ""}</span></button>`;
  }

  function body(): string {
    const qs = s.qs!;
    const { q } = qs;
    const { t, tx } = app.i18n;
    switch (q.tipo) {
      case "multiple":
        return `<div class="opts" id="opts">${qs.opts.map((o, i) => optButton(i, "ABCD"[i], rich(tx(o.text)), o.ok)).join("")}</div>`;
      case "verdadero_falso":
        return `<div class="opts two" id="opts">${optButton(0, "A", esc(t("q.true")), q.respuesta)}${optButton(1, "B", esc(t("q.false")), !q.respuesta)}</div>`;
      case "numerica": {
        const ok = qs.answered && !qs.timeout && checkNumeric(qs.numInput, q.respuesta, q.tolerancia);
        const state = qs.answered ? (ok ? " right" : " wrong") + fx(ok) : "";
        return `<form class="numform" id="numform" novalidate>
          <label for="num">${esc(t("q.numLabel"))}</label>
          <div class="numrow">
            <input id="num" class="num${state}" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="done"
              placeholder="${esc(t("q.numPlaceholder"))}" value="${esc(qs.numInput)}" ${qs.answered ? "disabled" : ""}>
            ${q.unidad ? `<span class="unit-l">${rich(tx(q.unidad))}</span>` : ""}
            ${qs.answered ? "" : `<button type="submit" class="btn">${esc(t("q.check"))}</button>`}
          </div>
        </form>`;
      }
      case "ordenar": {
        const n = qs.order.length;
        return `${qs.answered ? "" : `<p class="hint-dark">${esc(t("q.orderHint"))}</p>`}
          <ol class="order" id="order">${qs.order
            .map((k, pos) => {
              const text = tx(q.elementos[k]);
              const st = qs.answered ? (k === pos ? " right" : " wrong") + fx(k === pos) : "";
              return `<li class="oitem${st}" data-k="${k}" style="--i:${pos}"><span class="k">${pos + 1}</span><span class="t">${rich(text)}</span>${
                qs.answered
                  ? ""
                  : `<span class="mv"><button type="button" class="arrow" data-up="${pos}" ${pos === 0 ? "disabled" : ""} aria-label="${esc(t("q.orderUp", { item: plain(text) }))}">▲</button><button type="button" class="arrow" data-down="${pos}" ${pos === n - 1 ? "disabled" : ""} aria-label="${esc(t("q.orderDown", { item: plain(text) }))}">▼</button></span>`
              }</li>`;
            })
            .join("")}</ol>
          ${qs.answered ? "" : `<div class="actions"><button type="button" class="btn" id="checkorder">${esc(t("q.check"))}</button></div>`}`;
      }
    }
  }

  function wireQuestion() {
    const qs = s.qs!;
    if (qs.answered) {
      $("#next")?.addEventListener("click", next);
      return;
    }
    const { q } = qs;
    if (q.tipo === "multiple" || q.tipo === "verdadero_falso") {
      $("#opts").addEventListener("click", (e) => {
        const b = (e.target as HTMLElement).closest<HTMLButtonElement>(".opt");
        if (b && !b.disabled) chooseOption(+b.dataset.i!);
      });
    }
    if (q.tipo === "multiple") $("#fifty").addEventListener("click", fifty);
    if (q.tipo === "numerica") {
      const inp = $<HTMLInputElement>("#num");
      inp.addEventListener("input", () => {
        qs.numInput = inp.value;
        inp.removeAttribute("aria-invalid");
      });
      $("#numform").addEventListener("submit", (e) => {
        e.preventDefault();
        qs.numInput = inp.value;
        if (parseNumber(inp.value) === null) {
          inp.setAttribute("aria-invalid", "true");
          inp.focus();
          return;
        }
        resolve(checkNumeric(inp.value, q.respuesta, q.tolerancia), false);
      });
    }
    if (q.tipo === "ordenar") {
      $("#order").addEventListener("click", (e) => {
        const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button.arrow");
        if (!b) return;
        const from = Number(b.dataset.up ?? b.dataset.down);
        const to = b.dataset.up !== undefined ? from - 1 : from + 1;
        [qs.order[from], qs.order[to]] = [qs.order[to], qs.order[from]];
        app.snd.blip();
        renderQuestion();
        // El foco sigue al elemento movido.
        const sel = b.dataset.up !== undefined ? `[data-up="${to}"]` : `[data-down="${to}"]`;
        const again = $<HTMLButtonElement>(`#order button${sel}`);
        (again && !again.disabled ? again : $<HTMLButtonElement>(`#order li:nth-child(${to + 1}) button:not(:disabled)`))?.focus();
      });
      $("#checkorder").addEventListener("click", () => resolve(checkOrder(qs.order), false));
    }
  }

  function chooseOption(i: number) {
    const qs = s.qs!;
    if (qs.answered || qs.gone.has(i)) return;
    qs.chosen = i;
    const { q } = qs;
    const ok = q.tipo === "multiple" ? qs.opts[i].ok : q.tipo === "verdadero_falso" ? (i === 0) === q.respuesta : false;
    resolve(ok, false);
  }

  function fifty() {
    const qs = s.qs!;
    if (qs.answered || qs.q.tipo !== "multiple" || !useFifty(s.game)) return;
    app.snd.blip();
    for (const i of fiftyRemove(qs.opts.map((o) => o.ok), app.rng)) qs.gone.add(i);
    renderQuestion();
    $<HTMLButtonElement>("#opts .opt:not(:disabled)")?.focus();
  }

  function startTimer() {
    stopTimer();
    if (!s.limit) return;
    s.tLeft = s.limit;
    s.lastBeep = -1;
    updTimer();
    s.tInt = setInterval(() => {
      s.tLeft -= 0.1;
      updTimer();
      if (s.tLeft <= 0) {
        stopTimer();
        resolve(false, true);
      }
    }, 100);
  }

  function updTimer() {
    const f = document.getElementById("tfill");
    if (!f || !s.limit) return;
    f.style.width = Math.max(0, (s.tLeft / s.limit) * 100) + "%";
    const sec = Math.ceil(Math.max(0, s.tLeft));
    $("#tnum").textContent = sec + " s";
    const warn = s.tLeft <= 5;
    $("#timer").classList.toggle("warn", warn);
    if (warn && s.tInt && sec !== s.lastBeep && sec > 0) {
      s.lastBeep = sec;
      app.snd.beep();
    }
  }

  function resolve(correct: boolean, timeout: boolean) {
    const qs = s.qs!;
    if (qs.answered) return;
    qs.answered = true;
    qs.timeout = timeout;
    stopTimer();
    qs.outcome = recordAnswer(s.game, qs.theme, correct, qs.q.id);
    app.progress.record(unitKey(unit), qs.q.id, correct);
    qs.msgIdx = Math.floor(app.rng() * 100);
    qs.justAnswered = true;
    if (correct) app.snd.right();
    else app.snd.wrong();
    renderPlayers(qs.outcome.gained ? { player: s.game.cur, theme: qs.theme } : undefined);
    renderQuestion();
    $<HTMLButtonElement>("#next")?.focus();
  }

  function afterHtml(): string {
    const qs = s.qs!;
    const out = qs.outcome!;
    const { t, tx, list } = app.i18n;
    const p = current(s.game);
    const solo = s.game.players.length === 1;
    let msg: string, btn: string;
    if (out.correct) {
      const good = list("good");
      msg = `${p.avatar} ${good[qs.msgIdx % good.length]}`;
      if (out.gained) msg += " " + t("q.gained", { theme: tx(unit.temas[qs.theme].corto) });
      if (p.streak >= 3) msg += " " + t("q.streak", { n: p.streak });
      btn = out.won ? t("q.seeResult") : t("q.spinAgain");
    } else {
      const bad = list("bad");
      msg = `${p.avatar} ${qs.timeout ? t("q.timeUp") : bad[qs.msgIdx % bad.length]}`;
      btn = solo ? t("q.spinAgain") : t("q.turnOf", { name: s.game.players[out.nextPlayer].name });
    }
    const { q } = qs;
    let extra = "";
    if (!out.correct && (q.tipo === "numerica" || q.tipo === "ordenar" || q.tipo === "verdadero_falso")) {
      if (q.tipo === "numerica" && qs.numInput.trim()) extra += `<span class="ans">${esc(t("q.yourAnswer", { a: qs.numInput.trim() }))}</span>`;
      extra += `<span class="ans"><b class="inline">${q.tipo === "ordenar" ? esc(t("q.orderCorrect")) + "</b> " : esc(t("q.correctAnswer", { a: "" })) + "</b>"}${answerHtml(q, app.i18n)}</span>`;
    }
    return `<div class="explain${qs.justAnswered ? " pop" : ""}"><b>${esc(msg)}</b>${extra}${rich(tx(q.explicacion))}</div>
      <div class="actions" style="margin-top:14px"><button class="btn" id="next" type="button">${esc(btn)}</button></div>`;
  }

  function next() {
    const qs = s.qs!;
    const out = qs.outcome!;
    if (out.correct && out.won) return victory();
    const changed = out.nextPlayer !== s.game.cur;
    advance(s.game, out);
    s.qs = null;
    s.phase = changed ? "handoff" : "wheel";
    renderPlayers();
    renderStage();
    if (changed) app.snd.turn();
    else $<SVGGElement>("#hub")?.focus({ preventScroll: true });
  }

  /* ---------- Final ---------- */
  function victory() {
    stopTimer();
    if (s.clockInt) clearInterval(s.clockInt);
    s.clockInt = null;
    s.endTime = Date.now();
    s.phase = "end";
    s.qs = null;
    renderPlayers();
    renderEnd();
    app.snd.win();
    confetti(colors);
  }

  function starsHtml(n: number) {
    const { t } = app.i18n;
    return `<span class="stars" role="img" aria-label="${esc(t("end.stars", { n }))}">${[0, 1, 2]
      .map((k) => `<span class="star${k < n ? " on" : ""}" style="--k:${k}" aria-hidden="true">★</span>`)
      .join("")}</span>`;
  }

  /** Columna del podio (o fila, para el 4.º). */
  function standingHtml(st: Standing, row = false) {
    const { t, list } = app.i18n;
    const p = st.player;
    const medal = ["🥇", "🥈", "🥉"][st.place - 1] ?? "";
    const place = list("end.places")[st.place - 1] ?? `${st.place}`;
    return `<div class="pod-who">
        <span class="pod-medal" aria-hidden="true">${medal}</span>
        <span class="pod-av" aria-hidden="true">${p.avatar}</span>
        <b class="pod-name">${row ? `<span class="pod-place">${esc(place)}</span> ` : `<span class="sr">${esc(place)} · </span>`}${esc(p.name)}</b>
        ${pie(p.has, colors, 52)}
        ${starsHtml(st.stars)}
        <span class="pod-stat">${esc(t(p.ok === 1 ? "end.stats1" : "end.stats", { ok: p.ok, tot: p.tot, best: p.best }))}</span>
      </div>`;
  }

  function renderEnd() {
    const { t, tx, list: tlist } = app.i18n;
    const p = s.game.players[s.game.winner ?? s.game.cur];
    const list = uniqueMissed(s.game);
    const solo = s.game.players.length === 1;
    const rank = ranking(s.game);
    const anim = !s.endShown;
    s.endShown = true;
    const podium = rank.filter((r) => r.place <= 3 && rank.indexOf(r) < 3);
    const rest = rank.filter((r) => !podium.includes(r));
    $("#stage").innerHTML = `
      <div class="panel win${anim ? " anim" : ""}">
        <h2>${p.avatar} ${esc(t("end.won", { name: p.name }))}</h2>
        ${solo
          ? `<div>${pie(p.has, colors, 120)}</div>
             ${starsHtml(rank[0].stars)}
             <div class="stats"><div><b>${p.avatar} ${esc(p.name)}</b>${esc(t(p.ok === 1 ? "end.stats1" : "end.stats", { ok: p.ok, tot: p.tot, best: p.best }))}</div></div>`
          : `<ol class="podium n${podium.length}" aria-label="${esc(t("end.podium"))}">
               ${podium.map((r, i) => `<li class="pod pos${i + 1} place${r.place}" style="--d:${[2, 1, 0][i] ?? 0}">
                 ${standingHtml(r)}
                 <div class="pod-step" aria-hidden="true">${esc(tlist("end.places")[r.place - 1] ?? "")}</div>
               </li>`).join("")}
             </ol>
             ${rest.length ? `<ol class="pod-rest" start="${podium.length + 1}">${rest.map((r) => `<li class="pod-row">${standingHtml(r, true)}</li>`).join("")}</ol>` : ""}`}
        <p class="muted" style="margin:0">${esc(t("end.time"))} <b style="color:var(--cream)">${mmss(s.endTime - s.start)}</b></p>
        ${list.length
          ? `<div class="review"><h3>${esc(t("end.review"))}</h3><ul>${list.map((m) => { const q = app.question(m.qid); return `<li>${rich(tx(q.pregunta))}<br><span>${answerHtml(q, app.i18n)}</span></li>`; }).join("")}</ul></div>`
          : `<p class="muted" style="margin:0">${esc(t("end.perfect"))}</p>`}
        <div class="row center">
          <button class="btn big" id="again" type="button">${esc(t("end.again"))}</button>
          <button class="btn small ghost" id="tomenu" type="button">${esc(t("nav.back"))}</button>
        </div>
      </div>`;
    $("#again").addEventListener("click", () => app.go(setupScreen(s.subject, s.unit)));
    $("#tomenu").addEventListener("click", () => {
      app.musicWanted = false;
      app.snd.stopMusic();
      app.go(menuScreen());
    });
    $<HTMLButtonElement>("#again").focus({ preventScroll: true });
  }

  /* ---------- Teclado: 1-4 eligen opción ---------- */
  const onKey = (e: KeyboardEvent) => {
    const qs = s.qs;
    if (s.phase !== "question" || !qs || qs.answered) return;
    if ((e.target as HTMLElement)?.tagName === "INPUT") return;
    if (qs.q.tipo !== "multiple" && qs.q.tipo !== "verdadero_falso") return;
    const k = "1234".indexOf(e.key);
    const n = qs.q.tipo === "multiple" ? qs.opts.length : 2;
    if (k >= 0 && k < n && !qs.gone.has(k)) chooseOption(k);
  };
  document.addEventListener("keydown", onKey);

  return {
    heading: (a) => ({ title: a.i18n.tx(unit.titulo), tagline: a.i18n.tx(unit.descripcion) }),
    compact: true,
    subject: s.subject,
    render,
    busy: () => s.phase === "spinning",
    dispose() {
      stopTimer();
      if (s.clockInt) clearInterval(s.clockInt);
      s.clockInt = null;
      for (const id of s.timers) clearTimeout(id);
      s.timers.clear();
      document.removeEventListener("keydown", onKey);
    },
  };
}
