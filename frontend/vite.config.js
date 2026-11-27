import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Em desenvolvimento, /api vai para a API (assim funciona também ao abrir pelo IP da máquina na rede).
    // 127.0.0.1 e não "localhost": no Windows, "localhost" vira o IPv6 ::1, onde a API não escuta.
    proxy: { '/api': { target: process.env.VITE_PROXY_API || 'http://127.0.0.1:3333', changeOrigin: true } },
  },
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
