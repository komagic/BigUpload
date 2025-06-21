import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@bigupload/frontend": resolve(
        __dirname,
        "../../packages/frontend/src/index"
      ),
      "@bigupload/shared": resolve(
        __dirname,
        "../../packages/shared/src/index"
      ),
    },
  },
  server: {
    port: 3001,
    open: true,
  },
});
