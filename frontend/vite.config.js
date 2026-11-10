import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load clean environment variables from .env files
  const env = loadEnv(mode, process.cwd(), '')

  // Safe picker: check process.env (Vercel build env) first, then local .env, then fallback
  const pick = (key, fallback = '') =>
    process.env[key] || env[key] || fallback

  return {
    plugins: [react()],

    // Clean variable definitions mapped from dashboard / environment
    define: {
      'import.meta.env.API_BASE': JSON.stringify(
        pick('API_BASE', 'http://localhost:8000/api')
      ),
      'import.meta.env.GOOGLE_CLIENT_ID': JSON.stringify(
        pick('GOOGLE_CLIENT_ID', '')
      ),
      'import.meta.env.FIREBASE_API_KEY': JSON.stringify(
        pick('FIREBASE_API_KEY', '')
      ),
      'import.meta.env.FIREBASE_AUTH_DOMAIN': JSON.stringify(
        pick('FIREBASE_AUTH_DOMAIN', '')
      ),
      'import.meta.env.FIREBASE_PROJECT_ID': JSON.stringify(
        pick('FIREBASE_PROJECT_ID', '')
      ),
      'import.meta.env.FIREBASE_STORAGE_BUCKET': JSON.stringify(
        pick('FIREBASE_STORAGE_BUCKET', '')
      ),
      'import.meta.env.FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(
        pick('FIREBASE_MESSAGING_SENDER_ID', '')
      ),
      'import.meta.env.FIREBASE_APP_ID': JSON.stringify(
        pick('FIREBASE_APP_ID', '')
      ),
    },

    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
        '/media': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
  }
})
