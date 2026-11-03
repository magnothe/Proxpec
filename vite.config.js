import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import overpassHandler from './api/overpass.js'

// Em produção /api/overpass é a função serverless (api/overpass.js).
// No `npm run dev` não há serverless, então montamos ESSE MESMO handler como
// middleware do Vite — assim dev e produção usam a mesma lógica (vários
// servidores em paralelo), e o pedido sai do servidor, sem esbarrar em CORS.
function apiOverpassLocal() {
  return {
    name: 'api-overpass-local',
    configureServer(server) {
      server.middlewares.use('/api/overpass', (req, res) => {
        // Imita a API de resposta da Vercel (res.status().json()).
        res.status = (code) => {
          res.statusCode = code
          return res
        }
        res.json = (obj) => {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(obj))
        }
        overpassHandler(req, res).catch((e) => {
          console.error('[api/overpass]', e)
          if (!res.headersSent) res.status(500).json({ erro: 'Erro interno no proxy.' })
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), apiOverpassLocal()],
  server: {
    port: 5173,
    open: true,
  },
})
