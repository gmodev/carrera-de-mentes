# Carrera de mentes

Juego de preguntas para repasar (1.º ESO), al estilo «Trivial»: se gira una ruleta, cada color es un tema, se contesta una pregunta y se ganan quesitos. Gana quien reúne los 6 colores. Funciona en español y en valenciano, se puede instalar en una tablet y funciona sin conexión.

**v1:** Historia, unidad 8 (la prehistoria). Hay 85 preguntas: las 77 de la versión original (`reference/carrera.html`) y 8 nuevas de otros tipos.

## Comandos

Hace falta Node 22 o superior.

```bash
npm install                     # una vez
npx playwright install chromium # una vez, para las pruebas de recorrido

npm run dev        # servidor de desarrollo → http://localhost:4321
npm run build      # genera dist/ (valida el contenido: si hay errores, falla)
npm run preview    # sirve dist/ para probar el resultado final
npm test           # pruebas unitarias (Vitest)
npm run test:e2e   # pruebas de recorrido (Playwright): partida completa, idioma, móvil, sin conexión
npm run typecheck  # comprobación de tipos
npm run icons      # regenera los iconos PNG de public/icons
```

## Estructura

```
src/
  data/
    schema.ts          esquema Zod de materias, unidades y preguntas
    parse.ts           valida los YAML (función pura, con pruebas)
    load.ts            busca automáticamente todas las carpetas de subjects/
    subjects/historia/
      subject.yaml                 materia: nombre y personajes
      fondo.svg                    dibujo de fondo de la materia (opcional)
      u08-prehistoria/unit.yaml    unidad: título y los 6 temas (colores)
      u08-prehistoria/questions.yaml
  game/      lógica sin DOM: ruleta, mazos, reglas, comprobación de respuestas
  progress/  progreso guardado en localStorage
  i18n/      textos de interfaz: es.json y va.json
  audio/     música y efectos de 8 bits con Web Audio
  ui/        pantallas: menú, preparación, partida, progreso
  pwa/       generación del service worker
  pages/index.astro   la página (carga y valida el contenido al compilar)
tests/unit   Vitest
tests/e2e    Playwright
reference/   la versión original de un solo archivo (la usan las pruebas)
```

## Cómo añadir preguntas

Edita el `questions.yaml` de la unidad. Cada pregunta lleva estos campos:

| campo | qué es |
|---|---|
| `id` | único y que no cambie nunca (el progreso se guarda por id), p. ej. `hist-u08-086` |
| `tema` | id de uno de los 6 temas de `unit.yaml` |
| `tipo` | `multiple`, `verdadero_falso`, `numerica` u `ordenar` |
| `pregunta`, `explicacion` | texto `{ es, va }` |
| `fuente` | de dónde sale: `"Libro, p. 12"`, `"Hoja de repaso"`… |
| `verificada` | `true` si está comprobada con el libro; si es `false`, sale con asterisco |

Ejemplos de cada tipo:

```yaml
- id: hist-u08-090
  tema: tiempo
  tipo: multiple                # siempre 1 correcta y 3 incorrectas
  pregunta: { es: "¿Cuántos años tiene un siglo?", va: "Quants anys té un segle?" }
  correcta: { es: "100", va: "100" }
  incorrectas:
    - { es: "10", va: "10" }
    - { es: "50", va: "50" }
    - { es: "1.000", va: "1.000" }
  explicacion: { es: Un siglo son 100 años., va: Un segle són 100 anys. }
  fuente: Hoja de repaso
  verificada: true

- id: hist-u08-091
  tema: arte
  tipo: verdadero_falso
  respuesta: false
  pregunta: { es: Altamira está en Francia., va: Altamira està a França. }
  explicacion: { es: Está en Cantabria., va: Està a Cantàbria. }
  fuente: "Libro, p. 140"
  verificada: true

- id: hist-u08-092
  tema: tiempo
  tipo: numerica                # se acepta coma o punto decimal, y espacios
  respuesta: 1492
  tolerancia: 0                 # opcional: margen aceptado
  pregunta: { es: "¿En qué año empieza la Edad Moderna?", va: "En quin any comença l'Edat Moderna?" }
  explicacion: { es: De 1492 a 1789., va: De 1492 a 1789. }
  fuente: Hoja de repaso
  verificada: true

- id: hist-u08-093
  tema: neolitico
  tipo: ordenar                 # de 3 a 6 elementos, EN EL ORDEN CORRECTO (el juego los baraja)
  pregunta: { es: Ordena las etapas, va: Ordena les etapes }
  elementos:
    - { es: Paleolítico, va: Paleolític }
    - { es: Neolítico, va: Neolític }
    - { es: Edad de los metales, va: Edat dels metalls }
  explicacion: { es: "…", va: "…" }
  fuente: Hoja de repaso
  verificada: true
```

Detalles:

