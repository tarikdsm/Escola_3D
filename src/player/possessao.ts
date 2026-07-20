/**
 * possessao.ts — CICLO DE VIDA DA POSSE de um NPC pelo jogador.
 *
 * Possuir = o NPC sai do controle da simulação (o loop de agentes pula o
 * índice — ver o skip em simulation/step.ts) e passa a ter SIM.pos/facing/
 * anim/speed dirigidos pelo controlador de 3ª pessoa (PossuidoControls.tsx).
 *
 * - iniciarPosse(idx): tira o NPC da simulação (libera lugar/fila/conversa,
 *   marca a atividade) e grava modo 'possuido' + possuidoIdx na store.
 *   Se já houver outro NPC possuído, ele é devolvido antes (troca de alvo).
 * - soltarPosse(): devolve o NPC à simulação NA POSIÇÃO ATUAL (replaneja no
 *   próximo frame) e fica no modo livre (botão "Soltar" do HUD).
 * - soltarPosseEVoar(): idem, mas termina no modo voo (clique no vazio).
 *
 * O acesso ao mundo da simulação é pela referência `mundoAtivo`
 * (simulation/estado.ts — edição mínima da rodada de posse), usada apenas
 * nestas transições; o passo por frame do controlador NÃO toca no mundo.
 */

import { SIM, setAnim, setSpeed, setTalkTarget } from '../contracts/simBuffer';
import { liberarTudo, mundoAtivo } from '../simulation/estado';
import { useSchoolStore } from '../state/useSchoolStore';

/** Atividade exibida do NPC enquanto está possuído (vai à store a ~1 Hz). */
export const ATIVIDADE_POSSUIDO = 'Controlado por você';

/** Atividade deixada ao devolver o NPC (até a próxima tarefa ser atribuída). */
const ATIVIDADE_RETOMANDO = 'Retomando a rotina';

/**
 * Tira o NPC `idx` da simulação e entra no modo 'possuido'. A trava do
 * ponteiro (pointer lock) NÃO é pedida aqui — fica a cargo do gesto do
 * usuário (o clique/toque que originou a posse, ver picking.ts).
 */
export function iniciarPosse(idx: number): void {
  const st = useSchoolStore.getState();
  if (st.possuidoIdx === idx && st.modoCam === 'possuido') return; // já é ele
  if (st.possuidoIdx !== null && st.possuidoIdx !== idx) {
    devolverPossuido(); // troca de alvo: devolve o anterior à simulação
  }
  const m = mundoAtivo;
  if (m) {
    const a = m.agentes[idx];
    // Solta tudo que o NPC disputava (lugar no refeitório/roda/banco/mesa,
    // fila da cantina/almoxarifado, parceria de conversa) — vago na hora.
    liberarTudo(m, a);
    a.fase = 'fazendo';
    a.velAtual = 0;
    a.atividade = ATIVIDADE_POSSUIDO;
  }
  // Estado visual coerente já neste frame (a simulação não escreve mais nele).
  setAnim(idx, 'idle');
  setSpeed(idx, 0);
  setTalkTarget(idx, -1);
  useSchoolStore.getState().possuir(idx);
}

/** Libera o NPC possuído e fica no modo livre (botão "Soltar" do HUD). */
export function soltarPosse(): void {
  const st = useSchoolStore.getState();
  if (st.possuidoIdx !== null) devolverPossuido();
  st.soltarPossuido(); // modoCam 'livre' + possuidoIdx null
}

/** Libera o NPC possuído e volta ao modo voo (clique no vazio, modo livre). */
export function soltarPosseEVoar(): void {
  const st = useSchoolStore.getState();
  if (st.possuidoIdx !== null) devolverPossuido();
  st.soltarPossuido();
  st.entrarVoo();
}

/**
 * Devolve o NPC à simulação NA POSIÇÃO ATUAL: sincroniza o estado interno do
 * agente a partir dos buffers SIM (dirigidos pelo controlador) e rearma a
 * máquina de estados — com fase 'fazendo' e tempoRestante 0, o próximo
 * `atualizarAgente` chama `atribuirProximaTarefa` (replaneja dali).
 */
function devolverPossuido(): void {
  const idx = useSchoolStore.getState().possuidoIdx;
  if (idx === null) return;
  const m = mundoAtivo;
  if (!m) return;
  const a = m.agentes[idx];
  const i3 = idx * 3;
  a.x = SIM.pos[i3];
  a.y = SIM.pos[i3 + 1];
  a.z = SIM.pos[i3 + 2];
  a.angulo = SIM.facing[idx];
  a.anguloAlvo = a.angulo;
  a.fase = 'fazendo';
  a.tempoRestante = 0; // força replanejamento no próximo frame simulado
  a.path.length = 0;
  a.pathIdx = 0;
  a.via.length = 0;
  a.viaIdx = 0;
  a.destino = null;
  a.nodeAlvo = -1;
  a.modo = 'nenhum';
  a.velAtual = 0;
  a.semProgresso = 0;
  a.ultimaDist = Infinity;
  a.atividade = ATIVIDADE_RETOMANDO;
}
