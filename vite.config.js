import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  return {
    plugins: [vue()],
    base: loadEnv(mode, process.cwd()).VITE_APP_PATH,
    server: {
      port: 3001,
      open: false,
    },
  };
});
