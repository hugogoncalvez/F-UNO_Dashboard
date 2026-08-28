import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  output: "static",
  site: "https://f-uno-center.vercel.app",
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
