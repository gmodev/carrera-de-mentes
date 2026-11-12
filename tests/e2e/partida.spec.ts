/**
 * Recorrido completo: una partida de 1 jugador de Historia hasta reunir los
 * 6 colores. La primera pregunta se falla a propósito para comprobar el turno,
 * la lista «Para repasar» y el progreso guardado.
 *
 * Las respuestas correctas se buscan en el contenido que la página ya incluye
 * (#content-data); el juego no tiene ningún modo trampa.
 */
import { expect, test, type Page } from "@playwright/test";

type Texto = { es: string; va?: string };
type Q =
  | { id: string; tipo: "multiple"; correcta: Texto; incorrectas: Texto[] }
  | { id: string; tipo: "verdadero_falso"; respuesta: boolean }
  | { id: string; tipo: "numerica"; respuesta: number }
  | { id: string; tipo: "ordenar"; elementos: Texto[] };

async function questions(page: Page): Promise<Map<string, Q>> {
  const raw = await page.locator("#content-data").textContent();
  const content = JSON.parse(raw!);
  const map = new Map<string, Q>();
  for (const s of content.subjects) for (const u of s.units) for (const q of u.preguntas) map.set(q.id, q);
  return map;
}

async function answer(page: Page, q: Q, correct: boolean) {
  const card = page.locator(".qcard");
  switch (q.tipo) {
    case "multiple": {
      const text = correct ? q.correcta.es : q.incorrectas[0].es;
      // Texto exacto: «Siglo XV» no debe coincidir con «Siglo XVI».
      await card.locator("#opts").getByText(text, { exact: true }).click();
      break;
    }
    case "verdadero_falso":
      await card.locator(`.opt[data-i="${(q.respuesta === correct) ? 0 : 1}"]`).click();
      break;
    case "numerica":
      await card.locator("#num").fill(correct ? String(q.respuesta).replace(".", ",") : String(q.respuesta + 1));
      await card.getByRole("button", { name: "Comprobar" }).click();
      break;
    case "ordenar": {
      if (correct) {
        // Ordenación por selección usando solo los botones ▲.
        for (let target = 0; target < q.elementos.length; target++) {
          const keys = await card.locator(".oitem").evaluateAll((els) => els.map((e) => Number((e as HTMLElement).dataset.k)));
          let pos = keys.indexOf(target);
          while (pos > target) {
            await card.locator(`button[data-up="${pos}"]`).click();
            pos--;
          }
        }
      }
      await card.getByRole("button", { name: "Comprobar" }).click();
      break;
    }
  }
}