- **Valenciano:** si no está la traducción, puedes escribir solo el texto en español (`pregunta: "¿…?"`). El juego lo mostrará en español y el build avisará, sin fallar. La prueba `no le falta ninguna traducción` sí fallará, para que no se olvide.
- **Exponentes y formato:** dentro de los textos se permiten `<sup>`, `<sub>`, `<b>` e `<i>` (p. ej. `3<sup>4</sup>`). No uses caracteres Unicode de superíndice (³). Cualquier otra etiqueta da error.
- **Comillas:** si un texto lleva `:`, `,` o `#`, o empieza por `¿`, ponlo entre comillas para evitar sorpresas del formato YAML.
- **Números escritos:** `3,5` y `3.5` valen 3,5. `1.000` y `1 000` valen mil (un punto seguido de 3 cifras se lee como separador de miles).
- El 50/50 solo se puede usar en preguntas `multiple`.

Si algo está mal (falta un campo, el tema no existe, hay un id repetido, una pregunta `multiple` no tiene 3 incorrectas, un tema se queda sin preguntas…), **`npm run build` falla** e indica el archivo, la pregunta y el campo.

## Cómo añadir una unidad o una materia

No hay que tocar código: el juego descubre las carpetas solo.

1. **Unidad nueva de una materia que ya existe:** crea `src/data/subjects/historia/u09-loquesea/` con:
   - `unit.yaml`: copia el de la unidad 8 y cambia `id` (igual que el nombre de la carpeta), `orden`, `nombre`, `titulo`, `descripcion` y los **6** `temas` (id, nombre, nombre corto para la ruleta, emoji y color `#RRGGBB`).
   - `questions.yaml`: al menos una pregunta por tema.
2. **Materia nueva:** crea `src/data/subjects/<materia>/subject.yaml` (con `id` igual que el nombre de la carpeta, nombre, emoji, `orden` en el menú y al menos 4 personajes) y dentro, una carpeta por unidad como en el paso 1.
3. **Fondo (opcional):** pon un `fondo.svg` en la carpeta de la materia. Es un mosaico que se repite cada 520 px y se muestra muy tenue detrás del juego y en su tarjeta del menú; el de Historia son pinturas rupestres. Solo puede contener dibujo: sin scripts, sin eventos, sin enlaces a archivos externos (los `<use href="#id">` internos sí valen) y como mucho 40 KB. Si no lo cumple, el build falla.
4. Ejecuta `npm test` y `npm run build`.

## Progreso y modo Repaso

- Se guarda en el navegador (`localStorage`, clave `cdm-progress-v1`), por unidad y pregunta: aciertos, fallos y resultado de la última vez. Si el navegador no deja guardar, el juego funciona igual, pero sin recordar nada.
- **Repaso: solo lo que me cuesta:** las preguntas falladas salen antes que las demás (primero las que se fallaron la última vez y las que más se han fallado). Cuando se acaban, sale el resto.
- **Mi progreso:** nivel por color. Una pregunta cuenta como «dominada» si la última vez se acertó y se ha acertado al menos tantas veces como se ha fallado.
- El progreso es de cada dispositivo: si juegan varios en la misma tablet, se suma el de todos.

## Instalar en la tablet y uso sin conexión

Una vez publicado, abre la web en la tablet:
- **Android (Chrome):** menú ⋮ → «Instalar aplicación» / «Añadir a pantalla de inicio».
- **iPad (Safari):** botón Compartir → «Añadir a pantalla de inicio».

La primera visita guarda todo en la tablet. Después funciona sin conexión; las fuentes de Google se guardan la primera vez y, si faltan, se usan las del sistema. Al publicar una versión nueva, se actualiza la siguiente vez que se abra con conexión.

## Despliegue

**GitHub Pages (incluido):**
1. Sube el proyecto a un repositorio de GitHub (rama `main`).
2. En el repositorio: *Settings → Pages → Build and deployment → Source: **GitHub Actions***.
3. Cada push a `main` ejecuta `.github/workflows/deploy.yml`: tipos, pruebas, prueba de recorrido, build y publicación en `https://<usuario>.github.io/<repo>/`.

**Netlify o Vercel:** comando de build `npm run build` y carpeta de publicación `dist`. No hace falta `BASE_PATH`, porque se sirve desde la raíz.

## Decisiones de diseño

- **Temas por unidad, no por materia.** Los 6 colores de Historia son de la unidad 8; otra unidad tendrá los suyos.
- **El contenido se valida al compilar.** `index.astro` carga los YAML con Zod y los incrusta como JSON en la página. El navegador no carga ni Zod ni YAML.
- **Lógica sin DOM.** `src/game` y `src/progress` no tocan la página, así que se prueban con Vitest. El azar se inyecta (`seeded(n)`) para que las pruebas sean deterministas.
- **Respecto a la versión original:** se han conservado el diseño, la música, la mecánica y las 77 preguntas (una prueba compara cada una con `reference/carrera.html`). Solo se ha corregido una explicación que estaba en valenciano en el texto en español («Atifells y bols» → «Recipientes y cuencos de cerámica»). Además, se ha añadido un botón «Salir» durante la partida.

## Pendiente

- **Traducción al valenciano:** conviene revisarla con el vocabulario del libro.
- **Más materias:** se añadirán más adelante siguiendo «Cómo añadir una unidad o una materia».
- **Generar preguntas a partir de fotos del libro:** queda para una fase posterior, con un método aún por decidir. El esquema (`src/data/schema.ts`) es el formato que deberá producir cualquier herramienta, y el validador (`parseContent`) sirve para comprobar los borradores antes de añadirlos.
