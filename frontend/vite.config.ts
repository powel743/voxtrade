import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

// PostCSS is configured inline here (rather than via postcss.config.ts
// autoloading) because this project uses "type": "module", which makes Node's
// require()-based PostCSS config loader choke on a TypeScript config file.
// postcss.config.ts is kept for reference and tooling that reads it directly.
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