test("partida completa de 1 jugador de Historia", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Elige materia y unidad" })).toBeVisible();
  await page.getByRole("button", { name: /^Unidad 8: La prehistoria/ }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Carrera de la Prehistoria");
  await page.getByRole("button", { name: "1 jugador" }).click();
  await page.getByRole("button", { name: "Sin tiempo" }).click();
  await page.getByLabel("Nombre 1").fill("Lucía");
  await page.getByRole("button", { name: "¡A jugar!" }).click();

  const Q = await questions(page);
  let failedOnce = false;
  let failedText = "";
  let questionsSeen = 0;

  for (let turn = 0; turn < 40; turn++) {
    if (await page.locator(".win").isVisible()) break;
    await expect(page.locator(".turn")).toContainText("Turno de Lucía");
    await page.locator("#hub").click();

    // Cae en un color (pregunta) o en el comodín (elegir color).
    await expect(page.locator(".qcard, .wild")).toBeVisible({ timeout: 10_000 });
    if (await page.locator(".wild").isVisible()) {
      await page.locator(".wild button").first().click();
    }
    const card = page.locator(".qcard");
    await expect(card).toBeVisible();
    const qid = (await card.getAttribute("data-qid"))!;
    const q = Q.get(qid)!;
    expect(q, `pregunta ${qid}`).toBeDefined();
    questionsSeen++;

    const correct = failedOnce;
    if (!correct) {
      failedOnce = true;
      failedText = (await page.locator("#qtext").textContent())!.replace(/\*$/, "");
    }
    await answer(page, q, correct);

    await expect(page.locator(".explain")).toBeVisible();
    const next = page.locator("#next");
    if (correct) {
      await expect(page.locator(".explain b").first()).toContainText(/!/);
      // El quesito nuevo se anima en la tarjeta del jugador.
      await expect(page.locator(".pcard.gain .pie-new")).toHaveCount(1);
      await expect(page.locator(".pcard.gain .plus")).toHaveText("+1 quesito");
    }
    else await expect(next).toHaveText("Girar otra vez"); // solo: fallar no pasa el turno a nadie
    await next.click();
  }

  // Pantalla final
  await expect(page.getByRole("heading", { name: /Lucía ha reunido los 6 colores/ })).toBeVisible();
  await expect(page.locator(".stats")).toContainText(`6 aciertos de ${questionsSeen}`);
  await expect(page.locator(".review")).toContainText("Para repasar");
  await expect(page.locator(".review")).toContainText(failedText.trim().slice(0, 20));
  expect(questionsSeen).toBe(7);
  // 6 de 7 = 86 % → 2 estrellas; jugando solo no hay podio.
  await expect(page.getByRole("img", { name: "2 de 3 estrellas" })).toBeVisible();
  await expect(page.locator(".podium")).toHaveCount(0);

  // El progreso se ha guardado: la pregunta fallada aparece «por repasar».
  await page.locator("#tomenu").click();
  await page.getByRole("button", { name: "Ver mi progreso" }).click();
  await expect(page.locator(".levels")).toContainText("1 por repasar");
  await expect(page.getByRole("button", { name: "Repasar lo que me cuesta" })).toBeVisible();

  // Menú: quesito de progreso y acceso directo al repaso; el fondo de Historia
  // solo aparece dentro de la materia.
  await page.getByRole("button", { name: "← Menú" }).click();
  await expect(page.locator(".unit-pie svg")).toBeVisible();
  await expect(page.locator("body")).not.toHaveClass(/has-art/);
  await page.getByRole("button", { name: "Repasar la pregunta que te cuesta de Unidad 8: La prehistoria" }).click();
  await expect(page.getByRole("button", { name: "Repaso: solo lo que me cuesta" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("body")).toHaveClass(/has-art/);

  expect(errors).toEqual([]);
});

test("cambiar a valenciano traduce la interfaz y las preguntas", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Valencià" }).click();
  await expect(page.getByRole("heading", { name: "Tria matèria i unitat" })).toBeVisible();
  await page.getByRole("button", { name: /^Unitat 8: La prehistòria/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Carrera de la Prehistòria");
  await page.getByRole("button", { name: "A jugar!" }).click();
  await expect(page.getByRole("heading", { name: "Comença Jugador 1" })).toBeVisible();
  await page.getByRole("button", { name: "Som-hi!" }).click();
  await expect(page.locator(".turn")).toContainText("Torn de");
  // Se recuerda al recargar
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tria matèria i unitat" })).toBeVisible();
});

test("se ve bien a 400 px sin scroll horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 });
  await page.goto("/");
  await page.getByRole("button", { name: /^Unidad 8/ }).click();
  await page.getByRole("button", { name: "4 jugadores" }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await page.getByRole("button", { name: "¡A jugar!" }).click();
  await page.getByRole("button", { name: "¡Vamos!" }).click();
  await expect(page.locator(".wheelbox")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test("funciona sin conexión (PWA)", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  // Espera a que el service worker controle la página.
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: /Elige materia|Tria matèria/ })).toBeVisible();
  await page.getByRole("button", { name: /^(Unidad|Unitat) 8/ }).click();
  await expect(page.locator("#go")).toBeVisible();
  await context.setOffline(false);
});

test("con 2 jugadores, fallar muestra la pantalla de cambio de turno", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Unidad 8/ }).click();
  await page.getByRole("button", { name: "2 jugadores" }).click();
  await page.getByRole("button", { name: "Sin tiempo" }).click();
  await page.getByLabel("Nombre 1").fill("Ana");
  await page.getByLabel("Nombre 2").fill("Leo");
  await page.getByRole("button", { name: "¡A jugar!" }).click();

  // Cabecera compacta: reloj y Salir arriba, sin la descripción.
  await expect(page.locator(".top.compact #clock")).toBeVisible();
  await expect(page.locator("#tagline")).toBeHidden();

  await expect(page.getByRole("heading", { name: "Empieza Ana" })).toBeVisible();
  await expect(page.getByRole("button", { name: "¡Vamos!" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".turn")).toContainText("Turno de Ana");

  const Q = await questions(page);
  await page.locator("#hub").click();
  await expect(page.locator(".qcard, .wild")).toBeVisible({ timeout: 10_000 });
  if (await page.locator(".wild").isVisible()) await page.locator(".wild button").first().click();
  const q = Q.get((await page.locator(".qcard").getAttribute("data-qid"))!)!;
  await answer(page, q, false);
  await expect(page.locator("#next")).toHaveText("Turno de Leo");
  await page.locator("#next").click();

  await expect(page.getByRole("heading", { name: "¡Turno de Leo!" })).toBeVisible();
  await expect(page.locator(".pcard.on")).toContainText("Leo");
  await page.getByRole("button", { name: "¡Vamos!" }).click();
  await expect(page.locator(".turn")).toContainText("Turno de Leo");
  await expect(page.locator("#hub")).toBeFocused();
});

