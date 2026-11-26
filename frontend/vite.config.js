import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: true },
  build: {
    rollupOptions: {
      output: {
        // Bibliotecas grandes em arquivos separados (o navegador guarda em cache entre atualizações)
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          graficos: ['recharts'],
        },
      },
    },
  },
});
