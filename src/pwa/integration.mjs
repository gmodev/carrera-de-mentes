/**
 * Genera dist/sw.js al terminar el build, con la lista de todos los
 * archivos para precargarlos (así el juego funciona sin conexión).
 */
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

export function serviceWorker() {
  let base = "/";
  return {
    name: "carrera-service-worker",
    hooks: {
      "astro:config:done": ({ config }) => {
        base = config.base.replace(/\/?$/, "/");
      },
      "astro:build:done": async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const files = (await walk(root)).filter((f) => !f.endsWith("sw.js") && !f.endsWith(".DS_Store"));
        const hash = createHash("sha256");
        const urls = [];
        for (const f of files.sort()) {
          const rel = path.relative(root, f).split(path.sep).join("/");
          hash.update(rel).update(await readFile(f));
          urls.push(rel === "index.html" ? base : base + rel);
        }
        const version = hash.digest("hex").slice(0, 12);
        const tpl = await readFile(new URL("./sw.template.js", import.meta.url), "utf8");
        const sw = tpl
          .replace("__VERSION__", version)
          .replace("__BASE__", base)
          .replace("__PRECACHE__", JSON.stringify(urls, null, 2));
        await writeFile(path.join(root, "sw.js"), sw);
        logger.info(`sw.js generado: ${urls.length} archivos, versión ${version}`);
      },
    },
  };
}
