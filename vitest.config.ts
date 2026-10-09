import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Os 5s padrão do vitest estouram em testes que renderizam centenas de
    // linhas quando a suíte inteira disputa a máquina. Ficava vermelho sem
    // nada ter quebrado, e teste assim treina a gente a ignorar vermelho.
    testTimeout: 20000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
