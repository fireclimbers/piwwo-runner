import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/piwwo-runner/", // 👈 EXACT repo name here
});