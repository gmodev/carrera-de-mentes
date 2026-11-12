/**
 * App: contenido, idioma, sonido, progreso y navegación entre pantallas.
 * Cada pantalla es una función render(app) que pinta en #app y se puede
 * volver a llamar (p. ej. al cambiar de idioma) sin perder su estado.
 */
import type { Content, Pregunta, Subject, Unit } from "../data/schema";
import { loadLang, makeI18n, saveLang, type I18n, type Lang } from "../i18n";
import { SND, type Sound } from "../audio/sound";
import { ProgressStore } from "../progress/store";
import { defaultRng, type Rng } from "../game/rng";
import { $, $$, esc, svgUrl } from "./util";

export interface Screen {
  /** Pinta la pantalla entera. */
  render(app: App): void;
  /** Limpia temporizadores al salir. */
  dispose?(): void;
  /** true si ahora no se puede repintar (p. ej. la ruleta está girando). */
  busy?(): boolean;
  /** Materia activa: se usa su dibujo de fondo (fondo.svg), si tiene. */
  subject?: Subject;
  /** Cabecera compacta en una sola fila (durante la partida). */
  compact?: boolean;
  /** Título y descripción de la cabecera. */
  heading?(app: App): { title: string; tagline: string };
}

export interface Prefs {
  nPlayers: number;
  limit: number;
  names: string[];
  avatars: number[];
  review: boolean;
}

export class App {
  i18n: I18n;
  readonly snd: Sound = SND;
  readonly progress = new ProgressStore();
  readonly rng: Rng = defaultRng;
  readonly prefs: Prefs = { nPlayers: 2, limit: 30, names: ["", "", "", ""], avatars: [0, 1, 2, 3], review: false };
  private screen: Screen | null = null;
  private readonly qIndex = new Map<string, Pregunta>();

  constructor(
    readonly content: Content,
    readonly root: HTMLElement,
  ) {
    this.i18n = makeI18n(loadLang());
    for (const s of content.subjects) for (const u of s.units) for (const q of u.preguntas) this.qIndex.set(q.id, q);
    this.wireTopBar();
  }

  get lang(): Lang {
    return this.i18n.lang;
  }

  question(id: string): Pregunta {
    const q = this.qIndex.get(id);
    if (!q) throw new Error(`Pregunta desconocida: ${id}`);
    return q;
  }

  findUnit(subjectId: string, unitId: string): { subject: Subject; unit: Unit } | null {
    const subject = this.content.subjects.find((s) => s.id === subjectId);
    const unit = subject?.units.find((u) => u.id === unitId);
    return subject && unit ? { subject, unit } : null;
  }

  go(screen: Screen) {
    this.screen?.dispose?.();
    this.screen = screen;
    $("#hslot").innerHTML = "";
    this.refresh();
    window.scrollTo({ top: 0 });
  }

  /** Repinta la pantalla actual y la cabecera (p. ej. tras cambiar de idioma). */
  refresh() {
    if (!this.screen) return;
    this.screen.render(this);
    this.renderTopBar();
  }

  setLang(l: Lang) {
    if (l === this.lang || this.screen?.busy?.()) return;
    this.i18n = makeI18n(l);
    saveLang(l);
    this.refresh();
  }

  /* ---------- Cabecera: título, idioma y sonido ---------- */
  private wireTopBar() {
    $("#langs").addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-lang]");
      if (b) this.setLang(b.dataset.lang as Lang);
    });
    $("#bgm").addEventListener("click", () => {
      this.snd.music = !this.snd.music;
      this.snd.save();
      this.renderTopBar();
      if (this.snd.music) {
        if (this.musicWanted) this.snd.startMusic();
      } else this.snd.stopMusic();
    });
    $("#snd").addEventListener("click", () => {
      this.snd.sfx = !this.snd.sfx;
      this.snd.save();
      this.renderTopBar();
      if (this.snd.sfx) this.snd.blip();
    });
  }

  /** La música suena mientras hay partida (lo marca la pantalla de juego). */
  musicWanted = false;

  renderTopBar() {
    const { t } = this.i18n;
    const h = this.screen?.heading?.(this) ?? { title: t("app.title"), tagline: t("app.tagline") };
    $(".top").classList.toggle("compact", !!this.screen?.compact);
    const art = this.screen?.subject?.fondo;
    document.body.classList.toggle("has-art", !!art);
    if (art) document.body.style.setProperty("--art", svgUrl(art));
    $("#title").textContent = h.title;
    $("#tagline").textContent = h.tagline;
    document.title = h.title;
    document.documentElement.lang = this.lang === "va" ? "ca-valencia" : "es";
    $("#langs").setAttribute("aria-label", t("lang.label"));
    for (const b of $$<HTMLButtonElement>("#langs button")) {
      b.setAttribute("aria-pressed", String(b.dataset.lang === this.lang));
      b.textContent = t(`lang.${b.dataset.lang}`);
      b.disabled = !!this.screen?.busy?.();
    }
    const bgm = $("#bgm"), snd = $("#snd");
    bgm.textContent = t("sound.music");
    snd.textContent = t("sound.sfx");
    bgm.setAttribute("aria-pressed", String(this.snd.music));
    snd.setAttribute("aria-pressed", String(this.snd.sfx));
  }

  /** Activa o desactiva el selector de idioma (mientras gira la ruleta). */
  lockLang(locked: boolean) {
    for (const b of $$<HTMLButtonElement>("#langs button")) b.disabled = locked;
  }

  html(s: string) {
    this.root.innerHTML = s;
  }

  esc = esc;
}
