import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      // Em produção /api/overpass é a função serverless (api/overpass.js).
      // No `npm run dev` não há serverless, então o próprio Vite faz o papel
      // de proxy — o pedido sai do servidor de dev, não do navegador, então
      // também não esbarra em CORS.
      '/api/overpass': {
        // Não use overpass-api.de aqui: muitas redes domésticas não conseguem
        // alcançá-lo (a conexão fica pendurada até estourar o timeout).
        target: 'https://overpass.openstreetmap.fr',
        changeOrigin: true,
        rewrite: () => '/api/interpreter',
      },
    },
  },
})
