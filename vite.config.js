import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // 1. นำเข้าปลั๊กอิน Tailwind
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // 2. เพิ่มเข้าไปใน array ของ plugins
  ],
})