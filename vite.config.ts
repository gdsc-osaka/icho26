import { reactRouter } from "@react-router/dev/vite";
import { cloudflareDevProxy } from "@react-router/dev/vite/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [cloudflareDevProxy(), tailwindcss(), reactRouter()],
  resolve: {
    alias: [
      { find: "~/workers", replacement: path.resolve(__dirname, "./workers") },
      { find: "~", replacement: path.resolve(__dirname, "./app") },
    ],
  },
});
