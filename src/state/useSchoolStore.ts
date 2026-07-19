/**
 * useSchoolStore.ts — Implementação Zustand do contrato `contracts/store.ts`.
 *
 * Guarda somente estado grosso (baixa frequência). O loop da simulação deve:
 * - chamar `tickClock(dtMinutosDeJogo)` respeitando ESCALA_TEMPO × velocidade;
 * - escrever posições/animações em SIM (simBuffer.ts), NÃO aqui;
 * - chamar `setAtividades(batch)` ~1 Hz com textos PT-BR por personagem.
 */

import { create } from 'zustand';
import { CONST } from '../contracts/layout';
import { ROTINA, periodoPara } from '../contracts/routine';
import { emit } from '../contracts/events';
import type { SchoolState } from '../contracts/store';

export const useSchoolStore = create<SchoolState>()((set, get) => ({
  clockMin: CONST.HORA_ABERTURA, // 7h00
  periodo: periodoPara(CONST.HORA_ABERTURA), // 'CHEGADA'
  velocidade: 1,
  somLigado: true,
  modoCamera: 'aereo', // integração: abre na vista aérea (escola inteira); Tab desce p/ caminhar
  modoAnterior: 'aereo', // modo de retorno ao sair do voo (tecla F)
  andarMinimap: 0,
  selecionadoId: null,
  atividades: {},
  portaoAberto: true,

  setVelocidade: (v) => set({ velocidade: v }),
  toggleSom: () => set((s) => ({ somLigado: !s.somLigado })),
  toggleModoCamera: () =>
    set((s) => ({
      // No voo, Tab sai para o modo anterior; senão alterna andar ↔ aéreo.
      modoCamera: s.modoCamera === 'voar' ? s.modoAnterior : s.modoCamera === 'andar' ? 'aereo' : 'andar',
    })),
  toggleVoo: () =>
    set((s) =>
      s.modoCamera === 'voar'
        ? { modoCamera: s.modoAnterior } // sai do voo para o modo anterior
        : { modoCamera: 'voar' as const, modoAnterior: s.modoCamera }, // entra no voo lembrando de onde veio
    ),
  setAndarMinimap: (a) => set({ andarMinimap: a }),
  selecionar: (id) => set({ selecionadoId: id }),

  tickClock: (minutos) => {
    const { clockMin, periodo } = get();
    if (minutos <= 0 || clockMin >= CONST.HORA_FECHAMENTO) return;
    const novoMin = Math.min(clockMin + minutos, CONST.HORA_FECHAMENTO);
    const novoPeriodo = periodoPara(novoMin);
    set({ clockMin: novoMin, periodo: novoPeriodo });
    // Eventos de sino para cada marco cruzado neste avanço.
    for (const marco of ROTINA) {
      if (marco.sino && clockMin < marco.inicioMin && marco.inicioMin <= novoMin) {
        emit('sino', marco.periodo);
      }
    }
    if (novoPeriodo !== periodo) {
      emit('periodo', novoPeriodo);
    }
  },

  setAtividades: (batch) => set((s) => ({ atividades: { ...s.atividades, ...batch } })),
  setPortaoAberto: (aberto) => set({ portaoAberto: aberto }),
}));
