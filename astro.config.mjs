// @ts-check
import { defineConfig } from "astro/config";
import { serviceWorker } from "./src/pwa/integration.mjs";

// En GitHub Pages el sitio vive en /<repo>/: el workflow pasa BASE_PATH.
const base = process.env.BASE_PATH || "/";

export default defineConfig({
  site: process.env.SITE_URL,
  base,
  integrations: [serviceWorker()],
  build: { inlineStylesheets: "auto" },
  devToolbar: { enabled: false },
});