/** Un turno completo: girar, (comodín), contestar y pulsar «siguiente». */
async function playTurn(page: Page, Q: Map<string, Q>, correct: boolean) {
  if (await page.getByRole("button", { name: "¡Vamos!" }).isVisible()) await page.getByRole("button", { name: "¡Vamos!" }).click();
  await page.locator("#hub").click();
  await expect(page.locator(".qcard, .wild")).toBeVisible({ timeout: 10_000 });
  if (await page.locator(".wild").isVisible()) await page.locator(".wild button").first().click();
  const qcard = page.locator(".qcard");
  await expect(qcard).toBeVisible();
  const q = Q.get((await qcard.getAttribute("data-qid"))!)!;
  await answer(page, q, correct);
  // La opción elegida se anima (rebote si está bien, sacudida si está mal)
  await expect(qcard.locator(correct ? ".bounce" : ".shake").first()).toBeAttached();
  await page.locator("#next").click();
}

test("con 2 jugadores, la pantalla final muestra el podio", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Unidad 8/ }).click();
  await page.getByRole("button", { name: "2 jugadores" }).click();
  await page.getByRole("button", { name: "Sin tiempo" }).click();
  await page.getByLabel("Nombre 1").fill("Ana");
  await page.getByLabel("Nombre 2").fill("Leo");
  await page.getByRole("button", { name: "¡A jugar!" }).click();
  const Q = await questions(page);

  await playTurn(page, Q, false); // Ana falla → Leo
  await playTurn(page, Q, true); // Leo gana 1 quesito
  await playTurn(page, Q, false); // Leo falla → Ana
  for (let k = 0; k < 6; k++) await playTurn(page, Q, true); // Ana gana

  await expect(page.getByRole("heading", { name: /Ana ha reunido los 6 colores/ })).toBeVisible();
  const podium = page.getByRole("list", { name: "Clasificación" });
  await expect(podium).toBeVisible();
  const places = podium.locator(".pod");
  await expect(places).toHaveCount(2);
  await expect(places.nth(0)).toContainText("Ana");
  await expect(places.nth(0)).toContainText("🥇");
  await expect(places.nth(0)).toContainText("6 aciertos de 7");
  await expect(places.nth(1)).toContainText("Leo");
  await expect(places.nth(1)).toContainText("🥈");
  // Ana 6/7 = 86 % → 2 estrellas; Leo 1/2 = 50 % → 1 estrella
  await expect(places.nth(0).getByRole("img", { name: "2 de 3 estrellas" })).toBeVisible();
  await expect(places.nth(1).getByRole("img", { name: "1 de 3 estrellas" })).toBeVisible();

  // Al cambiar de idioma se repinta traducido y sin repetir la animación
  await page.getByRole("button", { name: "Valencià" }).click();
  await expect(page.getByRole("list", { name: "Classificació" })).toBeVisible();
  await expect(page.locator(".win.anim")).toHaveCount(0);
});
