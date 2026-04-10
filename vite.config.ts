import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Supabase
          'vendor-supabase': ['@supabase/supabase-js'],
          // PDF generation
          'vendor-pdf': ['jspdf', 'jspdf-autotable', 'html2canvas'],
          // Text editor + sanitization
          'vendor-editor': ['quill', 'dompurify'],
          // Icons
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
})
