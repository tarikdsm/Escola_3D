import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Aplicação 100% browser (sem backend): build estático via Vite.
export default defineConfig({
  plugins: [react()],
});
