/** Punto de entrada del navegador. */
import type { Content } from "./data/schema";
import { App } from "./ui/app";
import { menuScreen } from "./ui/screens/menu";

const content = JSON.parse(document.getElementById("content-data")!.textContent!) as Content;
const app = new App(content, document.getElementById("app")!);
app.go(menuScreen());

// Service worker: solo en producción (en desarrollo molestaría con la caché).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {});
  });
}
