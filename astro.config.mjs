import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  output: "static",
  site: "https://f-uno-center.vercel.app",
  // Sin trailing slash: coincide con los enlaces internos (/noticias/slug)
  // y con el canonical normalizado en Layout.astro
  trailingSlash: "never",
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
