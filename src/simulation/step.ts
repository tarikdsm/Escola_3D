/**
 * step.ts — Orquestra UM frame da simulação inteira (sem React, testável
 * em Node headless). Ordem por frame:
 *
 * 1) relógio (delta × ESCALA_TEMPO × velocidade → tickClock; wrap às 12h);
 * 2) detecção de troca de período → interrompe todos e replaneja;
 * 3) portão: aberto em CHEGADA/RECREIO/ALMOCO_SAIDA, fechado em AULA_*
 *    (decisão documentada aqui; aplicada só quando muda);
 * 4) agentes (máquina de estados + modos bola/fila);
 * 5) separação anti-sobreposição (hash espacial);
 * 6) física da bola;
 * 7) escrita dos buffers SIM (pos/facing/anim/phase/speed/talkTarget);
 * 8) atividades PT-BR → store a ~1 Hz (único sync de alta frequência).
 */
import { ROSTER } from '../contracts/roster';
import { useSchoolStore } from '../state/useSchoolStore';
import { escreverAgente, atualizarAgente } from './agents';
import { atualizarBola } from './ball';
import { aoMudarPeriodo } from './behaviors';
import { passoRelogio } from './clock';
import type { Mundo } from './estado';
import { separacao } from './navigation';

export function stepMundo(m: Mundo, dtReal: number): void {
  const dtJogo = passoRelogio(m, dtReal);
  const st = useSchoolStore.getState();

  if (st.periodo !== m.periodo) aoMudarPeriodo(m, st.periodo);

  const aberto = st.periodo !== 'AULA_1' && st.periodo !== 'AULA_2';
  if (aberto !== m.portaoAberto) {
    m.portaoAberto = aberto;
    st.setPortaoAberto(aberto);
  }

  for (const a of m.agentes) atualizarAgente(m, a, dtJogo);
  separacao(m, dtJogo);
  atualizarBola(m.bola, dtJogo);
  for (const a of m.agentes) escreverAgente(m, a, dtJogo, dtReal);

  m.accAtividades += dtReal;
  if (m.accAtividades >= 1) {
    m.accAtividades = 0;
    const batch: Record<string, string> = {};
    for (const a of m.agentes) batch[ROSTER[a.indice].id] = a.atividade;
    st.setAtividades(batch);
  }
}
