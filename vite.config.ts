import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // @ts-expect-error.
  plugins: [tailwindcss(), sveltekit()],
});
