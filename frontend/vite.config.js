import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load ALL env vars (not just VITE_-prefixed ones) from .env files
  const env = loadEnv(mode, process.cwd(), '')

  // Safe picker: check process.env (Vercel build env) first, then local .env, then fallback
  const pick = (key, viteKey, fallback = '') =>
    process.env[key] || process.env[viteKey] || env[key] || env[viteKey] || fallback

  return {
    plugins: [react()],

    // Inject chosen vars into the browser bundle under import.meta.env.*
    // Only variables explicitly listed here are exposed — nothing else leaks.
    define: {
      'import.meta.env.API_BASE': JSON.stringify(
        pick('API_BASE', 'VITE_API_BASE', 'http://localhost:8000/api')
      ),
      'import.meta.env.GOOGLE_CLIENT_ID': JSON.stringify(
        pick('GOOGLE_CLIENT_ID', 'VITE_GOOGLE_CLIENT_ID', '')
      ),
      // Firebase client config — these are public by Google's design.
      // See: https://firebase.google.com/docs/projects/api-keys
      'import.meta.env.FIREBASE_API_KEY': JSON.stringify(
        pick('FIREBASE_API_KEY', 'VITE_FIREBASE_API_KEY', '')
      ),
      'import.meta.env.FIREBASE_AUTH_DOMAIN': JSON.stringify(
        pick('FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_AUTH_DOMAIN', '')
      ),
      'import.meta.env.FIREBASE_PROJECT_ID': JSON.stringify(
        pick('FIREBASE_PROJECT_ID', 'VITE_FIREBASE_PROJECT_ID', '')
      ),
      'import.meta.env.FIREBASE_STORAGE_BUCKET': JSON.stringify(
        pick('FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_STORAGE_BUCKET', '')
      ),
      'import.meta.env.FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(
        pick('FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_MESSAGING_SENDER_ID', '')
      ),
      'import.meta.env.FIREBASE_APP_ID': JSON.stringify(
        pick('FIREBASE_APP_ID', 'VITE_FIREBASE_APP_ID', '')
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
