/**
 * helpStore.ts — visibilidade do overlay de ajuda (H / ? / botão "?" do HUD).
 * Store local do módulo de UI (separada da useSchoolStore, que guarda o
 * estado da simulação — isto aqui é só interface).
 */

import { create } from 'zustand';

interface AjudaState {
  ajudaAberta: boolean;
  toggleAjuda: () => void;
  setAjuda: (aberta: boolean) => void;
}

export const useAjudaStore = create<AjudaState>()((set) => ({
  ajudaAberta: false,
  toggleAjuda: () => set((s) => ({ ajudaAberta: !s.ajudaAberta })),
  setAjuda: (aberta) => set({ ajudaAberta: aberta }),
}));
