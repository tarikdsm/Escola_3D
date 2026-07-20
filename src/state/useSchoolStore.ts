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
import { ROTINA, periodoPara, turnoPara } from '../contracts/routine';
import { emit } from '../contracts/events';
import { reporEstoque as reporEstoquePinceis, setComAllcanci } from '../simulation/pinceis';
import {
  iniciarViagem,
  cancelarViagem as cancelarViagemSim,
} from '../simulation/viagemTempo';
import type { SchoolState } from '../contracts/store';

export const useSchoolStore = create<SchoolState>()((set, get) => ({
  clockMin: CONST.HORA_ABERTURA, // 7h00
  periodo: periodoPara(CONST.HORA_ABERTURA), // 'CHEGADA'
  turno: turnoPara(CONST.HORA_ABERTURA), // 'manha'
  velocidade: 1,
  somLigado: true,
  modoCamera: 'aereo', // integração: abre na vista aérea (escola inteira); Tab desce p/ caminhar
  modoAnterior: 'aereo', // modo de retorno ao sair do voo (tecla F)
  selecionadoId: null,
  atividades: {},
  portaoAberto: true,
  comAllcanci: false, // "Sem Allcanci": pincéis descartáveis (estoque do almoxarifado)
  viajando: false, // viagem no tempo (slider do rodapé) em curso
  minutoAlvoViagem: null,

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
  toggleAllcanci: () => {
    const novo = !get().comAllcanci;
    setComAllcanci(novo); // espelha no módulo da simulação (lido pelos behaviors)
    set({ comAllcanci: novo });
  },
  reporEstoque: () => reporEstoquePinceis(),
  selecionar: (id) => set({ selecionadoId: id }),

  // Viagem no tempo: a store só espelha o alvo; o estado/reset ficam no
  // módulo simulation/viagemTempo.ts e a perseguição no hook de step.ts.
  viajarPara: (minuto) => {
    const alvo = Math.round(
      Math.min(Math.max(minuto, CONST.HORA_ABERTURA), CONST.HORA_FECHAMENTO),
    );
    iniciarViagem(alvo, get().clockMin); // redefine o alvo se já estiver viajando
    set({ viajando: true, minutoAlvoViagem: alvo });
  },
  cancelarViagem: () => {
    cancelarViagemSim();
    set({ viajando: false, minutoAlvoViagem: null });
  },

  tickClock: (minutos) => {
    const { clockMin, periodo } = get();
    if (minutos <= 0 || clockMin >= CONST.HORA_FECHAMENTO) return;
    const novoMin = Math.min(clockMin + minutos, CONST.HORA_FECHAMENTO);
    const novoPeriodo = periodoPara(novoMin);
    set({ clockMin: novoMin, periodo: novoPeriodo, turno: turnoPara(novoMin) });
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
