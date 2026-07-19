import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Aplicação 100% browser (sem backend): build estático via Vite.
// base: caminho do GitHub Pages (https://tarikdsm.github.io/Escola_3D/).
export default defineConfig({
  base: '/Escola_3D/',
  plugins: [react()],
});
